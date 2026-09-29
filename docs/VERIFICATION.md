# Laravel and UX verification — September 29, 2026

The application is served by Laravel 13, with the existing React interface and Supabase database/authentication. These checks were completed locally on macOS with PHP 8.5 and Node 26. CI is configured for PHP 8.5, Node 24 and PostgreSQL 17.

## Current checks

| Check                                                  | Result                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| PHPUnit                                                | 27 passed, 122 assertions; 1 optional real-PostgreSQL migration test skipped           |
| Chromium/WebKit browser scenarios                      | 37 passed; 1 WebKit service-worker automation skip                                     |
| API, PostgreSQL RLS, content, import and utility tests | 23 passed                                                                              |
| ESLint / TypeScript, Laravel Pint, Prettier            | Passed                                                                                 |
| Production web/mobile bundles and Capacitor sync       | Passed                                                                                 |
| Store metadata and captures                            | Copy within store character limits; all 18 screenshots have their specified dimensions |
| Translation audit                                      | No missing literal UI translations; English/French information copy paired             |

Six targeted browser scenarios also passed after the final photo-refresh and unavailable-stop refinements. Public policy, terms and deletion pages passed all 12 EN/FR × 360/1440px layout checks.

The browser scenarios exercise Chromium and WebKit, with English/French flows at 360, 390 and 1440 pixels and the existing wider matrix at 320–1440 pixels. New coverage includes direct signup, personalized greeting, one planner creation action, route optimization, time summaries, suggestion drafts, hours/rating fallbacks, recent searches, shareable filters, location consent, public catalogue recovery and measured touch targets. Accessibility scans wait for finite animations to settle. Browser tests use compiled production assets even when a developer's Vite server is running; they do not alter `public/hot`.

During the earlier Laravel migration, the real migration test ran against a temporary PostgreSQL 18 server, with a minimal Supabase auth schema/role fixture. It verifies account profile adoption, seed counts, preservation of edits and deletions across reruns, identity sequence advancement and private migration metadata. The server was stopped and the temporary database removed afterward. To run it yourself, set `MADATOURS_TEST_POSTGRES_URL` to a dedicated local database whose name ends in `_test`; without it this one test is skipped. CI runs it against its dedicated PostgreSQL service.

The API and browser suites launch the real Laravel server against isolated PostgreSQL/RLS and a Supabase Auth contract double. They cover verification, sessions, roles, private saved lists, password recovery, deletion, bilingual search, responsive layouts, accessibility checks, maps and offline saved text. The public shell and public API reads do not replace account cookies or overwrite concurrent refreshes. Reloading after sign-in is explicitly covered.

The one browser skip is WebKit service-worker offline automation; Chromium verifies a complete offline reload. Physical Safari/native-device behavior still needs device testing. The current main mobile bundle is approximately 101 KB gzip. The fallback catalogue is a separate approximately 44 KB gzip chunk; the map, planner and information screens are also split.

## Hosted integration and deployment limits

A read-only Laravel `supabase:check` on September 26 confirmed schema version 1 and all 354 published places in the configured live project. That migration check did not change the hosted database. In the September 28–29 UX/auth pass, the explicitly authorized administrator reset, immediate-email-signup setting, and six reviewed description corrections were applied and verified. No hosted schema changes or deployment were performed. Actual email delivery is not covered by the Auth double.

Docker is unavailable on this workstation, so the container was reviewed but not built locally. CI is configured to build it and check `/up` and the public page. The Dockerfile uses PHP 8.5's built-in OPcache and production INI defaults. Complete [deployment](DEPLOYMENT.md), run the opt-in live account checks and verify real inbox delivery before switching production traffic.

[Earlier Node/Vercel verification records](legacy/NODE-VERIFICATION.md) are retained for historical context.

## Native and delivery limits

`npm run build:mobile` and Capacitor sync succeed for the existing iOS and Android projects. Xcode 27 is installed but its license is not accepted, and Java/Android SDK tools are unavailable. No native binary, signing, store upload or physical-device verification is claimed. The [store pack](../native-assets/store/README.md) contains webview previews, not signed-device captures.

SMTP is not configured. Local welcome-email rendering and provider-contract recovery pass; real-inbox welcome/recovery delivery remains a release dependency. Phone signup remains postponed. See [the release pass](UX-RELEASE-PASS.md) for delivered features and the remaining setup.
