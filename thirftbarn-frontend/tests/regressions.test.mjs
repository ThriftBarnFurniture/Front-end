import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loader } from './helpers/load-ts.mjs';

const nodeRequire = createRequire(import.meta.url);
function database(results) {
  const calls = [];
  const from = table => {
    const call = { table, filters: [], payload: null };
    calls.push(call);
    const result = () => {
      assert.ok(results.length, `Unexpected database request: ${table}`);
      return Promise.resolve(results.shift());
    };
    const query = {
      select() { return query; },
      eq(...args) { call.filters.push(args); return query; },
      in(...args) { call.filters.push(args); return query; },
      update(payload) { call.payload = payload; return query; },
      insert(payload) { call.payload = payload; return query; },
      maybeSingle: result, single: result,
      then(onValue, onError) { return result().then(onValue, onError); },
    };
    return query;
  };
  return { from, calls };
}

const id = '11111111-1111-4111-8111-111111111111';
const sessionId = 'cs_test_fixture';
const item = { product_id: id, quantity: 2, unit_price_cents: 1000, name: 'Original name' };
const snapshot = {
  order_id: id, order_number: 'TB-test', status: 'pending', stripe_session_id: sessionId,
  items: [JSON.stringify(item)], subtotal: 20, total: 25, tax: 0, shipping_cost: 5,
  promo_discount: 0, currency: 'cad', customer_name: 'Private Name', customer_email: 'private@example.test',
  customer_phone: 'private phone', shipping_address: 'private address', stripe_email: 'private@example.test',
};
const session = { id: sessionId, metadata: { order_id: id }, payment_status: 'paid', amount_total: 2500, currency: 'cad', payment_intent: 'pi_fixture' };
const helpers = loader()('lib/checkout-validation.ts');

test('duplicate cart lines are aggregated before stock validation', () => {
  assert.deepEqual(helpers.normalizeCheckoutItems([{ productId: id, quantity: 2 }, { productId: id, quantity: 3 }]), [{ productId: id, quantity: 5 }]);
  for (const quantity of [0, -1, 1.5, NaN, Infinity, '2', 1000000]) {
    assert.throws(() => helpers.normalizeCheckoutItems([{ productId: id, quantity }]));
  }
  assert.throws(() => helpers.normalizeCheckoutItems(Array(51).fill({ productId: id, quantity: 1 })));
});

test('existing text-array snapshots and mismatched payment amounts', () => {
  const items = helpers.readOrderItemSnapshot(snapshot.items);
  assert.deepEqual(items, [item]);
  const args = { items, wanted: [{ productId: id, quantity: 2 }], subtotal: 20, total: 25, currency: 'cad', amountTotal: 2500, paymentCurrency: 'cad' };
  assert.doesNotThrow(() => helpers.validatePaymentSnapshot(args));
  assert.throws(() => helpers.validatePaymentSnapshot({ ...args, amountTotal: 2400 }));
  assert.throws(() => helpers.validatePaymentSnapshot({ ...args, paymentCurrency: 'usd' }));
  assert.throws(() => helpers.validatePaymentSnapshot({ ...args, wanted: [{ productId: id, quantity: 1 }] }));
});

test('unpaid sessions cannot fulfill; zero-dollar settled sessions are supported', () => {
  assert.equal(helpers.isPaymentSettled('unpaid', 2500), false);
  assert.equal(helpers.isPaymentSettled('no_payment_required', 0), true);
  assert.equal(helpers.isPaymentSettled('no_payment_required', 2500), false);
});

test('receipt credentials are bound to session, signature and expiration', () => {
  const tokens = loader()('lib/receipt-token.ts');
  const token = tokens.createReceiptToken(sessionId, 'test-secret', 1000);
  assert.equal(tokens.verifyReceiptToken(token, sessionId, 'test-secret', 1000), true);
  assert.equal(tokens.verifyReceiptToken(token, 'cs_test_another', 'test-secret', 1000), false);
  assert.equal(tokens.verifyReceiptToken(token, sessionId, 'different-secret', 1000), false);
  assert.equal(tokens.verifyReceiptToken(token + 'x', sessionId, 'test-secret', 1000), false);
  assert.equal(tokens.verifyReceiptToken(token, sessionId, 'test-secret', 1000 + tokens.RECEIPT_MAX_AGE * 1000), false);
});

