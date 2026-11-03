**Thrift Barn website review — 2026-10-29 — 64/100**

Historical snapshot: several findings below have since been addressed in the working tree. See the [November 3 maintenance review](maintenance-review-2026-11-03.md) for current changes, verification and remaining risks.

This is a judgment-based production-readiness score, not a Lighthouse score. Evidence: repository review, live public-page checks in headless Chromium at 1440px and 390px, a production build, ESLint, and the configured Supabase schema/data inspection. No purchases, refunds, form submissions, account changes, or deliberate concurrency tests were performed. Database internals and hosting-level protections were unavailable. The deployed source revision was not verified against this checkout.

| Area | Points | Rationale |
| --- | ---: | --- |
| Presentation and usability | 17/20 | Consistent branding, working responsive layouts and images; accessibility and content issues remain |
| Checkout and inventory reliability | 17/30 | Server-side pricing and payment integrations exist; important failure and concurrency cases remain |
| Security and privacy | 13/20 | Admin checks and signed webhooks; receipt access and abuse controls need attention; full policy audit pending |
| SEO and discoverability | 7/15 | Basic metadata exists; canonical URLs, product metadata, and sitemap need work |
| Engineering and maintainability | 10/15 | Production build passes; lint fails and database migrations/types are absent |
| Total | 64/100 | Functional foundation with material production risks |

**Highest-priority findings**

| Priority | Finding and impact | Evidence | Suggested direction |
| --- | --- | --- | --- |
| High | An order becomes paid before inventory updates finish. A failure can leave stock unchanged, while a retry treats the order as complete. | `lib/stripe-fullfillment.ts:305`, `:403`, `:443` | Atomically record the payment transition and stock movements; separately track retryable external sync and email delivery. Inspect the existing finalize_order function first. |
| High | Concurrent purchases can oversell or lose a stock decrement. Product stock is read and later overwritten with an absolute number; no reservation or expected-stock predicate is used. | `lib/stripe-fullfillment.ts:326`, `:443`; `app/api/stripe/checkout/route.ts:171` | Use transactional, conditional stock changes and a defined reservation/paid-oversell recovery policy. |
| High | Success page reports payment success without verified payment and clears the cart whenever a session_id parameter exists. The completion response is not checked and order retrieval races completion. | `app/checkout/success/CheckoutSuccessClient.tsx:61`, `:139`, `:232`; live `/checkout/success` with no parameters also displayed success | Show pending/failed/confirmed states from verified payment/order state; clear cart only after confirmation. |
| High | Guest receipt lookup returns name, email, phone and delivery address to anyone possessing a valid session ID, without customer authentication or an additional receipt-access check. | `app/api/orders/by-session/route.ts:6`; `/api/stripe/complete` also returns an order summary | Deliberately secure guest receipt access, minimize returned fields, and rate-limit lookups. Session IDs are not readily guessable; this is a bearer-link privacy risk, not proof of arbitrary order enumeration. |
| High | Payment completion replaces checkout snapshot prices with current catalog prices, then derives tax from the difference. Price changes during payment can corrupt the recorded breakdown. | `lib/stripe-fullfillment.ts:353`, `:379` | Preserve immutable checkout line-item prices and reconcile against the actual payment amounts. |
| Medium | Square inventory write errors can be acknowledged with HTTP 200, losing automatic retry opportunities. The handler also lacks an event-age check. | `app/api/square/webhook/route.ts:106`, `:120`, `:127` | Record/deduplicate events, reject stale counts, and retry processing failures. |
| Medium | Public email and paid-distance endpoints have no application-level throttling; service request protection is a honeypot only. | `app/api/services/route.ts`; `app/api/shipping/distance/route.ts`; repository search found no rate limiter | Add bounded validation, per-client quotas, and appropriate bot controls. Hosting-side controls were not inspected. |

These are demonstrated code paths and potential consequences. No oversell, data leak, or lost stock update was deliberately induced, and the current database records did not show an arithmetic or stock inconsistency.

**SEO, accessibility, and customer-facing issues**

