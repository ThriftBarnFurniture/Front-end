# Atomic checkout rollout

**Current state:** the user's production schema review confirms that the atomic migration objects already exist and that all three new functions allow execution only by the server role. Do not rerun the original migration. The profile permissions in that same review allow customers to edit their own admin flag; [profile-permissions-fix.sql](profile-permissions-fix.sql) is the tested repair and must still be applied in SQL Editor. It does not modify profile records or existing administrator flags. The Supabase tool connection is unavailable in this session, so production application of this repair has not been claimed.

The application changes are in pushed commit `953ea01`. Deployment of that exact revision has not been verified. `STRIPE_ATOMIC_FULFILLMENT` is absent locally and defaults to off; production hosting settings are not accessible here. Keep the setting off until the controlled provider checks below are completed. The normal checkout path continues while it is off.

Next.js 16.4.4, its matching lint configuration and Nodemailer 10.3.1 are installed. The last successful production dependency audit reports zero vulnerabilities; the current attempt to refresh it was blocked by network permissions. No dependency versions were changed in this follow-up. Sixteen moderate development-tool advisories remain in minimatch/ESLint; npm's proposed major ESLint downgrade is incompatible with the current toolchain and was not applied.

**What changes when enabled**

- `finalize_stripe_checkout_v1` locks the order and products, aggregates repeated product IDs, validates the payment amount/currency and stored line items, decrements finite stock and marks the order paid in one PostgreSQL transaction. Any failure rolls back all of those writes. Repeated browser/webhook confirmation commits only once.
- The same transaction creates `stripe_order_effects`. This records uncompleted Square updates and administrator/customer emails. A five-minute lease serializes delivery attempts. Acknowledged effects are not repeated on ordinary retries.
- Website sales use Square `ADJUSTMENT` from `IN_STOCK` to `SOLD`, with a stable bounded idempotency key and event timestamp. A fresh Square count is retrieved even on an idempotent replay.
- Square observations are ordered by `calculated_at`. While website adjustments are pending, newer observations are cached without restoring already-sold website stock. The last completed adjustment acknowledges its work and reconciles the freshest count under the product lock.
- Confirmed customers receive success even if notifications are delayed. The Stripe webhook returns HTTP 500 while durable work is pending so Stripe can retry it. A protected administrator endpoint supports manual retries after automatic delivery retries are exhausted.

All new functions use invoker privileges with an empty `search_path`, revoke execution from PUBLIC/anonymous/customer roles, and grant execution to `service_role`. The new effects table has RLS enabled and no anonymous/customer grants. Existing database functions are not replaced.

**Before production activation**

1. Run the whole [profile-permissions-fix.sql](profile-permissions-fix.sql) file in the intended project's SQL Editor. It revokes both table and column write grants, permits customer inserts/updates of ordinary profile fields under existing ownership policies, and preserves server access. It also restricts the two unused legacy payment/inventory RPCs to the server role while leaving `is_admin` and the RLS policies intact. The transaction is repeatable and fails if inherited grants still permit changing the admin flag. Its final `security_fix` result must show false insert/update permissions for `anon` and `authenticated`, true permissions for `service_role`, and true for profile editing, creation and reads. No customer data is selected by the verification. Existing admin flags are preserved; independently review the current administrator list against known store staff, since a permission fix cannot establish whether the previous exposure was used.
2. Dependency installation has completed. `scripts/update-security-dependencies.ps1` remains available for repeatable installation/checks; it applies compatible audit fixes without `--force`, blocks high/critical advisories, and separately requires a clean production audit. Moderate development-tool findings are reported without skipping lint/tests/build. Review/commit both package files after successful checks. A regression test verifies Nodemailer message/photo composition without network delivery; real SMTP delivery still requires a controlled test. No real email was sent in this work.
3. The original atomic migration is already present according to the supplied schema review. Run [checkout-readiness.sql](checkout-readiness.sql) after the permission repair; all five checks must be true. This verifies function signatures/permissions, private delivery records and the Square observation columns. It does not execute a payment or prove external delivery. The original migration was prepared before the Supabase skill was installed. The current CLI cannot be installed because outbound network access is denied, so the permission repair is provided as reviewed operational SQL instead of inventing a CLI migration filename.
4. In a separate test deployment/database, run a controlled Stripe test-mode checkout with disposable inventory and Square sandbox credentials. Verify both signed webhook paths, both receipts, stock reconciliation and a duplicate delivery. The credentials available in this session are live Stripe credentials and the Square client targets production; no production charge, stock adjustment or email was made for testing. The local integration test below exercises the application and database chain, but simulates external Square/SMTP delivery.
5. In hosting, confirm that the deployment of commit `953ea01` succeeded. Run `npm run check:deployment` from a network-enabled terminal to check the public routes, sitemap, robots and anonymous admin redirect. It uses only GET requests, exits nonzero for failed checks and does not print page bodies. Optional `-- --output <path>` saves results. The script cannot identify the deployed commit; verify the commit in the hosting dashboard. This session's outbound requests fail with `EACCES`; cached search pages are not deployment evidence. Local smoke checks confirm the static pages and anonymous admin redirect, but the local shop/sitemap cannot reach Supabase under the same network restriction.
6. Only after the controlled test passes and Square/database quantities are reconciled, enable `STRIPE_ATOMIC_FULFILLMENT=true` consistently for all production handlers and redeploy in a controlled window with no in-flight legacy checkout finalizations. Monitor pending effects and provider errors. Enabling the setting is a separate activation step; it has not been done here.

**Verification performed**

- `npm test`: 24 tests pass, including atomic delegation, failure propagation, durable delivery retries, Square delta/idempotency behavior, webhook retry responses, administrator authorization and Nodemailer composition.
- `npm run test:db`: 19 checks pass on a disposable local PostgreSQL 16 database. They exercise row locking, concurrent different/same orders, reversed product order, rollback after a late injected failure, insufficient stock, snapshot/payment mismatch, unlimited stock, duplicate lines, shared session conflicts, service-only permissions, expiring leases, stale counts and pending-sale reconciliation. The suite reproduces the reported profile escalation in the disposable fixture, applies the repair twice, then confirms profile editing/creation, ownership restrictions, blocked admin writes/inserts, preserved existing admins and trusted server management. It also verifies every read-only readiness check.
- The integrated database test uses the actual Stripe signature verifier, signed Square webhook handler, completion route, fulfillment code and durable effects processor against real PostgreSQL. Invalid signatures leave stock untouched; valid confirmation decrements once; a simulated SMTP failure retries only unfinished work; repeated webhooks/browser confirmations do not repeat the stock adjustment or acknowledged mail; stale signed Square counts cannot restore sold units. A guard fails any external HTTP request during this test.
- Production build and TypeScript pass against the currently installed dependencies. The current whole-project lint has zero errors and 33 warnings.
- The preceding local production-browser verification passed 91 checks on the upgraded framework, including the existing UI flows and delivery tiers, oversized fees, incomplete addresses, quote-only distances and switching back to pickup. [Browser results](maintenance-browser-results.json). This follow-up changes SQL, tests and operational documentation/scripts, with no UI/runtime behavior changes; the browser suite was not unnecessarily repeated.
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