test('request quotas expire and produce retry headers', async () => {
  const limits = loader()('lib/request-limits.ts');
  assert.equal(limits.checkRequestLimit('test', 1, 1000, 0).allowed, true);
  assert.equal(limits.checkRequestLimit('test', 1, 1000, 1).allowed, false);
  assert.equal(limits.checkRequestLimit('test', 1, 1000, 1000).allowed, true);
  const request = new Request('https://example.test', { headers: { 'x-vercel-forwarded-for': '192.0.2.1' } });
  assert.equal(limits.rateLimitRequest(request, 'route-test', 1, 1000), null);
  const response = limits.rateLimitRequest(request, 'route-test', 1, 1000);
  assert.equal(response.status, 429);
  assert.ok(response.headers.get('retry-after'));
});

test('fulfillment preserves checkout snapshot when catalog prices change', async () => {
  const db = database([
    { data: snapshot },
    { data: [{ id, name: 'Renamed item', price: 1, quantity: 5, is_active: true }] },
    { data: { order_id: id } },
    { data: { quantity: 3, square_variation_id: null } },
    { data: { ...snapshot, status: 'paid' } },
  ]);
  const { fulfillStripeCheckoutSession } = loader({
    '@/lib/supabase-admin': { createSupabaseAdmin: () => db },
    '@/lib/square/inventory': { setSquareInStockCount: () => assert.fail('Unexpected Square write') },
  })('lib/stripe-fullfillment.ts');
  const result = await fulfillStripeCheckoutSession(session);
  assert.equal(result.subtotal, 20);
  assert.equal(result.items[0].name, 'Original name');
  assert.equal(result.items[0].unitPrice, 10);
  const orderWrite = db.calls.find(c => c.table === 'orders' && c.payload);
  assert.equal(Object.hasOwn(orderWrite.payload, 'items'), false);
  assert.equal(Object.hasOwn(orderWrite.payload, 'subtotal'), false);
  assert.equal(Object.hasOwn(orderWrite.payload, 'tax'), false);
  assert.ok(orderWrite.filters.some(([key, value]) => key === 'status' && value === 'pending'));
  assert.equal(db.calls.find(c => c.table === 'products' && c.payload).payload.quantity, 3);
});

test('fulfillment rejects unpaid or mismatched amounts without writes and skips paid duplicates', async () => {
  for (const variant of ['unpaid', 'mismatch', 'duplicate']) {
    const db = database(variant === 'unpaid' ? [] : [{ data: { ...snapshot, status: variant === 'duplicate' ? 'paid' : 'pending' } }]);
    const { fulfillStripeCheckoutSession } = loader({
      '@/lib/supabase-admin': { createSupabaseAdmin: () => db },
      '@/lib/square/inventory': { setSquareInStockCount: () => assert.fail('Unexpected Square write') },
    })('lib/stripe-fullfillment.ts');
    if (variant === 'duplicate') assert.equal((await fulfillStripeCheckoutSession(session)).duplicate, true);
    else await assert.rejects(fulfillStripeCheckoutSession({ ...session, payment_status: variant === 'unpaid' ? 'unpaid' : 'paid', amount_total: variant === 'mismatch' ? 2400 : 2500 }));
    assert.equal(db.calls.some(c => c.payload), false);
  }
});

test('receipt lookup redacts personal fields unless browser token or owner matches', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-secret';
  const tokens = loader()('lib/receipt-token.ts');
  for (const variant of ['guest', 'cookie', 'owner', 'other-user']) {
    const db = database([{ data: { ...snapshot, user_id: 'owner' } }]);
    const { POST } = loader({
      '@/lib/supabase-admin': { createSupabaseAdmin: () => db },
      'next/headers': { cookies: async () => ({ get: () => variant === 'cookie' ? { value: tokens.createReceiptToken(sessionId, 'test-only-secret') } : undefined }) },
      '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: variant === 'owner' ? { id: 'owner' } : { id: 'someone-else' } } }) } }) },
      '@/lib/request-limits': { rateLimitRequest: () => null },
    })('app/api/orders/by-session/route.ts');
    const response = await POST(new Request('https://example.test/api/orders/by-session', { method: 'POST', body: JSON.stringify({ sessionId }) }));
    assert.equal(response.status, 200);
    const body = await response.json();
    const allowed = variant === 'cookie' || variant === 'owner';
    assert.equal(body.order.private_details_available, allowed);
    assert.equal(body.order.customer_email, allowed ? snapshot.customer_email : null);
    assert.equal(body.order.shipping_address, allowed ? snapshot.shipping_address : null);
    assert.equal(Object.hasOwn(body.order, 'user_id'), false);
    assert.equal(Object.hasOwn(body.order, 'stripe_session_id'), false);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
});

