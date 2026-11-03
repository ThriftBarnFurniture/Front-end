// Read-only REST inspection. Run from the repository root with Node 24+.
// Reads .env.local; never prints keys, customer details, or individual records.
// Writes schema metadata and aggregate observations to docs/database-snapshot.json.
import { writeFileSync } from 'node:fs';

process.loadEnvFile('.env.local');
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const keys = {
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anonymous: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};
if (!base || !keys.service || !keys.anonymous) throw new Error('Missing Supabase configuration');

async function read(path, role = 'service', method = 'GET') {
  const response = await fetch(new URL(`/rest/v1/${path}`, base), {
    method,
    headers: { apikey: keys[role], Authorization: `Bearer ${keys[role]}`, Prefer: 'count=exact' },
    signal: AbortSignal.timeout(30000),
  });
  const body = method === 'HEAD' ? null : await response.json();
  return { status: response.status, range: response.headers.get('content-range'), body };
}

async function rows(table, columns, primaryKey) {
  const all = [];
  for (let offset = 0; offset < 100000;) {
    const response = await read(`${table}?select=${columns}&order=${primaryKey}.asc&limit=1000&offset=${offset}`);
    if (response.status >= 400 || !Array.isArray(response.body)) throw new Error(`Cannot read ${table}: HTTP ${response.status}`);
    all.push(...response.body);
    const total = Number(response.range?.split('/')[1]);
    if (!response.body.length || (Number.isFinite(total) && all.length >= total)) return all;
    offset += response.body.length;
  }
  throw new Error(`Safety row cap exceeded for ${table}`);
}

