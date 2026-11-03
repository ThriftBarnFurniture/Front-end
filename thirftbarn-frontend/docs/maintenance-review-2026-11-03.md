# Website maintenance review — November 3, 2026

The checked source builds successfully, all 14 regression tests pass, ESLint reports no errors, and a local Chromium run passed 84 desktop/mobile checks. The application is healthier, but it cannot receive a clean production-readiness signoff while the dependency advisories and order/stock transaction risks below remain unresolved.

This review preserved the substantial uncommitted October 29 changes already present in the workspace. Those included payment verification, receipt privacy, immutable checkout snapshots, request quotas, canonical/product metadata, sitemap/robots routes and the checkout dialog. They are not new changes from this maintenance pass. Nothing was deployed or committed, and no live purchase, refund, email, account deletion, inventory update or schema change was performed.

**Changes made in this pass**

| Area | Change and purpose |
| --- | --- |
| Cart persistence | Validate stored cart lines and tolerate invalid JSON, blocked storage and quota errors. Preserve valid legacy cart lines. Prevent storage failures from crashing the shared provider. |
| Sold-out cart | Stop the zero-stock quantity correction from repeatedly assigning quantity 1 and triggering a render/stock-request loop. Ignore responses from superseded stock requests; avoid state writes when quantity is unchanged. |
| Quantity field | Adjust product-page quantity bounds before committing a render rather than through an extra effect. Include the item name in each cart quantity input's accessible name. |
| Session refresh | Replace deprecated individual Supabase cookie methods with `getAll`/`setAll`. Keep every refreshed cookie chunk in both the forwarded request and returned response; make refreshed responses private and non-cacheable. |
| Bulk Square sync | Keep configured-secret access working. When no secret is configured, require a signed-in administrator before reading or syncing products. Previously this route had no authentication gate in that configuration. |
| Account deletion | Call the authenticated deletion endpoint before signing out. Reject redirected/login responses and failed requests, restore the button after errors and keep the session on server failure. Tested with mocks only. |
| Accessibility | Correct service-button state to `aria-pressed`, associate controls with their panel, remove duplicate image names, add semantic headings/status messages to authentication forms, label profile inputs, announce profile-save status, expose selected gallery thumbnails, and close the mobile menu with Escape while returning focus. |
| Admin dialogs | Reuse the existing checkout dialog helper for order details and promotion editing, adding accessible names, focus trapping/restoration, scroll locking and Escape handling. Preserve existing pointer dismissal. These authenticated views were source/build checked, not exercised with a real admin session. |
| Motion | Pause the newest-products carousel while keyboard focus is inside it and respect reduced-motion preferences, including changes made while the page is open. |
| Public content | Exclude inactive products explicitly from the homepage's newest-products query. Use a JPEG for the default Twitter preview instead of SVG. Fix authentication fallback URLs that otherwise produced a double slash. |
| Error recovery | Add a Next.js page error boundary with retry/home actions, improve the authentication error page and remove its stray semicolon. |
| Code health | Replace explicit `any` in the reported lint failures with concrete types or `unknown`, safely read structured error messages, keep Stripe's existing API version, and reset authentication form fields when their action succeeds instead of through cascading effects. |
| Documentation | Replace the starter README with an application map, configuration overview and check commands. Extend the existing browser script with an explicit offline mode and separate evidence files. |

**Verification**

| Check | Result |
| --- | --- |
| `npm.cmd run build` | Pass; optimized build, TypeScript and 44 static pages generated successfully |
| `npm.cmd test` | 14/14 pass, up from the 10 existing tests |
| `npm.cmd run lint` | Pass; 0 errors and 32 warnings, down from 40 errors and 37 warnings at the start |
| `node tests/browser-check.mjs --offline --no-sandbox` | 84 checks pass; zero uncaught page exceptions |

The new regression tests cover damaged/blocked cart storage, multi-cookie session refresh, administrator/secret authorization on bulk sync, and successful/failed/redirected/offline account deletion. Database and external writes are mocked.