test('payment confirmation returns status without customer details', async () => {
  const { POST } = loader({
    '@/lib/stripe': { getStripe: () => ({ checkout: { sessions: { retrieve: async () => session } } }) },
    '@/lib/stripe-fullfillment': { fulfillStripeCheckoutSession: async () => ({ ...snapshot, duplicate: true, status: 'paid' }) },
    '@/lib/brevo': { sendAdminOrderEmail: () => assert.fail('duplicate email'), sendCustomerOrderEmail: () => assert.fail('duplicate email') },
    '@/lib/request-limits': { rateLimitRequest: () => null },
  })('app/api/stripe/complete/route.ts');
  const response = await POST(new Request('https://example.test/api/stripe/complete', { method: 'POST', body: JSON.stringify({ sessionId }) }));
  assert.deepEqual(await response.json(), { received: true, confirmed: true, status: 'paid' });
});

test('Square database errors trigger retries; unlimited products are preserved', async () => {
  const crypto = nodeRequire('node:crypto');
  process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = 'test-signature';
  process.env.SQUARE_WEBHOOK_URL = 'https://example.test/square';
  process.env.SQUARE_LOCATION_ID = 'test-location';
  const event = { type: 'inventory.count.updated', data: { object: { inventory_counts: [{ catalog_object_id: 'variation', location_id: 'test-location', state: 'IN_STOCK', quantity: '2' }] } } };
  const body = JSON.stringify(event);
  const signature = crypto.createHmac('sha256', 'test-signature').update('https://example.test/square' + body).digest('base64');
  for (const variant of ['lookup-error', 'update-error', 'unlimited', 'success']) {
    const results = variant === 'lookup-error' ? [{ error: { message: 'test lookup failure' } }]
      : variant === 'unlimited' ? [{ data: { id, quantity: 999999999 } }]
      : [{ data: { id, quantity: 3 } }, { error: variant === 'update-error' ? { message: 'test write failure' } : null }];
    const db = database(results);
    const { POST } = loader({ '../../../../utils/supabase/admin': { createAdminClient: () => db } })('app/api/square/webhook/route.ts');
    const response = await POST(new Request('https://example.test/square', { method: 'POST', body, headers: { 'x-square-hmacsha256-signature': signature } }));
    assert.equal(response.status, variant.endsWith('error') ? 500 : 200);
    if (variant === 'unlimited') assert.equal(db.calls.some(c => c.payload), false);
  }
});

test('cart storage preserves valid legacy lines and tolerates damaged or blocked storage', (t) => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else delete globalThis.window;
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete globalThis.localStorage;
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  const line = { productId: id, name: 'Chair', quantity: 2, price: 25 };
  let stored = JSON.stringify([null, {}, line, { ...line, quantity: -1 }, { ...line, price: '25' }, { ...line, quantity: 1.5 }]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => stored,
    setItem: () => { throw new Error('Storage quota exceeded'); },
    removeItem: () => { throw new Error('Storage denied'); },
  } });
  const cart = loader()('lib/cart.ts');
  assert.deepEqual(cart.readCart(), [line]);
  assert.doesNotThrow(() => cart.writeCart([line]));
  assert.doesNotThrow(() => cart.clearCartStorage());
  for (const broken of ['{invalid', '{}', 'null']) {
    stored = broken;
    assert.deepEqual(cart.readCart(), []);
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('Storage denied'); } });
  assert.deepEqual(cart.readCart(), []);
  assert.doesNotThrow(() => cart.writeCart([line]));
  assert.doesNotThrow(() => cart.clearCartStorage());
});

