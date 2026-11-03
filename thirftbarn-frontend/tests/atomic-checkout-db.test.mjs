// Requires a disposable local PostgreSQL cluster owned by checkout_test on
// 127.0.0.1:55438. Creates and removes only its own uniquely named database.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import Stripe from 'stripe';
import { loader } from './helpers/load-ts.mjs';

const run = promisify(execFile);
const psql = process.env.TEST_PSQL_PATH || 'C:/Program Files/PostgreSQL/16/bin/psql.exe';
const database = `thriftbarn_checkout_test_${Date.now()}`;
assert.match(database, /^thriftbarn_checkout_test_\d+$/);
let created = false;
async function sql(command, db = database) {
  const { stdout } = await run(psql, ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', '55438', '-U', 'checkout_test', '-d', db, '-c', command], { windowsHide: true, timeout: 15000 });
  return stdout.trim();
}
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const oa = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ob = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const item = (id = a, quantity = 2, cents = 1000) => ({ product_id: id, name: 'Original chair', quantity, unit_price_cents: cents });
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const finalizer = (id = oa, session = 'cs_test_alpha', cents = 2500, currency = 'cad') =>
  `SELECT public.finalize_stripe_checkout_v1('${id}', '${session}', 'pi_test', ${cents}, '${currency}', 'guest@example.test');`;
async function reset(stock = 5) {
  await sql(`TRUNCATE public.stripe_order_effects, public.orders, public.products;
    INSERT INTO public.products(id, name, price, quantity, is_active, square_variation_id)
    VALUES ('${a}', 'Renamed chair', 1, ${stock}, true, 'variation_a'), ('${b}', 'Second chair', 5, ${stock}, true, 'variation_b');`);
}
async function order(id = oa, items = [item()], session = 'cs_test_alpha', total = 25) {
  const subtotal = items.reduce((sum, x) => sum + x.quantity * x.unit_price_cents, 0) / 100;
  await sql(`INSERT INTO public.orders(order_id,order_number,items,subtotal,tax,total,shipping_cost,currency,status,stripe_session_id,customer_email)
    VALUES ('${id}', '${id}', ARRAY[${items.map(x => quote(JSON.stringify(x))).join(',')}], ${subtotal}, 0, ${total}, ${total - subtotal}, 'cad', 'pending', ${session === null ? 'NULL' : quote(session)}, 'guest@example.test');`);
}
async function state() {
  return JSON.parse(await sql(`SELECT jsonb_build_object(
    'products', (SELECT jsonb_agg(jsonb_build_object('id',id,'quantity',quantity,'active',is_active) ORDER BY id) FROM public.products),
    'orders', (SELECT jsonb_agg(jsonb_build_object('id',order_id,'status',status) ORDER BY order_id) FROM public.orders),
    'effects', (SELECT count(*) FROM public.stripe_order_effects));`));
}

before(async () => {
  assert.equal(await sql('SELECT current_user;', 'postgres'), 'checkout_test');
  await sql(`CREATE DATABASE ${database};`, 'postgres');
  created = true;
  await sql(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    END $$;
    CREATE TABLE public.products (
      id uuid PRIMARY KEY, name text NOT NULL, price numeric NOT NULL, quantity integer NOT NULL,
      is_active boolean NOT NULL, updated_at timestamptz DEFAULT now(), square_variation_id text
    );
    CREATE TABLE public.orders (
      order_id uuid PRIMARY KEY, order_number text NOT NULL, status text DEFAULT 'pending',
      items text[] NOT NULL, subtotal numeric NOT NULL, total numeric NOT NULL, tax numeric NOT NULL DEFAULT 0,
      shipping_cost numeric, promo_code text, promo_discount numeric, currency text,
      customer_name text, customer_email text, customer_phone text, shipping_address text,
      shipping_method text, stripe_session_id text, stripe_email text, payment_id text,
      payment_method text, amount_total_cents integer, purchase_date timestamptz DEFAULT now()
    );
    GRANT SELECT,UPDATE ON public.products,public.orders TO service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id), full_name text,
      is_admin boolean NOT NULL DEFAULT false, phone text, address text
    );
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON public.profiles TO PUBLIC,anon,authenticated,service_role;
    GRANT INSERT(is_admin),UPDATE(is_admin) ON public.profiles TO authenticated;
    CREATE POLICY profiles_read_own ON public.profiles FOR SELECT TO authenticated USING(id=(SELECT auth.uid()));
    CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
      USING(id=(SELECT auth.uid())) WITH CHECK(id=(SELECT auth.uid()));
    CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK(id=(SELECT auth.uid()));
    INSERT INTO auth.users VALUES ('${a}'),('${b}'),('${oa}');
    INSERT INTO public.profiles(id,is_admin) VALUES ('${a}',false),('${b}',true);
    CREATE FUNCTION public.is_admin(uid uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER
      SET search_path=pg_catalog,public AS $$ SELECT is_admin FROM public.profiles WHERE id=uid $$;
    CREATE FUNCTION public.decrement_product_quantity(uuid,integer) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
    CREATE FUNCTION public.finalize_order(uuid,text,text,integer,text,text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;`);
  // Reproduce the reported privilege escalation only in this disposable fixture.
  await sql(`SET request.jwt.claim.sub='${a}'; SET ROLE authenticated;
    UPDATE public.profiles SET is_admin=true WHERE id='${a}';`);
  assert.equal(await sql(`SELECT is_admin FROM public.profiles WHERE id='${a}';`), 't');
  await sql(`UPDATE public.profiles SET is_admin=false WHERE id='${a}';`);
  const repair = readFileSync(new URL('../docs/profile-permissions-fix.sql', import.meta.url), 'utf8');
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = JSON.parse(await sql(repair));
    assert.deepEqual(result.admin_flag_permissions, {
      anon: { insert: false, update: false }, authenticated: { insert: false, update: false },
      service_role: { insert: true, update: true },
    });
    assert.equal(result.profile_editing_allowed, true);
    assert.equal(result.profile_creation_allowed, true);
    assert.equal(result.profile_reads_preserved, true);
  }
  const preflight = readFileSync(new URL('../docs/atomic-checkout-preflight.sql', import.meta.url), 'utf8');
  assert.equal(JSON.parse(await sql(preflight)).existing_effects_table, null);
  await sql(readFileSync(new URL('../supabase/migrations/202611030001_atomic_stripe_checkout.sql', import.meta.url), 'utf8'));
  assert.equal(JSON.parse(await sql(preflight)).existing_effects_table, 'stripe_order_effects');
  const readiness = JSON.parse(await sql(readFileSync(new URL('../docs/checkout-readiness.sql', import.meta.url), 'utf8')));
  assert.deepEqual(readiness, {
    admin_flag_protected: true, checkout_functions_server_only: true,
    delivery_records_private: true, square_observation_columns_present: true,
    legacy_payment_functions_server_only: true,
  });
});
after(async () => { if (created) await sql(`DROP DATABASE ${database} WITH (FORCE);`, 'postgres'); });

test('customers can edit their own profile but cannot promote themselves or another user', async () => {
  const customer = `SET request.jwt.claim.sub='${a}'; SET ROLE authenticated;`;
  await sql(`${customer} UPDATE public.profiles SET full_name='Updated name',phone='+16135550123',address='Fixture address' WHERE id='${a}';`);
  assert.equal(await sql(`${customer} SELECT full_name FROM public.profiles WHERE id='${a}';`), 'Updated name');
  await assert.rejects(sql(`${customer} UPDATE public.profiles SET is_admin=true WHERE id='${a}';`), /permission denied/);
  await assert.rejects(sql(`${customer} UPDATE public.profiles SET is_admin=true WHERE id='${b}';`), /permission denied/);
  await assert.rejects(sql(`${customer} UPDATE public.profiles SET id='${oa}' WHERE id='${a}';`), /permission denied/);
  await sql(`${customer} UPDATE public.profiles SET full_name='Wrong owner' WHERE id='${b}';`);
  assert.equal(await sql(`SELECT full_name IS NULL FROM public.profiles WHERE id='${b}';`), 't');
  assert.equal(await sql(`${customer} SELECT count(*) FROM public.profiles;`), '1');
});

test('profile creation keeps the non-admin default and rejects explicit admin inserts', async () => {
  const customer = `SET request.jwt.claim.sub='${oa}'; SET ROLE authenticated;`;
  await assert.rejects(sql(`${customer} INSERT INTO public.profiles(id,is_admin) VALUES('${oa}',true);`), /permission denied/);
  await assert.rejects(sql(`${customer} INSERT INTO public.profiles(id,full_name) VALUES(gen_random_uuid(),'Wrong owner');`), /row-level security/);
  await sql(`${customer} INSERT INTO public.profiles(id,full_name) VALUES('${oa}','New customer');`);
  assert.equal(await sql(`SELECT is_admin FROM public.profiles WHERE id='${oa}';`), 'f');
  await assert.rejects(sql(`SET ROLE anon; UPDATE public.profiles SET is_admin=true;`), /permission denied/);
});

test('existing admin access and trusted server role management survive the repair', async () => {
  assert.equal(await sql(`SELECT is_admin FROM public.profiles WHERE id='${b}';`), 't');
  assert.equal(await sql(`SET request.jwt.claim.sub='${b}'; SET ROLE authenticated; SELECT public.is_admin('${b}');`), 't');
  await sql(`SET ROLE service_role; UPDATE public.profiles SET is_admin=true WHERE id='${a}';`);
  assert.equal(await sql(`SELECT is_admin FROM public.profiles WHERE id='${a}';`), 't');
  await sql(`SET ROLE service_role; UPDATE public.profiles SET is_admin=false WHERE id='${a}';`);
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(sql(`SET ROLE ${role}; SELECT public.decrement_product_quantity('${a}',1);`), /permission denied/);
    await assert.rejects(sql(`SET ROLE ${role}; SELECT public.finalize_order('${oa}','cs_fixture','pi_fixture',100,'cad','fixture@example.test');`), /permission denied/);
  }
  await sql(`SET ROLE service_role; SELECT public.decrement_product_quantity('${a}',1);
    SELECT public.finalize_order('${oa}','cs_fixture','pi_fixture',100,'cad','fixture@example.test');`);
});

test('transaction preserves checkout snapshot and commits order, stock and durable work together', async () => {
  await reset(); await order();
  const result = JSON.parse(await sql(`SET ROLE service_role; ${finalizer()}`));
  assert.equal(result.duplicate, false);
  assert.equal(result.order.subtotal, 20);
  assert.equal(JSON.parse(result.order.items[0]).name, 'Original chair');
  const actual = await state();
  assert.equal(actual.products[0].quantity, 3);
  assert.equal(actual.orders[0].status, 'paid');
  assert.equal(actual.effects, 1);
  const work = JSON.parse(await sql(`SELECT square_updates FROM public.stripe_order_effects;`));
  assert.equal(work[0].quantity, 3);
});

test('late failure rolls back every earlier stock decrement and payment update', async () => {
  await reset(); await order();
  await sql(`CREATE FUNCTION public.reject_effect() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected failure'; END $$;
    CREATE TRIGGER reject_effect BEFORE INSERT ON public.stripe_order_effects FOR EACH ROW EXECUTE FUNCTION public.reject_effect();`);
  try {
    await assert.rejects(sql(finalizer()), /Injected failure/);
    const actual = await state();
    assert.equal(actual.products[0].quantity, 5);
    assert.equal(actual.orders[0].status, 'pending');
    assert.equal(actual.effects, 0);
  } finally { await sql('DROP TRIGGER reject_effect ON public.stripe_order_effects; DROP FUNCTION public.reject_effect();'); }
});

test('insufficient second item rolls back the first item and leaves order retryable', async () => {
  await reset(); await order(oa, [item(a), item(b)]);
  await sql(`UPDATE public.products SET quantity=1 WHERE id='${b}';`);
  await assert.rejects(sql(finalizer()), /Insufficient stock/);
  const actual = await state();
  assert.deepEqual(actual.products.map(x => x.quantity), [5, 1]);
  assert.equal(actual.orders[0].status, 'pending');
  assert.equal(actual.effects, 0);
});

test('two simultaneous confirmations decrement once and enqueue one set of effects', async () => {
  await reset(); await order();
  const results = await Promise.all([
    sql(`BEGIN; ${finalizer()} SELECT pg_sleep(0.25); COMMIT;`),
    sql(finalizer()),
  ]);
  const duplicateFlags = results.map(x => JSON.parse(x.split('\n')[0]).duplicate).sort();
  assert.deepEqual(duplicateFlags, [false, true]);
  const actual = await state();
  assert.equal(actual.products[0].quantity, 3);
  assert.equal(actual.effects, 1);
});

test('concurrent orders cannot spend the same finite stock', async () => {
  await reset(3); await order(); await order(ob, [item()], 'cs_test_beta');
  const results = await Promise.allSettled([sql(finalizer()), sql(finalizer(ob, 'cs_test_beta'))]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(results.filter(x => x.status === 'rejected').length, 1);
  const actual = await state();
  assert.equal(actual.products[0].quantity, 1);
  assert.deepEqual(actual.orders.map(x => x.status).sort(), ['paid', 'pending']);
  assert.equal(actual.effects, 1);
});

test('reversed cart order uses consistent product locks and preserves both decrements', async () => {
  await reset(); await order(oa, [item(a, 1), item(b, 1)]);
  await order(ob, [item(b, 1), item(a, 1)], 'cs_test_beta');
  await Promise.all([sql(finalizer()), sql(finalizer(ob, 'cs_test_beta'))]);
  assert.deepEqual((await state()).products.map(x => x.quantity), [3, 3]);
});

test('duplicate cart lines are aggregated for stock validation', async () => {
  await reset(3); await order(oa, [item(a, 2), item(a, 2)]);
  await assert.rejects(sql(finalizer()), /Insufficient stock/);
  assert.equal((await state()).products[0].quantity, 3);
});

test('unlimited sentinel stock is preserved without a Square count update', async () => {
  await reset(999999999); await order();
  await sql(finalizer());
  assert.equal((await state()).products[0].quantity, 999999999);
  assert.deepEqual(JSON.parse(await sql('SELECT square_updates FROM public.stripe_order_effects;')), []);
});

test('amount, currency, session and malformed snapshot failures do not modify stock', async () => {
  for (const variant of ['amount', 'currency', 'session', 'snapshot']) {
    await reset(); await order();
    if (variant === 'snapshot') await sql(`UPDATE public.orders SET items=ARRAY['{}'] WHERE order_id='${oa}';`);
    await assert.rejects(sql(finalizer(oa, variant === 'session' ? 'cs_test_wrong' : 'cs_test_alpha', variant === 'amount' ? 2400 : 2500, variant === 'currency' ? 'usd' : 'cad')));
    assert.equal((await state()).products[0].quantity, 5);
  }
});

test('one payment session cannot finalize two orders', async () => {
  await reset(); await order(oa, [item(a)], null); await order(ob, [item(b)], null);
  const results = await Promise.allSettled([sql(finalizer()), sql(finalizer(ob))]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  const actual = await state();
  assert.deepEqual(actual.products.map(x => x.quantity).sort(), [3, 5]);
  assert.equal(actual.effects, 1);
});

test('public roles cannot finalize payments, claim jobs or read customer delivery work', async () => {
  await reset(); await order();
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(sql(`SET ROLE ${role}; ${finalizer()}`), /permission denied/);
    await assert.rejects(sql(`SET ROLE ${role}; SELECT public.claim_stripe_order_effects_v1('${oa}', gen_random_uuid());`), /permission denied/);
    await assert.rejects(sql(`SET ROLE ${role}; SELECT public.apply_square_inventory_count_v1('variation_a', 1, now());`), /permission denied/);
    await assert.rejects(sql(`SET ROLE ${role}; SELECT * FROM public.stripe_order_effects;`), /permission denied/);
  }
});

test('delivery leases serialize workers and can be reclaimed after expiration', async () => {
  await reset(); await order(); await sql(finalizer());
  const claim = () => sql(`SELECT coalesce(public.claim_stripe_order_effects_v1('${oa}', gen_random_uuid()), 'null'::jsonb);`);
  const results = (await Promise.all([claim(), claim()])).map(x => JSON.parse(x));
  assert.equal(results.filter(Boolean).length, 1);
  await sql(`UPDATE public.stripe_order_effects SET lease_until=now()-interval '1 minute';`);
  assert.ok(JSON.parse(await claim()));
});

test('Square counts arriving out of order cannot restore stale stock', async () => {
  await reset();
  await sql(`SET ROLE service_role; SELECT public.apply_square_inventory_count_v1('variation_a', 2, '2026-11-03T12:00:00Z');
    SELECT public.apply_square_inventory_count_v1('variation_a', 4, '2026-11-03T11:00:00Z');`);
  assert.equal((await state()).products[0].quantity, 2);
});

test('pending website sales protect available stock until the latest Square count is reconciled', async () => {
  await reset(5); await order(oa, [item(a, 1)]); await order(ob, [item(a, 1)], 'cs_test_beta');
  await sql(finalizer()); await sql(finalizer(ob, 'cs_test_beta'));
  assert.equal((await state()).products[0].quantity, 3);
  // A POS count can include only the first website sale. Cache it without
  // restoring units that have already sold through the website.
  await sql(`SELECT public.apply_square_inventory_count_v1('variation_a', 4, '2026-11-03T11:00:00Z');`);
  assert.equal((await state()).products[0].quantity, 3);
  const tokenA = '11111111-aaaa-4111-8111-111111111111';
  const tokenB = '22222222-bbbb-4222-8222-222222222222';
  await sql(`SELECT public.claim_stripe_order_effects_v1('${oa}', '${tokenA}');
    SELECT public.claim_stripe_order_effects_v1('${ob}', '${tokenB}');
    SELECT public.apply_square_inventory_count_v1('variation_a', 2, '2026-11-03T12:00:00Z', '${oa}', '${tokenA}');`);
  assert.equal((await state()).products[0].quantity, 3);
  // Last acknowledgement carries an older observation. The cached newer
  // observation wins and includes a concurrent POS sale (actual count 2).
  await sql(`SELECT public.apply_square_inventory_count_v1('variation_a', 4, '2026-11-03T11:00:00Z', '${ob}', '${tokenB}');`);
  assert.equal((await state()).products[0].quantity, 2);
  assert.equal(await sql('SELECT sum(jsonb_array_length(square_updates)) FROM public.stripe_order_effects;'), '0');
});

test('a stale delivery lease cannot acknowledge a Square adjustment', async () => {
  await reset(); await order(); await sql(finalizer());
  await sql(`SELECT public.claim_stripe_order_effects_v1('${oa}', '11111111-aaaa-4111-8111-111111111111');`);
  await assert.rejects(sql(`SELECT public.apply_square_inventory_count_v1('variation_a', 3, now(), '${oa}', '22222222-bbbb-4222-8222-222222222222');`), /lease was lost/);
  assert.equal(await sql('SELECT jsonb_array_length(square_updates) FROM public.stripe_order_effects;'), '1');
});

// A small PostgREST-shaped adapter runs real service-role SQL in the disposable
// database. Stripe signatures/route handlers/fulfillment/effect delivery are real;
// only external Square and SMTP delivery are simulated. No live API is used.
function localServiceClient() {
  const identifier = value => { assert.match(value, /^[a-z_][a-z_0-9]*$/); return `"${value}"`; };
  const literal = value => value == null ? 'NULL' : typeof value === 'number' ? String(value) : quote(value);
  const execute = async command => {
    try { return { data: JSON.parse(await sql(`SET ROLE service_role; ${command}`)), error: null }; }
    catch (error) { return { data: null, error: { message: error.message } }; }
  };
  return {
    rpc: (name, args) => {
      assert.ok(['finalize_stripe_checkout_v1', 'claim_stripe_order_effects_v1', 'apply_square_inventory_count_v1'].includes(name));
      return execute(`SELECT coalesce(to_jsonb(public.${identifier(name)}(${Object.entries(args).map(([key, value]) => `${identifier(key)} => ${literal(value)}`).join(',')})), 'null'::jsonb);`);
    },
    from: table => {
      assert.ok(['orders', 'stripe_order_effects'].includes(table));
      const filters = [];
      let fields, columns = '*';
      const query = {
        select(value) { columns = value === '*' ? '*' : value.split(',').map(identifier).join(','); return query; },
        eq(key, value) { filters.push(`${identifier(key)}=${literal(value)}`); return query; },
        update(value) { fields = value; return query; },
        maybeSingle: () => {
          const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
          if (!fields) return execute(`SELECT coalesce((SELECT to_jsonb(row) FROM (SELECT ${columns} FROM public.${identifier(table)}${where}) row), 'null'::jsonb);`);
          const assignments = Object.entries(fields).map(([key, value]) => `${identifier(key)}=${literal(value)}`).join(',');
          return execute(`WITH changed AS (UPDATE public.${identifier(table)} SET ${assignments}${where} RETURNING ${columns}) SELECT coalesce((SELECT to_jsonb(row) FROM changed row), 'null'::jsonb);`);
        },
      };
      return query;
    },
  };
}

test('signed checkout, browser confirmation and Square webhook share one stock decrement and recover failed email', async t => {
  const env = {
    STRIPE_ATOMIC_FULFILLMENT: 'true', STRIPE_WEBHOOK_SECRET: 'whsec_disposable_fixture',
    SQUARE_WEBHOOK_SIGNATURE_KEY: 'square_fixture_secret', SQUARE_WEBHOOK_URL: 'https://example.test/api/square/webhook',
    SQUARE_LOCATION_ID: 'fixture_location', SQUARE_MERCHANT_ID: '',
  };
  const original = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail('Integration test attempted an external HTTP request');
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  await reset(); await order();
  const session = { id: 'cs_test_alpha', metadata: { order_id: oa }, payment_status: 'paid',
    amount_total: 2500, currency: 'cad', payment_intent: 'pi_test', customer_email: 'guest@example.test' };
  const stripe = new Stripe('sk_test_disposable_fixture');
  stripe.checkout.sessions.retrieve = async sessionId => { assert.equal(sessionId, session.id); return session; };
  const db = localServiceClient();
  let adminEmails = 0, customerAttempts = 0;
  const adjustments = [];
  const load = loader({
    '@/lib/supabase-admin': { createSupabaseAdmin: () => db },
    '../../../../utils/supabase/admin': { createAdminClient: () => db },
    '@/lib/stripe': { getStripe: () => stripe },
    '@/lib/square': { squareFetch: async (path, options) => {
      const body = JSON.parse(options.body);
      if (path === '/inventory/changes/batch-create') adjustments.push(body);
      else assert.equal(path, '/inventory/counts/batch-retrieve');
      return { counts: [{ catalog_object_id: 'variation_a', location_id: env.SQUARE_LOCATION_ID,
        state: 'IN_STOCK', quantity: '3', calculated_at: '2026-11-03T12:00:00Z' }] };
    } },
    '@/lib/brevo': {
      sendAdminOrderEmail: async payload => { assert.equal(payload.orderId, oa); adminEmails++; },
      sendCustomerOrderEmail: async payload => {
        assert.equal(payload.customerEmail, 'guest@example.test');
        if (++customerAttempts === 1) throw new Error('Simulated SMTP outage');
      },
    },
  });
  const webhook = load('app/api/stripe/webhook/route.ts').POST;
  const body = JSON.stringify({ id: 'evt_fixture', object: 'event', type: 'checkout.session.completed', data: { object: session } });
  const stripeRequest = signature => new Request('https://example.test/api/stripe/webhook', {
    method: 'POST', body, headers: { 'stripe-signature': signature },
  });
  assert.equal((await webhook(stripeRequest('invalid'))).status, 400);
  assert.equal((await state()).products[0].quantity, 5);
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: env.STRIPE_WEBHOOK_SECRET });
  assert.equal((await webhook(stripeRequest(signature))).status, 500);
  assert.equal((await state()).orders[0].status, 'paid');
  assert.equal((await state()).products[0].quantity, 3);
  assert.deepEqual([adminEmails, customerAttempts, adjustments.length], [1, 1, 1]);
  assert.equal(adjustments[0].changes[0].adjustment.quantity, '2');
  assert.equal(await sql('SELECT jsonb_array_length(square_updates) FROM public.stripe_order_effects;'), '0');
  const confirm = load('app/api/stripe/complete/route.ts').POST;
  const response = await confirm(new Request('https://example.test/api/stripe/complete', {
    method: 'POST', body: JSON.stringify({ sessionId: session.id }), headers: { 'Content-Type': 'application/json' },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, confirmed: true, status: 'paid' });
  assert.equal((await webhook(stripeRequest(signature))).status, 200);
  assert.deepEqual([adminEmails, customerAttempts, adjustments.length], [1, 2, 1]);
  assert.equal((await state()).products[0].quantity, 3);
  assert.equal(await sql('SELECT admin_email_sent_at IS NOT NULL AND customer_email_sent_at IS NOT NULL AND lease_token IS NULL FROM public.stripe_order_effects;'), 't');
  const square = load('app/api/square/webhook/route.ts').POST;
  const squareBody = JSON.stringify({ type: 'inventory.count.updated', data: { object: { inventory_counts: [{
    catalog_object_id: 'variation_a', location_id: env.SQUARE_LOCATION_ID, state: 'IN_STOCK',
    quantity: '4', calculated_at: '2026-11-03T11:00:00Z',
  }] } } });
  const squareSignature = createHmac('sha256', env.SQUARE_WEBHOOK_SIGNATURE_KEY).update(env.SQUARE_WEBHOOK_URL + squareBody).digest('base64');
  const squareRequest = signature => new Request(env.SQUARE_WEBHOOK_URL, {
    method: 'POST', body: squareBody, headers: { 'x-square-hmacsha256-signature': signature },
  });
  assert.equal((await square(squareRequest('invalid'))).status, 401);
  assert.equal((await square(squareRequest(squareSignature))).status, 200);
  assert.equal((await state()).products[0].quantity, 3, 'stale signed Square count must not restore sold stock');
});
