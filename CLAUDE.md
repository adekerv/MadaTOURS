# MadaTOURS

Laravel 13 API plus a React 19 / Vite single-page app (Leaflet maps drawn by MapLibre), on Supabase (Auth, Postgres with RLS, Storage). Read AGENTS.md too: Pint, test and documentation rules live there (docs only when asked).

## Commands

- `php artisan test` PHP suite; format with `vendor/bin/pint --format agent`
- `npm run lint` (eslint + tsc), `npm run format:check`, `npm test` (node:test with PGlite), `npm run build`
- `npx playwright test` browser suite, Chromium + WebKit (iPhone 13), about 10 minutes. It builds and starts its own server (app on 3100, test provider on 3101), so do not edit code while it runs
- `php artisan db:export-setup` regenerates `supabase/setup.sql` from `database/schema/*.sql` (list the file in `ExportDatabase.php`). Live schema is installed by pasting SQL into the Supabase SQL editor; there is no migrations table
- `php artisan tours:compute-routes [--all] [--id=3]`, `php artisan account:reset-password {email}` (last-resort recovery)

## Decisions (ask before changing)

- Locked: Place IDs, Google-ratings priority, immediate reviews, followers-only, emoji pins, verified-email gate (only Google-confirmed accounts join meet-ups). Closures and any production or Supabase write need the user's explicit approval
- Accounts work without SMTP: Supabase email + password with "Confirm email" and "Secure email change" turned off in the dashboard. Eight one-time recovery codes (bcrypt at `RECOVERY_CODE_COST`, shown once) reset a password with email + one code. A failed attempt always does 8 bcrypt checks so timing hides whether an email exists. The trigger `mt_email_changed` on `auth.users` clears `email_verified_at`
- Maps: OpenFreeMap vector tiles through MapLibre inside Leaflet (`resources/js/lib/basemap.ts`). Every map sets `minZoom`/`maxZoom`. Under 440px the credit folds behind an "i" button. Every link and button must be 44px or more (`ux.spec.ts` enforces it)
- Tours: admin-curated (`mt_tours`). The road comes from OpenRouteService once per change (`ORS_API_KEY`; `ORS_BASE_URL` defaults to `api.heigit.org/openrouteservice`). A routing failure never blocks saving and a failed recalculation keeps the stored road. Changed stops clear the old road in the same write. Lists omit the geometry; `GET /api/tours/{id}` has it. Show the credit "© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors"
- `GET /api/places` is a summary without `details` and `sources`; the place page loads `/api/places/{id}` (`usePlaceDetail`), and `?full=1` is for the admin panel. The bundled seed is an offline fallback only
- Tablets (touch, short screen side 600px or more) get two-finger map gestures; phones keep still maps so the page scrolls
- Browser form pop-ups are reworded in the app language (`lib/validation.ts`); the API answers in `Accept-Language` (`ApiLocale`, `resources/lang/fr`)

## Testing

- Every literal `t('...')` needs English and French entries (`tests/translations.test.ts`); strings passed to `translate()` and server messages shown through `t(error)` are added by hand
- PHP: `Http::fake` stubs stack and the first match wins, so call it once per test; keep `Http::preventStrayRequests()`
- Browser: `await stubMap(page)` for tiles (never the network); admin via `POST :3101/__test/admin`; routing double at `:3101/__test/ors` with modes `ok`, `fail`, `garbage`; clean up tours and accounts you create
- Fake PostgREST (`tests/support/clients.ts`) lists the tables it allows and supports `eq`, `like`, `in` only
- Add new env vars to `.env.example`; never commit secrets

## Gotchas

- macOS: no `timeout`, BSD `sed -i ''`, and `echo ======` errors in zsh
- `ValidationException` returns 400 with the first message as `error`; CORS allows GET, POST, DELETE only, so updates are POSTs
- Same-URL `page.goto` does not reload in Chromium; lazy images need `scrollIntoView`; `getByLabel` on a select includes its option text, so match non-exact
- WebKit taps can land before layout settles: loading placeholders must match the loaded sizes (`PlaceCardSkeleton pick`)
- The user often commits the working tree mid-session: check `git status` and `git log`, never rewrite their commits, and keep scratch files out of the repo