test('session refresh forwards every cookie chunk to the request and browser', async () => {
  const { NextRequest } = nodeRequire('next/server.js');
  const request = new NextRequest('https://example.test/shop', { headers: { cookie: 'existing=kept' } });
  const { updateSession } = loader({
    '@supabase/ssr': { createServerClient: (_url, _key, { cookies }) => ({ auth: { getUser: async () => {
      assert.ok(cookies.getAll().some(c => c.name === 'existing'));
      cookies.setAll([
        { name: 'session.0', value: 'first', options: { path: '/', httpOnly: true } },
        { name: 'session.1', value: 'second', options: { path: '/', httpOnly: true } },
      ]);
      cookies.setAll([{ name: 'obsolete', value: '', options: { path: '/', maxAge: 0 } }]);
    } } }) },
  })('utils/supabase/middleware.ts');
  const response = await updateSession(request);
  assert.equal(response.cookies.get('session.0')?.value, 'first');
  assert.equal(response.cookies.get('session.1')?.value, 'second');
  assert.equal(response.cookies.get('obsolete')?.maxAge, 0);
  assert.equal(request.cookies.get('session.0')?.value, 'first');
  assert.equal(request.cookies.get('session.1')?.value, 'second');
  assert.match(response.headers.get('x-middleware-request-cookie'), /session\.0=first/);
  assert.match(response.headers.get('x-middleware-request-cookie'), /session\.1=second/);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
});

test('bulk Square sync requires a secret or an administrator before touching products', async (t) => {
  const originalSecret = process.env.POS_SYNC_SECRET;
  t.after(() => { if (originalSecret === undefined) delete process.env.POS_SYNC_SECRET; else process.env.POS_SYNC_SECRET = originalSecret; });
  for (const variant of ['guest', 'customer', 'profile-error', 'admin', 'bad-secret', 'secret']) {
    if (variant.includes('secret')) process.env.POS_SYNC_SECRET = 'fixture-secret';
    else delete process.env.POS_SYNC_SECRET;
    let productReads = 0;
    const { POST } = loader({
      '@/utils/supabase/server': { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: variant === 'guest' ? null : { id: 'user' } } }) },
        from: table => {
          if (table === 'profiles') return { select: () => ({ eq: () => ({ single: async () => ({ data: { is_admin: variant === 'admin' }, error: variant === 'profile-error' ? new Error('DB unavailable') : null }) }) }) };
          assert.equal(table, 'products');
          productReads++;
          return { select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) };
        },
      }) },
      '@/lib/square/catalog': { upsertSquareCatalogObject: () => assert.fail('Live Square write'), upsertSquareImageIfPossible: () => assert.fail('Live Square image write') },
    })('app/api/square/sync-products/route.ts');
    const response = await POST(new Request('https://example.test/api/square/sync-products', { method: 'POST', headers: { 'x-pos-sync-secret': variant === 'secret' ? 'fixture-secret' : 'wrong' } }));
    const allowed = variant === 'admin' || variant === 'secret';
    assert.equal(response.status, allowed ? 200 : variant === 'guest' || variant === 'bad-secret' ? 401 : 403);
    assert.equal(productReads, allowed ? 1 : 0);
  }
});

test('account deletion keeps authentication until server success and handles failures', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalAlert = globalThis.alert;
  t.after(() => { globalThis.fetch = originalFetch; if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; if (originalAlert === undefined) delete globalThis.alert; else globalThis.alert = originalAlert; });
  globalThis.window = { confirm: () => true };
  for (const variant of ['success', 'rejected', 'redirect', 'network']) {
    const events = [];
    globalThis.alert = () => events.push('alert');
    globalThis.fetch = async () => {
      events.push('delete');
      if (variant === 'network') throw new Error('Offline');
      if (variant === 'redirect') return { ok: true, redirected: true, headers: new Headers({ 'content-type': 'text/html' }), text: async () => 'Sign in' };
      return Response.json(variant === 'success' ? { ok: true } : { error: 'Deletion failed' }, { status: variant === 'success' ? 200 : 400 });
    };
    const { default: DeleteAccountButton } = loader({
      react: { useState: () => [false, value => events.push(`loading:${value}`)] },
      'next/navigation': { useRouter: () => ({ push: path => events.push(`navigate:${path}`), refresh: () => events.push('refresh') }) },
      '@/utils/supabase/client': { createClient: () => ({ auth: { signOut: async () => events.push('signout') } }) },
      './account.module.css': {},
    })('app/account/DeleteAccountButton.tsx');
    await DeleteAccountButton().props.onClick();
    assert.deepEqual(events, variant === 'success'
      ? ['loading:true', 'delete', 'signout', 'navigate:/', 'refresh', 'loading:false']
      : ['loading:true', 'delete', 'alert', 'loading:false']);
  }
});

