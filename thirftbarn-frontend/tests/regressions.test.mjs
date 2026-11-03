import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import { NextResponse } from 'next/server.js';

const nodeRequire = createRequire(import.meta.url);
function loader(overrides = {}) {
  const cache = new Map();
  const load = (file) => {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path).exports;
    const loadedModule = { exports: {} };
    cache.set(path, loadedModule);
    const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const dependency = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === 'next/server') return { NextResponse };
      if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`);
      return nodeRequire(name);
    };
    runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: path })(dependency, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  };
  return load;
}

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
