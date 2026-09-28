# Laravel verification — September 28, 2026

The application is served by Laravel 13, with the existing React interface and Supabase database/authentication. These checks were completed locally on macOS with PHP 8.5 and Node 26. CI is configured for PHP 8.5, Node 24 and PostgreSQL 17.

## Completed checks

| Check                                                  | Result                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| PHPUnit, including real PostgreSQL migration/seed test | 19 passed, 68 assertions                                                  |
| API, PostgreSQL RLS, content, import and utility tests | 17 passed                                                                 |
| Chromium and WebKit browser scenarios                  | 23 passed, 1 explicitly skipped                                           |
| ESLint and TypeScript                                  | Passed                                                                    |
| Laravel Pint and Prettier                              | Passed                                                                    |
| Composer manifest/lock validation                      | Passed                                                                    |
| Production web and mobile asset builds                 | Passed                                                                    |
| Laravel configuration, route and view caching          | Passed using isolated cache paths                                         |
| Mobile bundle inspection                               | Interface, fonts and photos present; no PHP files or duplicated web build |

The real migration test ran against a temporary PostgreSQL 18 server, with a minimal Supabase auth schema/role fixture. It verifies account profile adoption, seed counts, preservation of edits and deletions across reruns, identity sequence advancement and private migration metadata. The server was stopped and the temporary database removed afterward. To run it yourself, set `MADATOURS_TEST_POSTGRES_URL` to a dedicated local database whose name ends in `_test`; without it this one test is skipped. CI runs it against its dedicated PostgreSQL service.

The API and browser suites launch the real Laravel server against isolated PostgreSQL/RLS and a Supabase Auth contract double. They cover verification, sessions, roles, private saved lists, password recovery, deletion, bilingual search, responsive layouts, accessibility checks, maps and offline saved text. The public shell and public API reads do not replace account cookies or overwrite concurrent refreshes. Reloading after sign-in is explicitly covered.

The one browser skip is WebKit service-worker offline automation; Chromium verifies a complete offline reload. Physical Safari/native-device behavior still needs device testing. Vite reports a main-bundle size warning (about 155 KB compressed); it does not fail the build.

## Hosted integration and deployment limits

A read-only Laravel `supabase:check` on September 26 confirmed schema version 1 and all 354 published places in the configured live project. No hosted schema changes, account mutations or deployment were performed for this migration. Actual email delivery is not covered by the Auth double.

Docker is unavailable on this workstation, so the container was reviewed but not built locally. CI is configured to build it and check `/up` and the public page. The Dockerfile uses PHP 8.5's built-in OPcache and production INI defaults. Complete [deployment](DEPLOYMENT.md), run the opt-in live account checks and verify real inbox delivery before switching production traffic.

[Earlier Node/Vercel verification records](legacy/NODE-VERIFICATION.md) are retained for historical context.