| Priority | Finding | Evidence |
| --- | --- | --- |
| Medium | Shop, services, and the inspected product page all declare the homepage as canonical. Product title/description/social metadata are not customized. This tells search engines that distinct pages have the homepage as their preferred URL. | Live browser DOM; `app/layout.tsx:68`; no product generateMetadata implementation |
| Medium | `/sitemap.xml` and `/robots.txt` returned 404. A missing robots file does not itself block crawling, but there is no sitemap and utility pages inherit index/follow. | Live fetches; `/checkout/success` has index/follow |
| Medium | Shop's sort select has a visible label that is not programmatically associated with it. Main content landmarks are nested on the homepage, shop, services and item page. | `app/shop/shop-client.tsx:366`; root/page layouts; browser DOM |
| Medium | Checkout confirmation modal has no accessible name, focus placement/trapping, or Escape handler in its implementation. | `app/checkout/page.tsx:870`; source inspection, not a completed keyboard audit |
| Medium | The banner labels total Google review count as the number of five-star reviews. The API retrieves user_ratings_total, not the number of five-star ratings. | `app/api/google/reviews-count/route.ts:26`; `components/navbar/navbar.tsx:335` |
| Low | Barn Burner advertises seven clickable day buckets even when all have zero items. | Live homepage and current inventory; `components/home/BarnBurnerSection.tsx` |
| Low | Catalog filter labels expose raw slugs such as home-office and storage-furniture. | Live shop screenshot |
| Low | Services page title repeats the brand: “Services | Thrift Barn | Thrift Barn Furniture.” | Live browser document.title |

**Additional implementation concerns**

- Taxes are hardcoded to zero in both checkout UI and API. Confirm the intended business configuration before changing this; this review does not determine tax obligations.
- Duplicate product IDs in a submitted cart are validated separately rather than combined. Repeated lines can exceed aggregate available stock. The normal cart UI coalesces IDs, but the server must validate requests independently.
- A pending order is inserted before Stripe session creation. Failure or cancellation can leave pending orders; no abandoned-session lifecycle handler was found in the webhook.
- Refund processing does not replenish stock. That may be intentional for used furniture, but the operational restock workflow should be explicit.
- Product deletion removes Square objects and R2 images before deleting the database row. Failures can leave a visible row with missing assets or external catalog data.
- Every edit resets enabled price-program start/tick markers. This can restart a schedule when editing unrelated product details; actual cron behavior still requires database inspection.
- `orders.items` is text[] containing JSON strings, despite a JSONB comment in checkout. Readers currently parse it, so this is schema/type debt rather than proof checkout is broken.
- Product and order admin views cap results at 500 and 200 respectively, with no pagination in those queries. Public catalog queries likewise lack explicit paging. This is a growth limitation, not a current nine-product outage.
- Proxy route matching is commented out, leaving authentication-session work broadly applied. Measure the cost and scope the matcher intentionally.

**What passed and what remains untested**

`npm.cmd run build` succeeded, including TypeScript and route generation. `npm.cmd run lint` failed with **70 errors and 34 warnings**. Many are explicit-any and React effect/state findings; they are not 104 independent user-visible defects.

No horizontal overflow, failed loaded images, or uncaught JavaScript exceptions were observed on the sampled live pages. Desktop and mobile homepage/shop screenshots were reviewed. Brand identity, readable pricing, product photos, filtering, contact information, and the primary shop action are present. API checkout re-fetches authoritative prices, administrator routes generally check the profile flag, and Stripe/Square webhook signatures are checked.

The browser sample covered homepage, shop, services and parameter-free checkout success at both widths, plus one product at mobile width. It did not perform a complete keyboard/screen-reader audit, test every breakpoint, submit checkout, validate payment/refund delivery, or measure field Core Web Vitals. Navigation timings and transfer totals in the snapshot are single-run diagnostics with cache reuse, not benchmarks.

Anonymous Supabase reads returned no orders or profiles and eight visible products. The current dataset passed the specific aggregate integrity checks, but RLS definitions, function privileges, triggers, indexes and backups were not accessible through the available API. See [database-review.md](database-review.md) and [database-snapshot.json](database-snapshot.json).

Browser evidence: [site-browser-snapshot.json](site-browser-snapshot.json), [desktop homepage](site-home-1440.png), [desktop shop](site-shop-1440.png), [mobile homepage](site-home-390.png), [mobile shop](site-shop-390.png). The inspection scripts and optional database catalog SQL are retained in this directory. No application source was changed.

Recommended repair order: transactional order/stock processing and payment confirmation; guest receipt access and abuse controls; canonical/product metadata and sitemap; keyboard/label fixes; lint and database schema maintenance.