function atomicMode(t) {
  const previous = process.env.STRIPE_ATOMIC_FULFILLMENT;
  process.env.STRIPE_ATOMIC_FULFILLMENT = 'true';
  t.after(() => { if (previous === undefined) delete process.env.STRIPE_ATOMIC_FULFILLMENT; else process.env.STRIPE_ATOMIC_FULFILLMENT = previous; });
}

test('atomic fulfillment delegates all order and stock writes to one database transaction', async (t) => {
  atomicMode(t);
  const db = database([{ data: snapshot }]);
  const rpcCalls = [];
  db.rpc = async (name, args) => {
    rpcCalls.push({ name, args });
    return { data: { duplicate: false, order: { ...snapshot, status: 'paid' } } };
  };
  let deliveries = 0;
  const { fulfillStripeCheckoutSession } = loader({
    '@/lib/supabase-admin': { createSupabaseAdmin: () => db },
    '@/lib/stripe-order-effects': { deliverStripeOrderEffects: async () => { deliveries++; return false; } },
  })('lib/stripe-fullfillment.ts');
  const result = await fulfillStripeCheckoutSession(session);
  assert.equal(result.effectsManaged, true);
  assert.equal(result.effectsPending, false);
  assert.equal(result.items[0].name, 'Original name');
  assert.equal(deliveries, 1);
  assert.equal(db.calls.some(call => call.payload), false);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, 'finalize_stripe_checkout_v1');
  assert.equal(rpcCalls[0].args.p_amount_total_cents, 2500);
  assert.equal(rpcCalls[0].args.p_order_id, id);
});

test('atomic duplicates retry durable effects; delivery failure does not undo payment confirmation', async (t) => {
  atomicMode(t);
  const db = database([{ data: { ...snapshot, status: 'paid' } }]);
  db.rpc = async () => ({ data: { duplicate: true, order: { ...snapshot, status: 'paid' } } });
  let deliveries = 0;
  const { fulfillStripeCheckoutSession } = loader({
    '@/lib/supabase-admin': { createSupabaseAdmin: () => db },
    '@/lib/stripe-order-effects': { deliverStripeOrderEffects: async () => { deliveries++; throw new Error('Provider unavailable'); } },
  })('lib/stripe-fullfillment.ts');
  const result = await fulfillStripeCheckoutSession(session);
  assert.equal(result.duplicate, true);
  assert.equal(result.status, 'paid');
  assert.equal(result.effectsPending, true);
  assert.equal(deliveries, 1);
});

test('atomic failure never falls back to separate stock writes', async (t) => {
  atomicMode(t);
  const db = database([{ data: snapshot }]);
  db.rpc = async () => ({ error: { message: 'Transaction rolled back' } });
  const { fulfillStripeCheckoutSession } = loader({
    '@/lib/supabase-admin': { createSupabaseAdmin: () => db },
    '@/lib/stripe-order-effects': { deliverStripeOrderEffects: () => assert.fail('Delivery before commit') },
  })('lib/stripe-fullfillment.ts');
  await assert.rejects(fulfillStripeCheckoutSession(session), /Transaction rolled back/);
  assert.equal(db.calls.some(call => call.payload), false);
});

