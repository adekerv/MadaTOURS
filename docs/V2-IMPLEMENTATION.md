# MadaTours v2 implementation

Source: owner-approved “MadaTOURS improvement prompt v2 (final).md”, 29 September 2026.

## Constraints

Keep Laravel 13, React/TypeScript, Supabase Auth/Postgres/RLS, Capacitor, hash routes, public/build, bilingual UI, offline discovery and account deletion. Add migrations; never replace production data. Core discovery remains public. Email verification now supersedes the earlier immediate-signup decision.

## Work tracking

- [ ] WP1 Google key validation, matching/enrichment and compliant attribution.
- [ ] WP2 Local category-specific illustrative fallbacks.
- [ ] WP3 Account-owned reviews, comments, check-ins, moderation and rating filters.
- [ ] WP4 Separate Google and community ratings and sorting.
- [ ] WP5 Larger category-colored emoji pins.
- [ ] WP6 Accepted followers, private activity, verified-email events, expiry and moderation.
- [ ] WP7 Official-source ingestion, robots compliance and per-place audit log.
- [ ] WP8 Explainable editable location-based route suggestions.
- [ ] WP9 Google-based daily MUST GO ranking with review threshold.
- [ ] WP10 Photo/coordinate-required submissions and moderation notifications.
- [ ] WP11 Optimistic saves and lightweight motion.
- [ ] WP12 Persisted/system dark mode, including map.
- [ ] Privacy/terms, translations, database/API/browser tests, web/native build checks.
- [ ] Preview verification and production deployment.

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
