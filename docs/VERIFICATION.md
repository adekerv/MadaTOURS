# Verification record — September 24, 2026

Environment: macOS on Apple Silicon, Node 26.0.0, npm 11.14.1. CI is configured for Node 24.

## Automated checks

- ESLint and strict TypeScript pass.
- Thirteen API, PostgreSQL security, catalogue, search, planner, translation and compiled-runtime tests pass. The compiled-runtime check catches missing JavaScript import extensions that break the Vercel function. The other tests cover owner-only saved lists, rejected role changes, recovery/logout/deletion, foreign-key cascades and seed reruns.
- 23 browser scenarios pass, with one explicit WebKit offline skip. The browser suite uses Chromium and WebKit, seven representative viewport sizes, keyboard search, location denial, error states, account/saved-place/admin flows, password recovery and French planner persistence.
- The production service worker is tested with a complete offline reload and saved-place reading in Chromium. The equivalent WebKit service-worker automation is explicitly skipped; physical Safari offline behavior remains to be checked.
- Axe scans check serious/critical accessibility violations on home, exploration and authentication, rather than claiming a complete accessibility audit.
- Production web/server build passes. Capacitor sync passes for both platforms; this does not compile or sign a native application.
- Production dependency audit reports zero known vulnerabilities.
- The generated browser files were checked for the configured Supabase keys and database connection string; none were present.

API/browser authentication uses a test-only Supabase contract double backed by PGlite, an embedded PostgreSQL engine. These isolated tests do not send emails, alter remote users or prove real Supabase cookie/email behavior; the separate live checks below verify the hosted backend. External weather and map tiles are controlled in the browser tests. Photos and a French mobile planner screenshot were visually inspected.

## Live configuration checks

The Supabase project URL, publishable key and server secret have been checked remotely without printing credentials. Auth accepts the secret; public settings show email signup and email confirmation enabled.

The application tables are now initialized. Schema version, public catalogue, draft filtering and guest restrictions pass against the live Supabase project. APP_ORIGIN is now configured locally as https://mada-tours.vercel.app, verified from GitHub repository metadata. Every setup:check item passes.

`npm run test:live -- --run` and `npm run test:live -- --run --url https://mada-tours.vercel.app` passed against the real hosted project and public Vercel API: real signup-code verification, password recovery, HttpOnly API cookies, independent login sessions, persisted favorites, duplicate-save handling, cross-user RLS isolation, rejected self-promotion, logout and password-confirmed account deletion. Each run created and removed two temporary accounts. Supabase admin-generated OTPs were used without email delivery; actual inbox delivery and configured email templates remain unverified. No existing users or venues were changed.

The live smoke script is opt-in because it temporarily writes test accounts and saved rows. Supabase may retain normal audit logs and expiring abuse counters from these checks.

The Supabase MCP configuration is saved and reports OAuth authentication, but its tools remain unavailable in this conversation. A direct connection returned HTTP 403 with the narrow project/database credential. Live application checks succeeded independently through the official Supabase client.

The Vercel connector returned HTTP 403, so deployment was completed through the authenticated official CLI. Production environment variables were synchronized without logging secrets. A missing JavaScript extension in server imports caused the original HTTP 500; the import chain is corrected and covered by a plain-Node runtime regression test. Deployment `dpl_8Y5HYEXbEzxBGFtm6FYyTRTLr2Pb` was checked before promotion to https://mada-tours.vercel.app. Public health, the 17-place catalogue, service worker JavaScript and the local venue photograph respond successfully.

A real Chromium browser at 390 × 844 signed in on the public site, saved Jardin de Balata and restored both its session and favorite after refresh. The cookie was Secure, HttpOnly, SameSite=Lax and scoped to /api. The rendered mobile page was visually inspected, and the temporary browser account was removed. This check blocked service workers to isolate the live backend; offline behavior is covered separately above.

## Remaining release verification

Follow [CLASS-DEMO.md](CLASS-DEMO.md) on your own computer and phone before class. Actual inbox delivery, configured verification/recovery email templates and the choice between demo accounts and public signup remain unverified.

Physical iPhone/iPad/Android testing, native compilation/signing, native cookie persistence, App Store review, load testing, backups/restoration and exhaustive venue verification are not completed. The local Java SDK is ignored and has been removed from Git tracking; it is excluded from deployment.

## Expanded catalogue and filters

The September 24 batch adds 337 published entries (65 restaurants and 272 activities), bringing the public catalogue to 354 places across 29 communes. Three more imported records were withheld during final map-point review, leaving 10 drafts including the original seven. A live comparison confirmed all 24 original records were preserved apart from seven intentional map/source corrections. The public API returned HTTP 200 with 354 records. A second import preview reported zero pending additions or corrections.

The importer is validated for duplicate prevention, resuming partial work, preserving deliberately deleted records, and rejecting changed before-values. New content is checked for bilingual descriptions, supported source dates, map bounds, translated tags and experience-filter coverage. Known generic map points and the three withheld records are covered by regression assertions.

Browser checks cover town and experience filters, 30/60-result pagination and reset, English description search, French controls at 320 pixels, and source links in details. Optional distance/sort settings are collapsible to keep more space for results. Full Chromium/WebKit suite: 23 passed and one explicit WebKit service-worker skip. The compact-controls change received an additional targeted layout/accessibility run. Physical devices and current venue operating status are not established by these automated checks.