const schema = await read('');
if (schema.status !== 200 || !schema.body.definitions) throw new Error('Cannot read schema');
const tables = Object.keys(schema.body.definitions);
const counts = Object.fromEntries(await Promise.all(tables.map(async table => {
  const pk = table === 'orders' ? 'order_id' : table === 'estate_sales' ? 'slug' : 'id';
  const entries = await Promise.all(Object.keys(keys).map(async role => {
    const result = await read(`${table}?select=${pk}&limit=1`, role, 'HEAD');
    return [role, { status: result.status, contentRange: result.range }];
  }));
  return [table, Object.fromEntries(entries)];
})));
const anonymousSchema = await read('', 'anonymous');
const [products, orders, promos, profiles, estates] = await Promise.all([
  rows('products', 'id,sku,barcode,price,initial_price,quantity,is_active,category,subcategory,collections,colors,room_tags,image_url,image_urls,created_by,is_barn_burner,barn_burner_day,barn_burner_started_at,barn_burner_last_tick,is_monthly_price_drop,monthly_drop_started_at,monthly_drop_last_tick,monthly_drop_amount,square_item_id,square_variation_id,square_image_id', 'id'),
  rows('orders', 'order_id,order_number,status,channel,user_id,stripe_session_id,payment_id,stripe_refund_id,items,subtotal,tax,total,amount_total_cents,shipping_cost,promo_discount,promo_code,currency,shipping_method,purchase_date,fulfilled_at,refunded_at,shipping_distance_km,overweight_fee', 'order_id'),
  rows('promos', 'id,code,percent_off,amount_off,is_active,starts_at,ends_at', 'id'),
  rows('profiles', 'id,is_admin', 'id'),
  rows('estate_sales', 'slug,photo_url', 'slug'),
]);
const count = (list, predicate) => list.filter(predicate).length;
const group = (list, field) => list.reduce((out, row) => {
  const key = row[field] == null ? '(null)' : String(row[field]);
  out[key] = (out[key] || 0) + 1;
  return out;
}, {});
const duplicateGroups = (list, field) => Object.values(group(list.filter(x => x[field] != null), field)).filter(n => n > 1).length;
const productIds = new Set(products.map(x => x.id));
const profileIds = new Set(profiles.map(x => x.id));
const estateSlugs = new Set(estates.map(x => x.slug));
const promoCodes = new Set(promos.map(x => x.code?.toUpperCase()));
const itemStats = { total: 0, strings: 0, objects: 0, invalidJson: 0, missingProduct: 0, invalidQuantity: 0, missingPrice: 0, keys: [] };
const itemKeys = new Set();
let snapshotSubtotalMismatches = 0;
for (const order of orders) {
  let subtotalCents = 0;
  let valid = true;
  for (const raw of order.items ?? []) {
    itemStats.total++;
    itemStats[typeof raw === 'string' ? 'strings' : 'objects']++;
    let item = raw;
    if (typeof raw === 'string') {
      try { item = JSON.parse(raw); } catch { itemStats.invalidJson++; valid = false; continue; }
    }
    if (!item || typeof item !== 'object') { valid = false; continue; }
    Object.keys(item).forEach(key => itemKeys.add(key));
    const id = item.product_id ?? item.productId ?? item.id;
    if (!productIds.has(id)) itemStats.missingProduct++;
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) itemStats.invalidQuantity++;
    if (typeof item.unit_price_cents !== 'number') { itemStats.missingPrice++; valid = false; }
    subtotalCents += Number(item.quantity) * Number(item.unit_price_cents);
  }
  if (valid && Math.abs(subtotalCents - Math.round(Number(order.subtotal) * 100)) > 1) snapshotSubtotalMismatches++;
}
itemStats.keys = [...itemKeys].sort();
const now = Date.now();
const snapshot = {
  inspectedAt: new Date().toISOString(),
  scope: 'Configured Supabase REST API; no SQL catalog access; GET and HEAD only; non-transactional snapshot',
  definitions: schema.body.definitions,
  rpcMetadata: Object.fromEntries(Object.entries(schema.body.paths).filter(([path]) => path.startsWith('/rpc/'))),
  anonymousSchemaStatus: anonymousSchema.status,
  anonymousRpcPaths: Object.keys(anonymousSchema.body?.paths ?? {}).filter(path => path.startsWith('/rpc/')),
  counts,
  products: {
    total: products.length, active: count(products, x => x.is_active), unlimited: count(products, x => x.quantity >= 1000000),
    negativeQuantity: count(products, x => x.quantity < 0), activeWithoutStock: count(products, x => x.is_active && x.quantity <= 0),
    inactiveWithStock: count(products, x => !x.is_active && x.quantity > 0), negativePrice: count(products, x => Number(x.price) < 0),
    zeroPrice: count(products, x => Number(x.price) === 0), missingInitialPrice: count(products, x => x.initial_price == null),
    missingImages: count(products, x => !x.image_url && !x.image_urls?.length), primaryImageNotInGallery: count(products, x => x.image_url && !x.image_urls?.includes(x.image_url)),
    noCategory: count(products, x => !x.category?.length), noColors: count(products, x => !x.colors?.length),
    duplicateSkuGroups: duplicateGroups(products, 'sku'), duplicateBarcodeGroups: duplicateGroups(products, 'barcode'), duplicateSquareVariationGroups: duplicateGroups(products, 'square_variation_id'),
    squareLinked: count(products, x => Boolean(x.square_variation_id)),
    creatorWithoutProfile: count(products, x => x.created_by && !profileIds.has(x.created_by)),
    barnBurner: count(products, x => x.is_barn_burner), monthlyDrop: count(products, x => x.is_monthly_price_drop), bothPricePrograms: count(products, x => x.is_barn_burner && x.is_monthly_price_drop),
    barnBurnerWithoutStart: count(products, x => x.is_barn_burner && !x.barn_burner_started_at), monthlyWithoutStart: count(products, x => x.is_monthly_price_drop && !x.monthly_drop_started_at),
    barnBurnerWithTick: count(products, x => x.is_barn_burner && x.barn_burner_last_tick), monthlyWithTick: count(products, x => x.is_monthly_price_drop && x.monthly_drop_last_tick),
    estateReferencesMissingMetadata: count(products, x => (x.collections ?? []).some(c => c.startsWith('estate-sale:') && !estateSlugs.has(c.slice('estate-sale:'.length)))),
    legacyEstatePhotoTags: count(products, x => (x.collections ?? []).some(c => c.startsWith('estate-sale-photo:'))),
  },
  orders: {
    total: orders.length, statuses: group(orders, 'status'), channels: group(orders, 'channel'), currencies: group(orders, 'currency'), shippingMethods: group(orders, 'shipping_method'),
    guestOrders: count(orders, x => !x.user_id), userWithoutProfile: count(orders, x => x.user_id && !profileIds.has(x.user_id)),
    duplicateOrderNumberGroups: duplicateGroups(orders, 'order_number'), duplicateStripeSessionGroups: duplicateGroups(orders, 'stripe_session_id'), duplicatePaymentGroups: duplicateGroups(orders, 'payment_id'),
    pendingOlderThan24Hours: count(orders, x => x.status === 'pending' && now - Date.parse(x.purchase_date) > 86400000),
    pendingWithoutSession: count(orders, x => x.status === 'pending' && !x.stripe_session_id),
    paidWithoutPaymentId: count(orders, x => ['paid', 'fulfilled', 'refunded'].includes(x.status) && !x.payment_id),
    refundedWithoutRefundId: count(orders, x => x.status === 'refunded' && !x.stripe_refund_id),
    emptyItems: count(orders, x => !x.items?.length), amountCentsMismatch: count(orders, x => x.amount_total_cents != null && Math.abs(Math.round(Number(x.total) * 100) - x.amount_total_cents) > 1),
    totalBreakdownMismatch: count(orders, x => Math.abs(Number(x.total) - (Number(x.subtotal) + Number(x.tax) + Number(x.shipping_cost) - Number(x.promo_discount))) > 0.011),
    snapshotSubtotalMismatches, items: itemStats,
    promoCodeNotInCurrentPromos: count(orders, x => x.promo_code && !promoCodes.has(x.promo_code.toUpperCase())),
    distanceRecorded: count(orders, x => x.shipping_distance_km != null), overweightFeeRecorded: count(orders, x => Number(x.overweight_fee) > 0),
  },
  promos: { total: promos.length, active: count(promos, x => x.is_active), duplicateCodeGroups: duplicateGroups(promos.map(x => ({ code: x.code.toUpperCase() })), 'code'), invalidDiscountChoice: count(promos, x => (x.percent_off == null) === (x.amount_off == null)), invalidWindow: count(promos, x => x.starts_at && x.ends_at && Date.parse(x.ends_at) <= Date.parse(x.starts_at)) },
  profiles: { total: profiles.length, admins: count(profiles, x => x.is_admin) },
  estateSales: { total: estates.length, withoutPhoto: count(estates, x => !x.photo_url) },
};
writeFileSync('docs/database-snapshot.json', JSON.stringify(snapshot, null, 2) + '\n');
console.log(JSON.stringify({ ...snapshot, definitions: undefined, rpcMetadata: Object.fromEntries(Object.entries(snapshot.rpcMetadata).map(([path, spec]) => [path, { parameters: spec.post?.parameters, response: spec.post?.responses?.['200'] }])) }, null, 2));
