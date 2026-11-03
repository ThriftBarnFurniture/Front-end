-- Additive rollout: apply and verify before enabling STRIPE_ATOMIC_FULFILLMENT.
-- Existing finalize_order/decrement_product_quantity functions are untouched.
BEGIN;

ALTER TABLE public.products
  ADD COLUMN square_inventory_calculated_at timestamptz,
  ADD COLUMN square_inventory_calculated_quantity integer;

CREATE TABLE public.stripe_order_effects (
  order_id uuid PRIMARY KEY REFERENCES public.orders(order_id),
  stripe_session_id text NOT NULL UNIQUE,
  square_updates jsonb NOT NULL DEFAULT '[]'::jsonb,
  admin_email_sent_at timestamptz,
  customer_email_sent_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(square_updates) = 'array')
);
ALTER TABLE public.stripe_order_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_order_effects FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.stripe_order_effects TO service_role;
CREATE INDEX stripe_order_effects_square_updates_idx
  ON public.stripe_order_effects USING gin (square_updates jsonb_path_ops);

CREATE FUNCTION public.finalize_stripe_checkout_v1(
  p_order_id uuid,
  p_stripe_session_id text,
  p_payment_intent text,
  p_amount_total_cents bigint,
  p_currency text,
  p_stripe_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_product public.products%ROWTYPE;
  v_wanted record;
  v_subtotal numeric := 0;
  v_updates jsonb := '[]'::jsonb;
  v_time timestamptz;
BEGIN
  IF p_order_id IS NULL OR p_stripe_session_id IS NULL OR
     p_stripe_session_id !~ '^cs_(test_|live_)?[A-Za-z0-9]+$' OR
     length(p_stripe_session_id) > 255 OR
     p_amount_total_cents IS NULL OR p_amount_total_cents < 0 OR
     p_currency IS NULL THEN
    RAISE EXCEPTION 'Invalid payment confirmation';
  END IF;

  -- One order lock serializes the webhook and browser confirmation for it.
  SELECT * INTO v_order FROM public.orders
  WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.stripe_session_id IS NOT NULL AND v_order.stripe_session_id <> p_stripe_session_id THEN
    RAISE EXCEPTION 'Payment session does not match order';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE stripe_session_id = p_stripe_session_id AND order_id <> p_order_id) THEN
    RAISE EXCEPTION 'Payment session already belongs to another order';
  END IF;
  IF v_order.total IS NULL OR round(v_order.total * 100) <> p_amount_total_cents OR
     lower(v_order.currency) IS DISTINCT FROM lower(p_currency) THEN
    RAISE EXCEPTION 'Payment amount or currency does not match order';
  END IF;
  IF v_order.payment_id IS NOT NULL AND v_order.payment_id IS DISTINCT FROM p_payment_intent THEN
    RAISE EXCEPTION 'Payment intent does not match order';
  END IF;
  IF lower(v_order.status) IN ('paid', 'fulfilled', 'refunded', 'chargeback') THEN
    -- Never create new notification work for historical completed orders.
    RETURN jsonb_build_object('duplicate', true, 'order', to_jsonb(v_order));
  END IF;
  IF v_order.status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'Order is not awaiting payment'; END IF;

  IF cardinality(v_order.items) IS NULL OR cardinality(v_order.items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Invalid order item snapshot';
  END IF;
  FOR v_item IN SELECT value::jsonb FROM unnest(v_order.items) AS entries(value) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' OR
       jsonb_typeof(v_item->'product_id') IS DISTINCT FROM 'string' OR
       (v_item->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
       jsonb_typeof(v_item->'name') IS DISTINCT FROM 'string' OR
       jsonb_typeof(v_item->'quantity') IS DISTINCT FROM 'number' OR
       (v_item->>'quantity') !~ '^[0-9]+$' OR
       (v_item->>'quantity')::numeric NOT BETWEEN 1 AND 999999 OR
       jsonb_typeof(v_item->'unit_price_cents') IS DISTINCT FROM 'number' OR
       (v_item->>'unit_price_cents') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Invalid order item snapshot';
    END IF;
    v_subtotal := v_subtotal + (v_item->>'quantity')::numeric * (v_item->>'unit_price_cents')::numeric;
    v_items := v_items || jsonb_build_array(v_item);
  END LOOP;
  IF v_order.subtotal IS NULL OR round(v_order.subtotal * 100) <> v_subtotal THEN
    RAISE EXCEPTION 'Snapshot subtotal does not match order';
  END IF;

  -- Aggregate duplicate lines; always lock products in UUID order to avoid
  -- deadlocks between orders containing the same products in different orders.
  FOR v_wanted IN
    SELECT (value->>'product_id')::uuid AS id, sum((value->>'quantity')::integer) AS quantity
    FROM jsonb_array_elements(v_items) GROUP BY 1 ORDER BY 1
  LOOP
    IF v_wanted.quantity > 999999 THEN RAISE EXCEPTION 'Item quantity is too large'; END IF;
    SELECT * INTO v_product FROM public.products WHERE id = v_wanted.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Missing product in order'; END IF;
    IF v_product.is_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'Inactive product purchased'; END IF;
    -- Match lib/inventory.ts: null or >= 1000000 means unlimited stock.
    IF v_product.quantity IS NOT NULL AND v_product.quantity < 1000000 THEN
      IF v_product.quantity < v_wanted.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product %', v_product.id;
      END IF;
      UPDATE public.products SET
        quantity = quantity - v_wanted.quantity,
        is_active = quantity - v_wanted.quantity > 0,
        updated_at = clock_timestamp()
      WHERE id = v_product.id
      RETURNING * INTO v_product;
      IF v_product.square_variation_id IS NOT NULL THEN
        v_updates := v_updates || jsonb_build_array(jsonb_build_object(
          'productId', v_product.id, 'variationId', v_product.square_variation_id,
          'quantity', v_product.quantity, 'soldQuantity', v_wanted.quantity
        ));
      END IF;
    END IF;
  END LOOP;

  v_time := clock_timestamp();
  UPDATE public.orders SET
    stripe_session_id = p_stripe_session_id,
    stripe_email = p_stripe_email,
    payment_id = p_payment_intent,
    payment_method = 'stripe',
    amount_total_cents = p_amount_total_cents,
    status = 'paid',
    purchase_date = v_time
  WHERE order_id = p_order_id RETURNING * INTO v_order;

  -- The unique session also serializes conflicting confirmations for different
  -- orders. Any violation rolls back every stock and order write above.
  INSERT INTO public.stripe_order_effects (order_id, stripe_session_id, square_updates, created_at)
  VALUES (p_order_id, p_stripe_session_id, v_updates, v_time);
  RETURN jsonb_build_object('duplicate', false, 'order', to_jsonb(v_order));
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_stripe_checkout_v1(uuid,text,text,bigint,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_stripe_checkout_v1(uuid,text,text,bigint,text,text) TO service_role;

CREATE FUNCTION public.claim_stripe_order_effects_v1(p_order_id uuid, p_lease_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_effects public.stripe_order_effects%ROWTYPE;
BEGIN
  IF p_lease_token IS NULL THEN RAISE EXCEPTION 'Missing lease token'; END IF;
  UPDATE public.stripe_order_effects SET
    lease_token = p_lease_token, lease_until = clock_timestamp() + interval '5 minutes',
    attempts = attempts + 1
  WHERE order_id = p_order_id
    AND (lease_until IS NULL OR lease_until < clock_timestamp())
    AND (jsonb_array_length(square_updates) > 0 OR admin_email_sent_at IS NULL OR customer_email_sent_at IS NULL)
  RETURNING * INTO v_effects;
  RETURN CASE WHEN FOUND THEN to_jsonb(v_effects) ELSE NULL END;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_stripe_order_effects_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_order_effects_v1(uuid,uuid) TO service_role;

-- Square can deliver counts out of order. Cache the newest observation while
-- website sales are awaiting sync; apply it once every pending sale is sent.
-- A worker acknowledges its sale and reconciles the count in this same lock.
CREATE FUNCTION public.apply_square_inventory_count_v1(
  p_variation_id text, p_quantity integer, p_calculated_at timestamptz,
  p_completed_order uuid DEFAULT NULL, p_lease_token uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_product public.products%ROWTYPE;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 0 OR p_calculated_at IS NULL THEN
    RAISE EXCEPTION 'Invalid Square inventory count';
  END IF;
  SELECT * INTO v_product FROM public.products
    WHERE square_variation_id = p_variation_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_completed_order IS NOT NULL THEN RAISE EXCEPTION 'Synced product no longer exists'; END IF;
    RETURN false;
  END IF;
  IF p_completed_order IS NOT NULL THEN
    UPDATE public.stripe_order_effects SET square_updates = (
      SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM jsonb_array_elements(square_updates)
      WHERE value->>'productId' <> v_product.id::text
    ) WHERE order_id = p_completed_order AND lease_token = p_lease_token;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order notification lease was lost'; END IF;
  END IF;
  IF v_product.quantity IS NULL OR v_product.quantity >= 1000000 THEN RETURN false; END IF;
  IF v_product.square_inventory_calculated_at IS NULL OR p_calculated_at > v_product.square_inventory_calculated_at THEN
    UPDATE public.products SET square_inventory_calculated_at = p_calculated_at,
      square_inventory_calculated_quantity = p_quantity
    WHERE id = v_product.id RETURNING * INTO v_product;
  END IF;
  IF EXISTS (SELECT 1 FROM public.stripe_order_effects
    WHERE square_updates @> jsonb_build_array(jsonb_build_object('productId', v_product.id))) THEN
    RETURN false;
  END IF;
  UPDATE public.products SET quantity = v_product.square_inventory_calculated_quantity,
    is_active = v_product.square_inventory_calculated_quantity > 0,
    updated_at = clock_timestamp()
  WHERE id = v_product.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_square_inventory_count_v1(text,integer,timestamptz,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_square_inventory_count_v1(text,integer,timestamptz,uuid,uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
