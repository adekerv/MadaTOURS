# Verification record

Review environment: macOS on Apple Silicon, Node.js 26.0.0, npm 11.14.1.

## Automated coverage

- Strict TypeScript and ESLint, including React hook rules.
- API and utility tests: account creation, password hashing, normalization, denied privilege escalation, authenticated ownership, duplicate saves, actual deletion, foreign-key cascades, session expiry/logout, password-confirmed account deletion, malformed query input, write-origin/CSRF protection, rate limiting, and catalogue/search/distance behavior.
- PostgreSQL behavior checked with PGlite (an embedded PostgreSQL engine): schema creation, seeding, sequence advancement, unique constraints, deletion cascades, upsert throttling, repeat initialization, and refusal of the legacy schema. This does not test a hosted PostgreSQL network connection, TLS, or pooler.
- Browser scenarios run in Chromium and WebKit: seven viewport sizes (320×568, 360×640, 390×844, 667×375, 768×1024, 1024×768, 1440×900), home/list/map/detail overflow, keyboard search, browser Back, denied location, failed weather/catalogue requests, registration, saved-list persistence/removal, account deletion, and admin-created place discovery/deletion.
- Axe checks for serious/critical WCAG A/AA violations on home, exploration, and authentication screens. This is not a complete accessibility certification or a substitute for VoiceOver/TalkBack testing.
- Production web/server build, dependency audit, native asset generation, and Capacitor project creation/synchronization.

External weather, map tiles, and photos are mocked in the automated browser suite to make behavior repeatable. Manual browser inspection used the real local app and external resources. Test accounts use temporary databases; no real user accounts or remote data were modified.

## Results

The review's API/utility/PostgreSQL suite passed **14 tests**. The browser suite passed **16 scenarios** across the two browser engines. All seven sizes in each layout scenario fit without document overflow; detail dialogs remained within the viewport. No uncaught application errors were detected in those scenarios. Axe reported no serious or critical violations in the scanned screens.

The production build, ESLint/TypeScript, formatting check, native asset generation, Capacitor synchronization for both platforms, and iOS plist validation passed. `npm audit` reported zero known vulnerabilities. A production-server smoke check confirmed frontend/catalogue loading, correct missing-asset/API 404 responses, and rejection of account writes when PostgreSQL is unconfigured. Run the commands in the root README to reproduce the checks.

## Not validated here

- A physical iPhone, iPad, or Android device; native compilation or signing.
- Native HTTP cookie persistence across force-quit/relaunch, native location prompts, on-screen keyboard resizing, and external directions handoff.
- A real hosted PostgreSQL service or a deployed Vercel routing environment.
- Accuracy, opening status, hours, ratings, or licensing of all catalogue entries and photographs.
- Load testing, a third-party security review, or App Store approval.

The selected developer directory only contains Apple command-line tools. Full Xcode is required to build the iOS target; this review did not install it.
