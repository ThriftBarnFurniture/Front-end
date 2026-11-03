# Thrift Barn Furniture

Next.js App Router storefront and administration app for the Hawkesbury furniture store. React and TypeScript provide the UI; CSS modules and Tailwind provide styling.

**Application map**

| Area | Entry points | Responsibility |
| --- | --- | --- |
| Storefront | `app/page.tsx`, `app/shop`, `app/item/[id]` | Store information, newest products, estate collections, Barn Burner, filters, sorting, photos and stock |
| Cart and checkout | `components/cart`, `lib/cart.ts`, `app/cart`, `app/checkout` | Browser cart, stock validation, contact details, distance-based delivery, promotions and payment confirmation |
| Payments | `app/api/stripe`, `lib/stripe-fullfillment.ts` | Authoritative prices, checkout snapshots, Stripe sessions, signed webhooks, order confirmation and Square inventory updates |
| Services | `app/services`, `app/api/services` | Moving, junk removal, assembly, marketplace delivery and donation requests; photo compression and confirmation emails |
| Accounts | `app/(auth)`, `app/account`, `utils/supabase` | Password/Google authentication, session refresh, profiles and customer order history |
| Administration | `app/admin`, `app/api/admin` | Products, photos, price programs, promotions, orders, fulfillment and refunds |
| Integrations | `lib/square`, `lib/r2-upload.ts`, `lib/brevo.ts`, `app/api/google` | Square catalog/stock, Cloudflare R2, Brevo email, Google review totals and travel distance |
| Search metadata | `lib/seo.ts`, `app/robots.ts`, `app/sitemap.ts` | Canonicals, social previews, private-page noindex rules and active-product sitemap |

Supabase tables used by the application are `products`, `profiles`, `orders`, `promos` and `estate_sales`. Administrator access is checked against `profiles.is_admin`. Browser profile updates and customer queries also depend on database row-level security. The service-role key belongs exclusively on the server.

**Run locally**

Use Node.js 20.9 or newer and configure `.env.local` before installing/building. Never commit credentials.

```sh
npm ci
npm run dev
```

The default development URL is `http://localhost:3000`. Production commands are `npm run build` and `npm start`.

Required public configuration is `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_R2_PUBLIC_URL`. The R2 public URL is checked during configuration loading. `lib/seo.ts` currently fixes canonical URLs to `https://www.thriftbarnfurniture.ca`.

Server integrations additionally use:

- Supabase: `SUPABASE_SERVICE_ROLE_KEY`; optional `SUPABASE_PRODUCTS_TABLE`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; legacy development/production secret-key fallbacks are supported.
- Square: `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, webhook signature key and exact webhook URL; optional currency, merchant ID, automatic-sync setting and `POS_SYNC_SECRET`.
- R2: account ID, access key ID, secret access key and optional bucket name.
- Brevo: SMTP user/password, sender email/name and owner email; optional SMTP host/port and order-support/timezone settings.
- Google: `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`.
- Optional product mirror: `CLOUDFLARE_PRODUCTS_ENDPOINT`, `CLOUDFLARE_PRODUCTS_TOKEN`.

For bulk Square sync, send `x-pos-sync-secret` when `POS_SYNC_SECRET` is configured. Without a configured secret, the route requires an authenticated administrator. Normal product administration uses its existing administrator checks.

**Checks**

```sh
npm run lint
npm test
npm run build
```

For browser checks, run the production server on port 3028, then:

```sh
node tests/browser-check.mjs
```

Set `TEST_SITE_URL` to another localhost port and `TEST_CHROME_PATH` to a Chromium executable when needed. Browser writes are intercepted, so these checks do not charge cards or send service requests. `--offline` checks static pages and mocked cart/payment flows without requiring live catalog access. `--no-sandbox` is available for a restricted local test environment. Offline results do not establish live backend health.

The current maintenance report is [docs/maintenance-review-2026-11-03.md](docs/maintenance-review-2026-11-03.md). Historical database inspection and read-only SQL catalog queries are retained in `docs`; their dated snapshots do not prove current production policies or records.

The prepared transaction migration, retryable delivery implementation, activation setting and remaining dependency steps are documented in [docs/atomic-checkout-rollout.md](docs/atomic-checkout-rollout.md). This new path remains inactive until its production migration is verified and `STRIPE_ATOMIC_FULFILLMENT=true` is configured. Run `npm run test:db` against the isolated local test cluster described there to exercise real PostgreSQL concurrency checks.
