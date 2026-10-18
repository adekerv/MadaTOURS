# Verification — October 18, 2026

These checks ran locally on macOS with PHP 8.5 and Node 26, on `main` after the end-of-project clean-up. CI is configured for PHP 8.5, Node 24 and PostgreSQL 17.

| Check                                                  | Result                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| PHPUnit (`php artisan test`)                           | 164 passed, 793 assertions; 1 skipped (the real-PostgreSQL migration test, see below) |
| API, PostgreSQL RLS, content and utility (`npm test`)  | 74 passed                                                                             |
| Chromium and WebKit browser flows (`npm run test:e2e`) | 132 passed, 2 skipped (Chromium-only: service-worker offline reload, tablet gestures) |
| ESLint and TypeScript, Laravel Pint, Prettier          | Passed                                                                                |
| Production web build                                   | Passed                                                                                |

The browser suite runs the real Laravel server against an in-memory PostgreSQL with the full schema and row-level security, and a stand-in for Supabase Auth and OpenRouteService. It covers signup with recovery codes, password reset, sessions, roles, saved lists, account deletion, the admin dashboard, tours and their road routes, reviews with photos, submissions, bilingual layouts from 320 to 1440 pixels, 44-pixel touch targets, accessibility scans, maps and offline saved text. Map tiles are served from a local fixture. CI also skips the tablet gesture test, because synthesized touch scrolling does not reach the page on its Linux runner; run it locally after map changes.

The migration test runs only when `MADATOURS_TEST_POSTGRES_URL` points at a dedicated local database whose name ends in `_test`; CI runs it against its PostgreSQL service. On October 14 its schema steps were also replayed on PGlite: every migration, then the seed, then both again, keeping the existing account, edits and deletions.

## Not covered by these checks

- The live database: schema files are applied by hand in the Supabase SQL Editor (see [deployment](DEPLOYMENT.md)). `php artisan supabase:check` is the read-only live check.
- Physical devices and native builds. `npm run build:mobile` and Capacitor sync work, but no signed binary, simulator build or store upload has been made ([mobile](MOBILE.md)).
- The Docker image, which is built only in CI.