test('durable effects retry only failed work without repeating acknowledged mail', async () => {
  const work = { order_id: id, stripe_session_id: sessionId, square_updates: [{ productId: id, variationId: 'variation', quantity: 3, soldQuantity: 2 }], admin_email_sent_at: null, customer_email_sent_at: null, created_at: '2026-11-03T12:00:00Z' };
  let first = true;
  let adminEmails = 0, customerEmails = 0, squareAttempts = 0;
  const db = {
    rpc: async name => {
      if (name === 'claim_stripe_order_effects_v1') return { data: structuredClone(work) };
      assert.equal(name, 'apply_square_inventory_count_v1');
      work.square_updates = [];
      return { data: true };
    },
    from: table => {
      assert.equal(table, 'stripe_order_effects');
      const query = {
        update(fields) { Object.assign(work, fields); return query; },
        eq() { return query; }, select() { return query; },
        maybeSingle: async () => ({ data: { order_id: id } }),
      };
      return query;
    },
  };
  const { deliverStripeOrderEffects } = loader({
    '@/lib/supabase-admin': { createSupabaseAdmin: () => db },
    '@/lib/square/inventory': { recordSquareSale: async args => {
      squareAttempts++;
      assert.equal(args.quantity, 2);
      assert.equal(args.occurredAt, work.created_at);
      if (first) throw new Error('Square offline');
      return { quantity: 3, calculatedAt: work.created_at };
    } },
    '@/lib/brevo': {
      sendAdminOrderEmail: async () => { adminEmails++; },
      sendCustomerOrderEmail: async () => { customerEmails++; if (first) throw new Error('SMTP offline'); },
    },
  })('lib/stripe-order-effects.ts');
  const order = { ...snapshot, order_id: id, status: 'paid' };
  assert.equal(await deliverStripeOrderEffects(order), true);
  assert.equal(work.square_updates.length, 1);
  assert.ok(work.admin_email_sent_at);
  assert.equal(work.customer_email_sent_at, null);
  assert.equal(work.lease_token, null);
  first = false;
  assert.equal(await deliverStripeOrderEffects(order), false);
  assert.deepEqual([adminEmails, customerEmails, squareAttempts], [1, 2, 2]);
  assert.equal(work.square_updates.length, 0);
});

test('Square sale retries preserve the delta, event time and idempotency key', async (t) => {
  const previous = process.env.SQUARE_LOCATION_ID;
  process.env.SQUARE_LOCATION_ID = 'location';
  t.after(() => { if (previous === undefined) delete process.env.SQUARE_LOCATION_ID; else process.env.SQUARE_LOCATION_ID = previous; });
  const calls = [];
  const { recordSquareSale } = loader({
    '@/lib/square': { squareFetch: async (path, options) => {
      calls.push({ path, body: JSON.parse(options.body) });
      return { counts: [{ catalog_object_id: 'variation', location_id: 'location', state: 'IN_STOCK', quantity: '3', calculated_at: '2026-11-03T12:00:01Z' }] };
    } },
  })('lib/square/inventory.ts');
  const args = { variationId: 'variation', quantity: 2, sessionId, productId: id, occurredAt: '2026-11-03T12:00:00Z' };
  await recordSquareSale(args); await recordSquareSale(args);
  assert.equal(calls[0].body.idempotency_key, calls[2].body.idempotency_key);
  assert.ok(calls[0].body.idempotency_key.length <= 128);
  assert.equal(calls[0].body.changes[0].type, 'ADJUSTMENT');
  assert.equal(calls[0].body.changes[0].adjustment.quantity, '2');
  assert.equal(calls[0].body.changes[0].adjustment.occurred_at, args.occurredAt);
  assert.equal(calls[1].path, '/inventory/counts/batch-retrieve');
});

