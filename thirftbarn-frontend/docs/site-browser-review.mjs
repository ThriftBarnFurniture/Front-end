// Read-only browser review of public pages; does not submit forms or payments.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const executable = 'C:/Users/tonyd/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'thriftbarn-review-'));
const browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
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
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) {
      const handler = pending.get(msg.id);
      if (handler) { pending.delete(msg.id); msg.error ? handler.reject(new Error(msg.error.message)) : handler.resolve(msg.result); }
    } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
  };
  function call(method, params = {}, sessionId) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const tab = (method, params) => call(method, params, sessionId);
  await tab('Page.enable');
  await tab('Runtime.enable');
  const evaluate = async expression => (await tab('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const report = [];
  let itemPath;
  for (const width of [1440, 390]) {
    await tab('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
    for (const path of ['/', '/shop', ...(itemPath ? [itemPath] : []), '/services', '/checkout/success']) {
      errors.length = 0;
      await tab('Page.navigate', { url: `https://www.thriftbarnfurniture.ca${path}` });
      await sleep(3500);
      const data = await evaluate(`(() => {
        const visible = e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
        const inputs = [...document.querySelectorAll('input,select,textarea')].filter(e => visible(e) && !['hidden','submit','button'].includes(e.type));
        return {
          url: location.pathname, title: document.title, canonical: document.querySelector('link[rel=canonical]')?.href,
          robots: document.querySelector('meta[name=robots]')?.content,
          h1: [...document.querySelectorAll('h1')].map(e => e.textContent),
          mainCount: document.querySelectorAll('main').length,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          unloadedImages: [...document.images].filter(e => visible(e) && e.complete && !e.naturalWidth).map(e => e.getAttribute('src')?.split('?')[0]),
          unnamedInputs: inputs.filter(e => !e.labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).map(e => ({ name: e.name, type: e.type, placeholder: e.placeholder })),
          itemPath: document.querySelector('a[href^="/item/"]')?.getAttribute('href'),
          bodyBytes: document.documentElement.outerHTML.length,
          transferBytes: performance.getEntriesByType('resource').reduce((s,e) => s+e.transferSize,0),
          navigationMs: performance.getEntriesByType('navigation')[0]?.duration
        };
      })()`);
      if (data.itemPath) itemPath = data.itemPath;
      report.push({ width, requestedPath: path, ...data, browserErrors: [...errors] });
      if (['/', '/shop'].includes(path)) {
        const screenshot = await tab('Page.captureScreenshot', { format: 'png' });
        writeFileSync(`docs/site-${path === '/' ? 'home' : 'shop'}-${width}.png`, Buffer.from(screenshot.data, 'base64'));
      }
      console.log(JSON.stringify(report.at(-1)));
    }
  }
  const endpointStatuses = await evaluate(`Promise.all(['/robots.txt','/sitemap.xml'].map(async path => { const r = await fetch(path); return {path,status:r.status}; }))`);
  writeFileSync('docs/site-browser-snapshot.json', JSON.stringify({ inspectedAt: new Date().toISOString(), pages: report, endpointStatuses }, null, 2));
  console.log(JSON.stringify({ endpointStatuses }));
  await call('Browser.close');
} finally {
  ws?.close();
  browser.kill();
}
