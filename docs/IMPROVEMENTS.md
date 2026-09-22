# Review and improvement plan

## Changes made

- Replaced overlapping Firebase, Supabase, Drizzle, simulated SQL, and duplicate API routes with a shared Node API, a production PostgreSQL schema, and persistent local SQLite development storage. Archived the unused Laravel examples.
- Replaced plaintext/default credentials, email-based privilege escalation, and trusted localStorage profiles with password hashing, server sessions, explicit admin provisioning, ownership checks, write-origin protection, and database-backed authentication throttling.
- Fixed actual deletion of saved places, place deletion cascades, duplicate saves, misordered hours/tags, string-valued database tags, PostgreSQL seed ID collisions, and unsafe database fallback behavior.
- Added password-confirmed account deletion and server-side session revocation. Removed public demo-admin buttons.
- Rebuilt responsive home, discovery, saved-list, account, and administration screens. Added mobile List/Map navigation, scrollable dialogs, safe areas, touch-friendly controls, readable form text, keyboard search, accent-insensitive matching, and visible feedback.
- Unified catalogue loading, so administrator additions are searchable and selectable without editing the bundled JSON. Distances are calculated locally, requests are cancelled on unmount, and obsolete location results are ignored.
- Fixed hiking matching, zero-valued coordinates/ratings/distances, selected-place navigation, map resize behavior, and browser history.
- Removed IP geolocation fallback after location failure and fabricated weather values. Weather identifies Fort-de-France and its provider. Catalogue photos and ratings are labeled honestly.
- Simplified promotional text and corrected the starting catalogue's copy, removing unsupported superlatives and overly specific promotional claims. No claim is made that all venue facts have been independently verified.
- Added iOS/Android project scaffolds, native location and Back behavior, API-origin configuration, original development artwork, self-hosted fonts, strict TypeScript, ESLint, formatting, repeatable automated tests, and a CI workflow.
- Updated vulnerable dependencies and removed unused packages. The remaining Xcode parser's `uuid` dependency is overridden to compatible v11; native project generation was checked with this override.

## Highest-priority work before public release

1. **Verify the places.** Work through every venue with reliable local sources or the operator. Confirm current existence, access, coordinates, prices, hours, and accessibility. Replace stock photographs with licensed images of the actual venue. Add source URLs, ownership/permission records, and a last-verified date. Unsourced guide ratings should be replaced by a transparent editorial system or real moderated reviews.
2. **Finish production accounts.** Add verified-email signup and a secure password-reset flow. Establish monitoring, database backups, abuse prevention at the hosting edge, and a rehearsed recovery process. The current password/session implementation is a substantial repair, not an independent security certification.
3. **Complete native validation.** Host the API, configure the real bundle IDs and signing, compile in Xcode/Android Studio, then test on phones and tablets. Verify native cookie persistence and external map directions in particular.
4. **Prepare privacy and support.** Publish operator/contact information, support and privacy pages, retention practices, and accurate store disclosures. Review third-party photo, map, and weather service terms for the intended production use.
5. **Establish content operations.** Add editing, draft/published status, moderation, an audit trail, and a way for venue owners or visitors to report incorrect information. The current admin interface adds/deletes records; it does not yet provide an editorial workflow.

## Product ideas worth building next

| Idea                         | User benefit                                     | First useful version                                                                                    |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| French and English           | Makes the guide useful to residents and visitors | Translated interface and place descriptions, with a persistent language choice                          |
| Day-trip planner             | Turns discovery into a usable plan               | Arrange saved places into an ordered day, with estimated travel time from a routing provider            |
| Better filters               | Helps people choose suitable places quickly      | Price range, family suitability, accessibility, amenities, and activity difficulty, using verified data |
| Offline saved lists          | Keeps plans available with weak reception        | Store a readable local copy of selected places and clearly show its last update                         |
| Native sharing               | Makes planning together easier                   | Share a place or itinerary through the device share sheet and an addressable link                       |
| Verified opening information | Reduces wasted trips                             | Structured hours, exceptional closures, and a timestamp; only show “open now” when the data supports it |
| Revisit reminders            | Gives the revisit list a clear next action       | Optional date and local notification, with permission requested when a reminder is created              |
| Local editorial collections  | Adds a reason to return                          | Curated food routes, accessible outings, rainy-day ideas, and seasonal highlights                       |
| Responsible visitor guidance | Helps people plan realistic outings              | Verified trail access, difficulty, transport options, and links to official conditions                  |

A sensible first public beta would focus on a smaller verified catalogue, French/English support, dependable saved places, and a useful day planner. Expand the catalogue and add booking/payment integrations only after that core experience works well.

## Deliberate limits

No production deployment, remote database migration, email delivery, push notification setup, native signing, or App Store submission was performed. Account recovery, complete offline maps, real visitor reviews, bookings, and a public privacy policy are not implemented. The archived Laravel directory is not a runnable Laravel application.
