-- Optional read-only verification after profile-permissions-fix.sql.
-- Checks schema/permissions, not real Stripe, Square or SMTP delivery.
WITH expected_functions(signature) AS (VALUES
  ('public.finalize_stripe_checkout_v1(uuid,text,text,bigint,text,text)'),
  ('public.claim_stripe_order_effects_v1(uuid,uuid)'),
  ('public.apply_square_inventory_count_v1(text,integer,timestamp with time zone,uuid,uuid)')
), checks AS (
  SELECT
    NOT has_column_privilege('authenticated','public.profiles','is_admin','UPDATE')
      AND NOT has_column_privilege('authenticated','public.profiles','is_admin','INSERT')
      AND NOT has_column_privilege('anon','public.profiles','is_admin','UPDATE')
      AND NOT has_column_privilege('anon','public.profiles','is_admin','INSERT') AS admin_flag_protected,
    (SELECT count(*) = 3 AND bool_and(
      NOT f.prosecdef AND f.proconfig @> ARRAY['search_path=""']
      AND has_function_privilege('service_role',f.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',f.oid,'EXECUTE')
      AND NOT has_function_privilege('authenticated',f.oid,'EXECUTE')
    ) FROM expected_functions e JOIN pg_proc f ON f.oid=to_regprocedure(e.signature)) AS checkout_functions_server_only,
    coalesce((SELECT c.relrowsecurity
      AND has_table_privilege('service_role',c.oid,'SELECT')
      AND has_table_privilege('service_role',c.oid,'INSERT')
      AND has_table_privilege('service_role',c.oid,'UPDATE')
      AND NOT EXISTS (SELECT 1 FROM unnest(ARRAY['anon','authenticated']) r WHERE
        has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(r,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
      FROM pg_class c WHERE c.oid=to_regclass('public.stripe_order_effects')),false) AS delivery_records_private,
    (SELECT count(*) = 2 FROM pg_attribute WHERE attrelid='public.products'::regclass
      AND NOT attisdropped AND attname IN ('square_inventory_calculated_at','square_inventory_calculated_quantity')) AS square_observation_columns_present,
    NOT EXISTS (SELECT 1 FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace
      WHERE n.nspname='public' AND f.proname IN ('decrement_product_quantity','finalize_order')
      AND (has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE'))) AS legacy_payment_functions_server_only
)
SELECT to_jsonb(checks) AS database_checks FROM checks;
