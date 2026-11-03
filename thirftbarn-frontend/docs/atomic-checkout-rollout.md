# Atomic checkout rollout

**Current state:** implementation and migration are prepared and tested locally. Next.js 16.4.4, its matching lint configuration and Nodemailer 10.3.1 are installed; the production dependency audit reports zero vulnerabilities. Sixteen moderate development-tool advisories remain in the minimatch/ESLint dependency tree; forcing npm's proposed ESLint downgrade would break the current toolchain and was not performed. The production migration has not been applied and `STRIPE_ATOMIC_FULFILLMENT` has not been enabled. Existing checkout remains on its previous path until activation.

**What changes when enabled**

- `finalize_stripe_checkout_v1` locks the order and products, aggregates repeated product IDs, validates the payment amount/currency and stored line items, decrements finite stock and marks the order paid in one PostgreSQL transaction. Any failure rolls back all of those writes. Repeated browser/webhook confirmation commits only once.
- The same transaction creates `stripe_order_effects`. This records uncompleted Square updates and administrator/customer emails. A five-minute lease serializes delivery attempts. Acknowledged effects are not repeated on ordinary retries.
- Website sales use Square `ADJUSTMENT` from `IN_STOCK` to `SOLD`, with a stable bounded idempotency key and event timestamp. A fresh Square count is retrieved even on an idempotent replay.
- Square observations are ordered by `calculated_at`. While website adjustments are pending, newer observations are cached without restoring already-sold website stock. The last completed adjustment acknowledges its work and reconciles the freshest count under the product lock.
- Confirmed customers receive success even if notifications are delayed. The Stripe webhook returns HTTP 500 while durable work is pending so Stripe can retry it. A protected administrator endpoint supports manual retries after automatic delivery retries are exhausted.

All new functions use invoker privileges with an empty `search_path`, revoke execution from PUBLIC/anonymous/customer roles, and grant execution to `service_role`. The new effects table has RLS enabled and no anonymous/customer grants. Existing database functions are not replaced.

**Before production activation**

1. In the intended project's Supabase Dashboard, open SQL Editor and run [atomic-checkout-preflight.sql](atomic-checkout-preflight.sql). This read-only query returns one `schema_review` result with table definitions, constraints, triggers, policies and function privileges; it does not select customer rows or execute application functions. Review that result before selecting any additional function definitions or applying changes. The plugin is optional and is being skipped. The REST snapshot was sufficient for a local fixture, but it does not prove production trigger or policy behavior. Existing externally callable inventory functions must also be checked for unsafe public access.
2. Dependency installation has completed. `scripts/update-security-dependencies.ps1` remains available for repeatable installation/checks; it applies compatible audit fixes without `--force`, blocks high/critical advisories, and separately requires a clean production audit. Moderate development-tool findings are reported without skipping lint/tests/build. Review/commit both package files after successful checks. A regression test verifies Nodemailer message/photo composition without network delivery; real SMTP delivery still requires a controlled test. No real email was sent in this work.
3. Apply `supabase/migrations/202611030001_atomic_stripe_checkout.sql` as a migration in the intended project after inspection. It adds two product observation columns, one effects table/index, and three service-only RPCs in a single transaction. It deliberately fails on name conflicts rather than replacing unknown existing objects. Do not rerun the SQL after a successful recorded migration.
4. Verify function signatures and privileges, RLS/grants, and an isolated staging/test transaction against the actual schema. Do not invent a production payment or run concurrency tests against store stock.
5. Deploy the new application code, then enable `STRIPE_ATOMIC_FULFILLMENT=true` for all production handlers and redeploy in a controlled window with no in-flight legacy checkout finalizations. This setting gates both Stripe finalization and Square webhook reconciliation. Enabling it before the migration exists will cause confirmation failures; there is no silent fallback after an atomic RPC error.
6. Verify a controlled Stripe test-mode checkout and both signed webhook paths with test inventory, then monitor pending effects and application/provider errors. These tests have not been performed against production.

**Verification performed**