test('Stripe webhook requests retries for pending durable work without resending email inline', async () => {
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = 'test-only';
  try {
    for (const pending of [true, false]) {
      const { POST } = loader({
        '@/lib/stripe': { getStripe: () => ({ webhooks: { constructEvent: () => ({ type: 'checkout.session.completed', data: { object: session } }) } }) },
        '@/lib/stripe-fullfillment': { fulfillStripeCheckoutSession: async () => ({ ...snapshot, duplicate: true, status: 'paid', effectsManaged: true, effectsPending: pending }) },
        '@/lib/brevo': { sendAdminOrderEmail: () => assert.fail('Inline admin email'), sendCustomerOrderEmail: () => assert.fail('Inline customer email') },
      })('app/api/stripe/webhook/route.ts');
      const response = await POST(new Request('https://example.test/webhook', { method: 'POST', headers: { 'stripe-signature': 'fixture' }, body: '{}' }));
      assert.equal(response.status, pending ? 500 : 200);
    }
  } finally {
    if (previous === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previous;
  }
});

test('customer confirmation stays successful while durable notification delivery is pending', async () => {
  const { POST } = loader({
    '@/lib/stripe': { getStripe: () => ({ checkout: { sessions: { retrieve: async () => session } } }) },
    '@/lib/stripe-fullfillment': { fulfillStripeCheckoutSession: async () => ({ ...snapshot, duplicate: false, status: 'paid', effectsManaged: true, effectsPending: true }) },
    '@/lib/brevo': { sendAdminOrderEmail: () => assert.fail('Duplicate admin email'), sendCustomerOrderEmail: () => assert.fail('Duplicate customer email') },
    '@/lib/request-limits': { rateLimitRequest: () => null },
  })('app/api/stripe/complete/route.ts');
  const response = await POST(new Request('https://example.test/complete', { method: 'POST', body: JSON.stringify({ sessionId }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, confirmed: true, status: 'paid' });
});

test('atomic Square webhooks use timestamp-aware reconciliation and retry database failures', async (t) => {
  atomicMode(t);
  const crypto = nodeRequire('node:crypto');
  const body = JSON.stringify({ type: 'inventory.count.updated', data: { object: { inventory_counts: [{ catalog_object_id: 'variation', location_id: 'test-location', state: 'IN_STOCK', quantity: '2', calculated_at: '2026-11-03T12:00:00Z' }] } } });
  // The earlier signed-webhook fixture sets this test-only key, URL and location.
  const signature = crypto.createHmac('sha256', 'test-signature').update('https://example.test/square' + body).digest('base64');
  for (const fail of [false, true]) {
    const calls = [];
    const { POST } = loader({ '../../../../utils/supabase/admin': { createAdminClient: () => ({
      from: () => assert.fail('Separate inventory writes'),
      rpc: async (name, args) => { calls.push({ name, args }); return fail ? { error: { message: 'DB unavailable' } } : { data: true }; },
    }) } })('app/api/square/webhook/route.ts');
    const response = await POST(new Request('https://example.test/square', { method: 'POST', body, headers: { 'x-square-hmacsha256-signature': signature } }));
    assert.equal(response.status, fail ? 500 : 200);
    assert.equal(calls[0].name, 'apply_square_inventory_count_v1');
    assert.equal(calls[0].args.p_calculated_at, '2026-11-03T12:00:00Z');
  }
});

test('delivery retry endpoint requires an administrator before dispatching work', async (t) => {
  atomicMode(t);
  const path = 'app/api/admin/orders/[orderId]/retry-delivery/route.ts';
  const rejected = loader({
    '@/lib/require-admin': { requireAdmin: async () => { throw new Error('Unauthorized'); } },
    '@/lib/stripe-fullfillment': { retryStripeOrderDelivery: () => assert.fail('Unauthorized retry') },
  })(path);
  await assert.rejects(rejected.POST(new Request('https://example.test'), { params: Promise.resolve({ orderId: id }) }), /Unauthorized/);
  const allowed = loader({
    '@/lib/require-admin': { requireAdmin: async () => ({ user: { id: 'admin' } }) },
    '@/lib/stripe-fullfillment': { retryStripeOrderDelivery: async orderId => { assert.equal(orderId, id); return false; } },
  })(path);
  const response = await allowed.POST(new Request('https://example.test'), { params: Promise.resolve({ orderId: id }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, pending: false });
});

test('installed Nodemailer composes the existing message and photo attachment format without delivery', async () => {
  const nodemailer = nodeRequire('nodemailer');
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const message = await transport.sendMail({
    from: { name: 'Thrift Barn Furniture', address: 'store@example.test' },
    to: [{ name: 'Test Customer', address: 'customer@example.test' }],
    replyTo: { name: 'Test Customer', address: 'customer@example.test' },
    subject: 'Service request fixture', text: 'Fixture details', html: '<p>Fixture details</p>',
    attachments: [{ filename: 'fixture.jpg', content: Buffer.from('test photo'), contentType: 'image/jpeg' }],
  });
  assert.deepEqual(message.envelope.to, ['customer@example.test']);
  const source = message.message.toString('utf8');
  assert.match(source, /Subject: Service request fixture/);
  assert.match(source, /Content-Type: multipart\/mixed/);
  assert.match(source, /Content-Type: image\/jpeg/);
  assert.match(source, /filename=fixture.jpg/);
});
