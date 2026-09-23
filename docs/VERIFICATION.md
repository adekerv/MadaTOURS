# Verification record — September 23, 2026

Environment: macOS on Apple Silicon, Node 26.0.0, npm 11.14.1. CI is configured for Node 24.

## Automated checks

- ESLint and strict TypeScript pass.
- Nine API, PostgreSQL security, catalogue, search, planner and translation tests pass. They cover owner-only saved lists, rejected role changes, recovery/logout/deletion, foreign-key cascades and seed reruns.
- 21 browser scenarios pass, with one explicit WebKit offline skip. The browser suite uses Chromium and WebKit, seven representative viewport sizes, keyboard search, location denial, error states, account/saved-place/admin flows, password recovery and French planner persistence.
- The production service worker is tested with a complete offline reload and saved-place reading in Chromium. The equivalent WebKit service-worker automation is explicitly skipped; physical Safari offline behavior remains to be checked.
- Axe scans check serious/critical accessibility violations on home, exploration and authentication, rather than claiming a complete accessibility audit.
- Production web/server build passes. Capacitor sync passes for both platforms; this does not compile or sign a native application.
- Production dependency audit reports zero known vulnerabilities.
- The generated browser files were checked for the configured Supabase keys and database connection string; none were present.

API/browser authentication uses a test-only Supabase contract double backed by PGlite, an embedded PostgreSQL engine. Tests do not send emails, alter remote users or prove real Supabase cookie/email behavior. External weather and map tiles are controlled in the browser tests. Photos and a French mobile planner screenshot were visually inspected.

## Live configuration checks

The Supabase project URL, publishable key and server secret have been checked remotely without printing credentials. Auth accepts the secret; public settings show email signup and email confirmation enabled.

The application tables are now initialized. Schema version, public catalogue, draft filtering and guest restrictions pass against the live Supabase project. APP_ORIGIN is the remaining missing setting in the configuration check.

`npm run test:live -- --run` passed against the real hosted project: real signup-code verification, password recovery, HttpOnly API cookies, independent login sessions, persisted favorites, duplicate-save handling, cross-user RLS isolation, rejected self-promotion, logout and password-confirmed account deletion. Two temporary accounts were created and removed. Supabase admin-generated OTPs were used without email delivery; actual inbox delivery and configured email templates remain unverified. No existing users or venues were changed.

The live smoke script is opt-in because it temporarily writes test accounts and saved rows. Supabase may retain normal audit logs and expiring abuse counters from these checks.

The Supabase MCP configuration is saved and reports OAuth authentication, but its tools remain unavailable in this conversation. A direct connection returned HTTP 403 with the narrow project/database credential. Live application checks succeeded independently through the official Supabase client.

Vercel connector requests previously returned HTTP 403 for the owner's `ade-kerv-s-projects` scope. No deployment was published from this session, and production Vercel routing has not been exercised. The dashboard URL is known; the public website URL still needs confirmation.

## Remaining release verification

After setting APP_ORIGIN, rerun `npm run setup:check`. Then follow [CLASS-DEMO.md](CLASS-DEMO.md) against the public deployment for real email verification/recovery, session restoration, cross-device persistence and account deletion.

Physical iPhone/iPad/Android testing, native compilation/signing, native cookie persistence, App Store review, load testing, backups/restoration and exhaustive venue verification are not completed. The Java SDK found inside the repository is excluded from formatting/deployment but remains tracked pending separate repository cleanup.