- `npm test`: 24 tests pass, including atomic delegation, failure propagation, durable delivery retries, Square delta/idempotency behavior, webhook retry responses, administrator authorization and Nodemailer composition.
- `npm run test:db`: 15 checks pass on a disposable local PostgreSQL 16 database. They exercise row locking, concurrent different/same orders, reversed product order, rollback after a late injected failure, insufficient stock, snapshot/payment mismatch, unlimited stock, duplicate lines, shared session conflicts, service-only permissions, expiring leases, stale counts and pending-sale reconciliation.
- Production build and TypeScript pass against the currently installed dependencies. The current whole-project lint has zero errors and 33 warnings.
- Local production-browser verification passes 91 checks on the upgraded framework, including the existing UI flows and delivery tiers, oversized fees, incomplete addresses, quote-only distances and switching back to pickup. [Browser results](maintenance-browser-results.json).
- Fresh unauthenticated GET/HEAD requests confirm the deployed homepage, shop, services, an item, login and parameter-free checkout success return 200, with expected headings/landmarks/canonicals/noindex behavior. Robots and sitemap return 200; all eight visible shop product links occur in the sitemap; anonymous `/admin/orders` redirects to `/login`. Evidence: [deployed-verification-2026-11-03.json](deployed-verification-2026-11-03.json). These observations verify the already-pushed site, not deployment of the new atomic path.

Local database checks require the disposable cluster user `checkout_test` on `127.0.0.1:55438` and `psql`. `TEST_PSQL_PATH` can point to another local executable. Each run creates and removes only its own `thriftbarn_checkout_test_<timestamp>` database. The test script does not accept a production database URL. The local cluster directory is ignored by Git.

**Delivery recovery**

Inspect pending work without selecting customer data:

```sql
SELECT order_id, attempts, last_error, created_at,
       jsonb_array_length(square_updates) AS pending_square_updates,
       admin_email_sent_at IS NULL AS admin_email_pending,
       customer_email_sent_at IS NULL AS customer_email_pending
FROM public.stripe_order_effects
WHERE jsonb_array_length(square_updates) > 0
   OR admin_email_sent_at IS NULL OR customer_email_sent_at IS NULL
ORDER BY created_at;
```

While signed in as an administrator, POST to `/api/admin/orders/<order UUID>/retry-delivery`. It returns 200 when work completes and 503 when work remains; it does not charge/refund a payment or decrement database stock again. Automatic retries depend on Stripe webhook delivery; no independent cron worker has been configured. A killed process leaves a lease that another delivery attempt can reclaim after five minutes.

SMTP delivery is at-least-once: a process failure after sending but before recording acknowledgement can cause a duplicate email on retry. Square sale adjustments remain idempotent. Missing/deleted products, revoked Square permissions, negative provider stock, and permanent SMTP errors need operator investigation rather than marking work complete by hand.

**Limits and rollback**

This transaction prevents partial database writes and lost concurrent decrements. It does not reserve stock while a customer is on Stripe's payment page. Two people can still pay before either confirmation is processed, or a POS sale can consume stock first. If sufficient stock is unavailable at finalization, the transaction remains uncommitted and Stripe retries; the payment needs prompt operator review/restock/refund. Avoiding that payment-level race requires a separately designed reservation/capture policy.

Historical paid orders are not backfilled or decremented again; any earlier partial inventory failure requires reconciliation. Existing Square and database quantities should be reconciled before enabling delta-based syncing. Customer-facing prices, tax, delivery tiers, discounts, cart behavior and order statuses are preserved.

Keep the additive schema/effects records during application rollback. Disabling the setting restores the previous path, but leaves its known database race and stops new-path effect processing; drain or explicitly plan recovery of pending work first. Never remove the ledger to force a payment through again.

References: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html), [Square inventory process and adjustment guidance](https://developer.squareup.com/docs/inventory-api/how-it-works), [Square batch change reference](https://developer.squareup.com/reference/square/inventory-api/batch-change-inventory), [Nodemailer changelog](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md).