The browser run uses the local production build at 1440px and 390px. It checks services, login, signup, forgotten/reset passwords, privacy, terms and the cart; main landmarks, headings, overflow, relevant canonicals, service state and mobile-menu keyboard behavior. Mocked scenarios cover missing/unconfirmed/confirmed payments, receipt sequencing and cart clearing, persisted-cart hydration, a sold-out cart with stable stock-request counts, a corrupt cart, and checkout-dialog focus/Tab/Escape behavior. `robots.txt` returns 200 locally. Results are in [maintenance-browser-results.json](maintenance-browser-results.json). Service-page screenshots were visually reviewed: [desktop](maintenance-services-1440.png), [mobile](maintenance-services-390.png).

The initial Chromium attempt could not start a renderer under its own sandbox; the rerun used `--no-sandbox` for the local test browser. A navigation-related interception-ID race in the existing script was also corrected; actual page exceptions still fail the check.

**Outstanding priorities**

1. **Dependency security remains unresolved.** `npm.cmd audit --omit=dev` reported 13 affected dependency entries: 1 critical, 10 high and 2 moderate. Installed Next.js is 16.1.6 and Nodemailer is 7.0.13. Next.js's maintainer identifies 16.4.1 as the fix for the October critical advisories; the registry reported 16.4.4 as current during this review. Nodemailer advisories require an upgrade outside the current major range. Attempts to install Next.js 16.4.4, its matching lint configuration and Nodemailer 10.3.1 failed with operating-system/network `EACCES` while fetching packages. The manifest, lockfile and installed versions were not updated. Upgrade in an environment with package access, review the Nodemailer major-version changes, then rerun build, regression/browser checks, an SMTP test and `npm audit`. Do not use `audit fix --force` as an unreviewed replacement for that work. Maintainer references: [Next.js cache-function advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr), [Next.js image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [Nodemailer changelog](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md). Audit severity is package-level; it does not prove each advisory is reachable through this application's configuration.
2. **Payment and stock need a database transaction and retryable side effects.** `lib/stripe-fullfillment.ts` marks an order paid before updating products, then subtracts from previously read quantities. A failure can leave an already-paid order without all stock updates, and concurrent orders can overwrite decrements or oversell. Square sync and email delivery are best-effort and do not have a durable retry queue. Fixing this properly requires inspecting the existing database functions/constraints and introducing transactional order/inventory processing with an explicit policy for payment received after stock is exhausted. Reordering the same separate API calls does not solve it.
3. **Verify database authorization and multi-system recovery.** Current RLS policies, administrator-column permissions, foreign keys, functions, scheduled pricing jobs and backups were not inspected in this pass. Product deletion spans Square/R2/database operations; refunds can succeed at Stripe before the database is updated; profile deletion precedes auth-user deletion. These operations need a defined recovery path. Historical REST snapshots cannot establish their current safety. Account deletion also needs a controlled real-account test once its database delete constraints are understood.
4. **Operational/scale follow-ups.** Review the in-process rate limiter against a deployment-wide quota. Product/order queries have hard caps and need pagination before substantial growth. Unrelated product edits reset enabled pricing-program start/tick fields; verify the database job's intended behavior before changing those schedules. Tax remains configured as zero in both UI and server code; this review leaves the business configuration unchanged. Remaining lint warnings concern unused legacy code, raw images and an old diagnostic script.

**Limits of this result**

Node requests to the configured Supabase service failed with `fetch failed` in this restricted environment, and package downloads failed with `EACCES`. The normal homepage/catalog/product/sitemap paths could not be rechecked locally against current data. Their server code and existing metadata/privacy changes were reviewed, but the offline browser run deliberately does not claim those flows passed. Public web-tool results were cached and were not used as proof of current deployment state.

No full screen-reader audit, field performance measurement, payment-provider delivery test, real administrator session, email-delivery test or database concurrency test was completed. The deployed revision was not matched to this checkout. All changes are local and still require deployment to affect the public website.
