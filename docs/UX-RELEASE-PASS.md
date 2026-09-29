# MadaTours UX and release pass — September 28–29, 2026

The Laravel 13 API, React/TypeScript frontend and existing Capacitor iOS/Android projects remain in place. Guest discovery and device-local day planning remain available without an account.

## Delivered

- Live catalogue picks on the home page, ahead of the category suggestions. These are editorial picks, labeled “Places to discover”; the app does not collect evidence for a weekly popularity ranking.
- A photograph on each Explore card and in details, with lazy decoding, loading placeholders and a failure state. Three photographs depict their named locations. Other listings use an explicitly labeled, licensed island illustration; they do not claim to show the venue.
- Recent searches, useful empty states, one-time introductory guidance, catalogue caching and connection/retry notices. The public catalogue is stored separately from private saved-place copies; no session tokens are stored there. The bundled fallback catalogue is a separate JavaScript chunk.
- One New day trip action, a trip selector, an illustrated empty state, nearest-neighbor ordering anchored at the first stop, and a visit/travel/total-time summary. Reordering only applies if it shortens straight-line distance; the travel allowance is explicitly approximate, not a routed ETA.
- Explicit nearby-place permission flow, live distance ordering and manual map alternatives. Search, town, experience, radius, category and selected place remain shareable in Explore hash links. GPS coordinates are never put into those links.
- Skeleton loading, weather retry, card/modal transitions, reduced-motion support, safe-area spacing and measured 44px controls. Safari select controls now use consistent sizing. The search-center map marker is decorative rather than a misleading interactive control.
- Bilingual About, Contact, Privacy, Terms and account-deletion information; photo and data credits; a suggestion form that prepares an email draft for the user to send. Public policy URLs also render without JavaScript.
- Open Graph/Twitter metadata and bilingual share artwork. The store asset folder contains names, subtitles, keywords, descriptions, feature graphics, icon export and 18 English/French screenshot previews.

## Authentication and administration

Email signup asks for a name and signs in immediately. Supabase email confirmation was disabled explicitly and verified. Phone signup is postponed. The app greets the person by name and shows a signup thank-you. Laravel has bilingual welcome-email templates with a delivery-failure fallback that preserves the new account.

The existing approved administrator account was promoted and its password replaced. The generated credential is in the private `.data/admin-credentials/` directory, permission 0600 and excluded from Git. The command verifies administrator role and password sign-in, then revokes refresh sessions. No password is included in this document or in store assets.

Password-recovery and legacy pending-account verification flows are covered by provider-backed test fixtures. **SMTP is not configured:** welcome messages are currently local log previews, and public real-inbox recovery delivery has not been verified. See [Supabase setup](SUPABASE-SETUP.md) for the separate Laravel welcome and Supabase recovery transport settings.

## Reviewed catalogue corrections

Six bilingual descriptions were corrected using the tourism sources stored with each entry: Le Sunny’s Beach, Quinoa Beach, Senat Beach, Chez Bernadette, Cotton BAY and La Presqu’ilienne. The reviewed batch is [2026-09-28.json](../supabase/catalogue/2026-09-28.json). It includes old/new field values, keeps IDs and coordinates, and refuses to overwrite newer edits.

The batch was previewed, backed up locally, applied to the existing Supabase catalogue and read back successfully: 354 public places and 10 drafts. The seed catalogue and SQL bootstrap export include the same descriptions. Accounts and saved places were not changed by that import.

## Verification

The test suite covers signup/sign-in, recovery, admin editing, saved-place ownership, deletion, RLS, policy URLs, route optimization, URL compatibility, storage corruption, offline recovery, geolocation consent, bilingual phone/desktop flows, touch targets and accessibility. Review [VERIFICATION.md](VERIFICATION.md) for the final counts and environment limits.

Web and mobile production bundles build, and Capacitor sync updates both existing native projects. No new framework or native project layout was introduced. The primary mobile bundle is approximately 101 KB gzip; the 44 KB gzip fallback catalogue and map/planner/information screens load as separate chunks.

## Remaining release dependencies

- Configure SMTP and verify welcome/recovery delivery to a real inbox.
- Deploy this Laravel build and verify its public policy URLs and native API origin. This pass did not deploy or submit an application.
- Xcode 27 is installed, but its license has not been accepted; simulator/native builds are blocked. Java and the Android SDK were not available on this machine. Web/Capacitor compilation is not evidence of signed native binary validation.
- Confirm the owned bundle identifier, developer teams, signing, store privacy/data-safety declarations and physical-device behavior. The screenshots are faithful webview previews; replace them with captures of the signed native build before submission.
- The guide still has unknown hours/ratings and only three venue/location photographs. The UI makes those limits explicit and links to venue/source information.

The store copy and artwork are in [native-assets/store](../native-assets/store/README.md). Existing database backups and administrator credentials remain private under `.data/`.
