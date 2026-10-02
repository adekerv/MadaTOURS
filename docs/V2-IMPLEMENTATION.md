# MadaTours v2 implementation

Source: owner-approved “MadaTOURS improvement prompt v2 (final).md”, 29 September 2026.

## Constraints

Keep Laravel 13, React/TypeScript, Supabase Auth/Postgres/RLS, Capacitor, hash routes, public/build, bilingual UI, offline discovery and account deletion. Add migrations; never replace production data. Core discovery remains public. Email verification now supersedes the earlier immediate-signup decision.

## Work tracking

- [x] WP1 Google key validation, matching/enrichment and compliant attribution.
- [x] WP2 Local category-specific illustrative fallbacks.
- [x] WP3 Account-owned reviews, comments, check-ins, moderation and rating filters.
- [x] WP4 Separate Google and community ratings and sorting.
- [x] WP5 Larger category-colored emoji pins.
- [x] WP6 Accepted followers, private activity, verified-email events, expiry and moderation.
- [x] WP7 Official-source ingestion, robots compliance and per-place audit log.
- [x] WP8 Explainable editable location-based route suggestions.
- [x] WP9 Google-based daily MUST GO ranking with review threshold.
- [x] WP10 Photo/coordinate-required submissions and moderation notifications.
- [x] WP11 Optimistic saves and lightweight motion.
- [x] WP12 Persisted/system dark mode, including map.
- [x] Privacy/terms, translations, database/API/browser tests, web/native build checks.
- [ ] Preview verification and production deployment.

## Audit 2026-10-01

All twelve packages are implemented in code and pass the PHP, Node, PostgreSQL (PGlite) and Playwright suites. WP1, WP4 and WP9 follow the compliant adaptation below rather than the cache-based wording of the v3 prompt.

Fixed in this pass:

- Recurring jobs never ran in production: the container started Apache only. `config/tasks.php` now lists every job and interval, the container runs them every minute, and `POST /api/internal/tasks` (secret-protected) plus the `Recurring tasks` workflow cover hosts that sleep.
- Google matching ran 3 places per day. It now runs hourly; the database daily cap (`GOOGLE_MATCH_DAILY_LIMIT`) is the only limit.
- `.github/workflows/check.yml` was invalid YAML, so CI could not start.
- The v2 browser test shared review text across runs and failed after the first viewport.

Still open, owner action required:

- The live Supabase database has none of the v2 schema (no reviews, events, submissions, matches or daily picks tables; no `google_place_id` column). Back up, then run `php artisan migrate --seed --force` with `DB_URL`, or paste `supabase/setup.sql` into the SQL Editor.
- No browser key (`VITE_GOOGLE_MAPS_API_KEY`) is configured, so the live Google panel cannot load.
- Set `RECURRING_TASKS_SECRET` on the host and the two GitHub secrets described in DEPLOYMENT.md.

## External dependencies discovered

- Initial checks found no Google key. Owner added GOOGLE_PLACES_API_KEY to .env.local. A single Places API (New) Text Search validation returned HTTP 200 for Jardin de Balata: ID, rating, review count and hours available; no photos returned. Key permissions/billing for this request are working. No key or returned Google content persisted to the repository. The supplied catalogue/schema has no Google Place ID field; verify live data before assuming IDs exist.
- The requested weekly Google photo-reference/content cache conflicts with the standard Places terms. Photo resource names cannot be cached. Place IDs may be retained. Places UI Kit supports third-party maps; direct Places API content has map restrictions, with distinct rules for EEA billing accounts. Owner approved a compliant adaptation preserving Leaflet. Key now validated; billing country remains unknown. Use Places UI Kit for map-associated Google content.
- SMTP delivery is still unconfigured. Implement and test email-ownership verification; do not mislabel automatically confirmed legacy accounts as verified. Configure delivery before enabling mandatory verification in production.
- Vercel connector get_project has an argument-schema mismatch; authenticated CLI environment listing works.

Primary Google references:

- https://developers.google.com/maps/documentation/places/web-service/place-photos
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://cloud.google.com/maps-platform/terms/maps-service-terms
- https://developers.google.com/maps/comms/eea/faq
