// Run against a local production server. All browser POST requests are mocked
// or rejected, so this check cannot create orders, charge cards, or send mail.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.TEST_SITE_URL || 'http://localhost:3028';
// Offline mode exercises static UI and mocked payment/cart responses when the
// server cannot reach Supabase. It does not establish live catalog health.
const offline = process.argv.includes('--offline');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Only a local server may be tested');
const executable = process.env.TEST_CHROME_PATH || 'C:/Users/tonyd/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'thriftbarn-fixes-'));
const browser = spawn(executable, ['--headless=new', ...(process.argv.includes('--no-sandbox') ? ['--no-sandbox'] : []), '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let ws;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Browser startup timeout')), 20000);
    browser.on('error', reject);
    browser.stderr.on('data', data => {
      const match = data.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const pending = new Map();
  const failures = [];
  const passed = [];
  let sequence = 0;
  let paymentMode = 'failed';
  let receiptRequests = 0;
  let stockRequests = 0;
  let soldOut = false;
  let distanceFixture = 20;
  let session;
  function call(method, params = {}, sessionId) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const tab = (method, params) => call(method, params, session);
  const reply = (requestId, status, body) => tab('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) {
      const handler = pending.get(msg.id);
      if (handler) {
        clearTimeout(handler.timer);
        pending.delete(msg.id);
        if (msg.error) handler.reject(new Error(msg.error.message));
        else handler.resolve(msg.result);
      }
    } else if (msg.method === 'Runtime.exceptionThrown') failures.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    else if (msg.method === 'Fetch.requestPaused') {
      const { requestId, request } = msg.params;
      const path = new URL(request.url).pathname;
      let response;
      if (path === '/api/stripe/complete') response = reply(requestId, paymentMode === 'paid' ? 200 : 400, paymentMode === 'paid' ? { confirmed: true, status: 'paid' } : { error: 'Mock unconfirmed payment' });
      else if (path === '/api/cart/stock' && offline) {
        stockRequests++;
        const ids = JSON.parse(request.postData || '{}').productIds || [];
        response = reply(requestId, 200, { stock: Object.fromEntries(ids.map(id => [id, soldOut ? 0 : 2])) });
      }
      else if (path === '/api/google/reviews-count' && offline) response = reply(requestId, 200, { count: 0, rating: 0 });
      else if (path === '/api/shipping/distance' && offline) response = reply(requestId, 200, { distance_km: distanceFixture });
      else if (path === '/api/orders/by-session') {
        receiptRequests++;
        response = reply(requestId, 200, { order: { order_id: 'fixture', order_number: 'TEST', status: 'paid', subtotal: 10, total: 10, tax: 0, currency: 'cad', items: [], private_details_available: false } });
      } else if (path === '/api/checkout/prefill') response = reply(requestId, 200, { signedIn: false });
      else if (request.method !== 'GET' && request.method !== 'HEAD') response = reply(requestId, 400, { error: 'Live writes blocked by browser test' });
      else response = tab('Fetch.continueRequest', { requestId });
      response.catch(error => {
        // Navigating cancels in-flight Next.js prefetches and their interception
        // IDs. Other CDP failures and all page exceptions still fail the check.
        if (error.message !== 'Invalid InterceptionId.') failures.push(error.message);
      });
    }
  };
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  ({ sessionId: session } = await call('Target.attachToTarget', { targetId, flatten: true }));
  await tab('Page.enable');
  await tab('Runtime.enable');
  await tab('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  const evaluate = async expression => {
    const result = await tab('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async expression => {
    const until = Date.now() + 20000;
    while (Date.now() < until) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Browser assertion timed out: ${expression}`);
  };
  const navigate = async path => {
    await tab('Page.navigate', { url: `${base}${path}` });
    await waitFor(`location.pathname === ${JSON.stringify(path.split('?')[0])} && document.readyState === 'complete'`);
  };
  const check = (name, condition) => { assert.ok(condition, name); passed.push(name); console.log(`PASS ${name}`); };

  for (const width of [1440, 390]) {
    await tab('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
    for (const path of offline ? ['/services', '/login', '/signup', '/forgot-password', '/reset-password', '/privacy', '/terms', '/cart'] : ['/', '/shop', '/services']) {
      await navigate(path);
      await waitFor("document.querySelector('h1') !== null");
      check(`${path} ${width}px: one main landmark`, await evaluate("document.querySelectorAll('main').length === 1"));
      check(`${path} ${width}px: no horizontal overflow`, await evaluate('document.documentElement.scrollWidth <= innerWidth'));
      if (['/', '/shop', '/services', '/privacy', '/terms'].includes(path)) check(`${path} ${width}px: canonical URL`, await evaluate(`document.querySelector('link[rel=canonical]')?.href === ${JSON.stringify('https://www.thriftbarnfurniture.ca' + path)}`));
      if (path === '/shop') check(`sort label ${width}px`, await evaluate("document.querySelector('#shop-sort')?.labels?.length === 1"));
      check(`${path} ${width}px: one h1`, await evaluate("document.querySelectorAll('h1').length === 1"));
      if (path === '/services') {
        check(`service selection ${width}px`, await evaluate("document.querySelectorAll('button[aria-pressed=true]').length === 1 && document.querySelector('button[aria-pressed=true]').getAttribute('aria-controls') === 'service-request-panel'"));
        if (offline) {
          const screenshot = await tab('Page.captureScreenshot', { format: 'png' });
          writeFileSync(`docs/maintenance-services-${width}.png`, Buffer.from(screenshot.data, 'base64'));
        }
      }
      if (offline && width === 390) {
        await evaluate("document.querySelector('[aria-controls=mobile-navigation]').click()");
        check(`mobile menu opens on ${path}`, await evaluate("document.querySelector('[aria-controls=mobile-navigation]').getAttribute('aria-expanded') === 'true'"));
        await tab('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await waitFor("document.querySelector('[aria-controls=mobile-navigation]').getAttribute('aria-expanded') === 'false'");
        check(`mobile menu Escape restores focus on ${path}`, await evaluate("document.activeElement === document.querySelector('[aria-controls=mobile-navigation]')"));
      }
    }
  }
  const productPath = offline ? '/item/11111111-1111-4111-8111-111111111111' : await evaluate(`fetch('/sitemap.xml').then(r => r.text()).then(xml => new DOMParser().parseFromString(xml,'application/xml').querySelectorAll('loc')).then(nodes => [...nodes].map(n => new URL(n.textContent).pathname).find(p => p.startsWith('/item/')))`);
  assert.ok(productPath);
  if (!offline) {
    await navigate(productPath);
    check('product has its own canonical and title', await evaluate(`document.querySelector('link[rel=canonical]')?.href.endsWith(location.pathname) && document.title.includes(document.querySelector('h1').textContent)`));
  }
  const productId = productPath.split('/').at(-1);
  const cart = [{ productId, name: 'Browser fixture', quantity: 1, price: 10, is_oversized: offline }];
  const seedCart = () => evaluate(`localStorage.setItem('tb_cart_v1', ${JSON.stringify(JSON.stringify(cart))})`);
  await seedCart();
  await navigate('/checkout/success');
  await waitFor("document.querySelector('h1')?.textContent.includes('No checkout')");
  check('missing payment does not show success or clear cart', await evaluate("JSON.parse(localStorage.getItem('tb_cart_v1')).length === 1"));
  check('checkout success is noindex', await evaluate("document.querySelector('meta[name=robots]')?.content.includes('noindex')"));
  await navigate('/checkout/success?session_id=cs_test_mock');
  await waitFor("document.querySelector('[role=alert]') !== null");
  check('failed verification retains cart and does not fetch receipt', (await evaluate("JSON.parse(localStorage.getItem('tb_cart_v1')).length === 1")) && receiptRequests === 0);
  paymentMode = 'paid';
  await navigate('/checkout/success?session_id=cs_test_paid');
  await waitFor("document.querySelector('h1')?.textContent.includes('Payment confirmed')");
  check('confirmed payment loads receipt then clears cart', (await evaluate("JSON.parse(localStorage.getItem('tb_cart_v1') || '[]').length === 0")) && receiptRequests === 1);
  await seedCart();
  if (offline) {
    soldOut = true;
    await navigate('/cart');
    await waitFor("document.querySelector('input[type=number]') !== null");
    await new Promise(resolve => setTimeout(resolve, 1200));
    const requestsBefore = stockRequests;
    await new Promise(resolve => setTimeout(resolve, 1200));
    check('sold-out cart does not loop through stock requests', stockRequests === requestsBefore && requestsBefore > 0 && requestsBefore < 5);
    check('cart quantity has an accessible name', await evaluate("!!document.querySelector('input[type=number]').getAttribute('aria-label')"));
    await evaluate("localStorage.setItem('tb_cart_v1', '[null,{},false]')");
    await navigate('/cart');
    await waitFor("document.querySelector('h1')?.textContent.includes('Empty')");
    check('corrupt persisted cart does not crash the page', true);
    await seedCart();
  }
  await navigate('/checkout');
  await waitFor("document.querySelector('input[autocomplete=given-name]') !== null");
  check('checkout reload waits for persisted cart hydration', await evaluate("location.pathname === '/checkout' && JSON.parse(localStorage.getItem('tb_cart_v1')).length === 1"));
  await evaluate(`(() => {
    const set = (selector,value) => { const el=document.querySelector(selector); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value); el.dispatchEvent(new Event('input',{bubbles:true})); };
    set('input[autocomplete=given-name]','Test'); set('input[autocomplete=family-name]','Customer');
    set('input[type=email]','test@example.test'); set('input[autocomplete=tel]','6135550123');
    const select = document.querySelector('select'); select.value='pickup'; select.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await waitFor("[...document.querySelectorAll('button')].some(b => b.textContent.includes('Proceed') && !b.disabled)");
  await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Proceed') && !b.disabled).click()");
  await waitFor("document.querySelector('[role=dialog]') !== null");
  check('modal has accessible name and receives focus', await evaluate("document.querySelector('[role=dialog]').getAttribute('aria-labelledby') === 'checkout-confirm-title' && document.querySelector('[role=dialog]').contains(document.activeElement)"));
  await evaluate("[...document.querySelectorAll('[role=dialog] button')].at(-1).focus()");
  await tab('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  check('Tab stays inside modal', await evaluate("document.activeElement === document.querySelector('[role=dialog] button')"));
  await tab('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor("document.querySelector('[role=dialog]') === null");
  check('Escape closes confirmation without submitting', true);
  if (offline) {
    const shipping = method => evaluate(`(() => { const select=document.querySelector('select');select.value=${JSON.stringify(method)};select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    const address = (part, value) => evaluate(`(() => { const el=document.querySelector('input[autocomplete="shipping ${part}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await shipping('delivery_drop');
    await waitFor("document.querySelector('input[autocomplete=\"shipping street-address\"]') !== null");
    await address('street-address', '123 Test Street');
    await address('address-level2', 'Test City');
    await address('address-level1', 'Ontario');
    await address('postal-code', 'K1A 0B1');
    await waitFor("document.body.textContent.includes('Total shipping: $17.50')");
    check('tier-one door delivery preserves the $17.50 rate', true);
    await shipping('inhouse_drop');
    await waitFor("document.body.textContent.includes('Total shipping: $180.00')");
    check('tier-one in-house delivery includes the $135 oversized fee', true);
    distanceFixture = 80;
    await address('address-level2', 'Second Test City');
    await waitFor("document.body.textContent.includes('Total shipping: $250.00')");
    check('tier-two in-house delivery preserves the $115 base plus oversized fee', true);
    await shipping('delivery_drop');
    await waitFor("document.body.textContent.includes('Total shipping: $55.00')");
    check('tier-two door delivery preserves the $55 rate', true);
    await address('street-address', '');
    await waitFor("document.body.textContent.includes('Enter your full address to calculate shipping.') && !document.body.textContent.includes('Total shipping: $55.00')");
    check('clearing an address resets its distance estimate', true);
    distanceFixture = 250;
    await address('street-address', '123 Far Away Street');
    await waitFor("document.body.textContent.includes('EMAIL FOR QUOTE')");
    check('over-200km delivery requires a quote and disables payment', await evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.includes('Proceed') && b.disabled)"));
    await shipping('pickup');
    await waitFor("document.body.textContent.includes('Pickup location') && !document.body.textContent.includes('EMAIL FOR QUOTE')");
    check('returning to pickup clears delivery and quote state', await evaluate("document.querySelector('input[autocomplete=\"shipping street-address\"]') === null"));
  }
  for (const path of offline ? ['/robots.txt'] : ['/robots.txt', '/sitemap.xml']) check(`${path} returns 200`, await evaluate(`fetch(${JSON.stringify(path)}).then(r => r.status === 200)`));
  assert.deepEqual(failures, [], 'Browser exceptions');
  writeFileSync(offline ? 'docs/maintenance-browser-results.json' : 'docs/fixes-browser-results.json', JSON.stringify({ inspectedAt: new Date().toISOString(), base, offline, passed, failures, payments: 'mocked; all browser writes blocked' }, null, 2));
  await call('Browser.close');
} finally {
  ws?.close();
  browser.kill();
}
