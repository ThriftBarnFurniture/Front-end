// Read-only smoke checks. Never logs response bodies or sends POST requests.
// This checks public responses; it does not establish which commit was deployed
// or prove that real payments/email/provider inventory integrations work.
import { writeFileSync } from 'node:fs';

const base = process.env.HEALTHCHECK_SITE_URL || 'https://www.thriftbarnfurniture.ca';
const site = new URL(base);
if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password || site.pathname !== '/' || site.search || site.hash) {
  throw new Error('HEALTHCHECK_SITE_URL must be an HTTP(S) origin without credentials or a path');
}
const pages = ['/', '/shop', '/services', '/login', '/cart', '/checkout', '/checkout/success'];
const targets = [...pages, '/robots.txt', '/sitemap.xml', '/admin/orders'];
const results = [];
for (const path of targets) {
  try {
    const response = await fetch(new URL(path, base), {
      redirect: 'manual', signal: AbortSignal.timeout(15000), cache: 'no-store',
      headers: { 'User-Agent': 'ThriftBarn-ReadOnly-HealthCheck/1.0' },
    });
    const body = await response.text();
    const location = response.headers.get('location');
    let passed;
    if (path === '/admin/orders') {
      passed = [302, 303, 307, 308].includes(response.status)
        && !!location && new URL(location, base).origin === base
        && new URL(location, base).pathname === '/login';
    } else if (pages.includes(path)) {
      passed = response.status === 200 && /<main[\s>]/i.test(body) && /<h1[\s>]/i.test(body);
      if (path === '/checkout/success') passed &&= /noindex/i.test(body);
    } else if (path === '/robots.txt') {
      passed = response.status === 200 && /sitemap:/i.test(body);
    } else {
      passed = response.status === 200 && /<urlset[\s>]/i.test(body) && /<loc>/i.test(body);
    }
    results.push({ path, status: response.status, passed });
  } catch (error) {
    results.push({ path, passed: false, transportError: error.cause?.code || error.name });
  }
}
const report = { checkedAt: new Date().toISOString(), site: base, readOnly: true,
  deployedCommitVerified: false, results, passed: results.every(result => result.passed) };
const output = process.argv.indexOf('--output');
if (output !== -1) {
  if (!process.argv[output + 1]) throw new Error('--output requires a file path');
  writeFileSync(process.argv[output + 1], JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.passed ? 0 : 1;
