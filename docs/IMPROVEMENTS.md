# Improvements and next steps

## Implemented

- Supabase PostgreSQL and managed authentication, verified email codes, password recovery, explicit administrator roles, private saved lists and account deletion.
- French/English interface and public place descriptions, persistent language preference and accent-insensitive search.
- Device-local day plans with ordered stops, visit durations, notes and directions between eligible stops. Distance is straight-line, not driving distance or a travel-time estimate.
- Offline saved-place text and a cached production app shell. Maps, weather, photos and account changes still require a connection.
- Source-backed catalogue corrections, draft publication controls, removal of unsupported ratings/hours, and three licensed venue photos.
- Responsive layouts, accessible modal behavior, location consent/manual selection, explicit failures and mobile native scaffolds.
- Repeatable setup SQL, redacted configuration checks and a class demonstration guide.

## Finish the class release first

The database, production environment and public deployment are configured, and live account/saved-place checks pass. Complete the email templates/SMTP setup in [SUPABASE-SETUP.md](SUPABASE-SETUP.md) if classmates should register themselves; separate confirmed demo accounts are an alternative for class. Rehearse on your own computer and phone. Email inbox delivery remains unverified.

## Suggested next product work

1. Add cloud itinerary synchronization with private ownership policies, then share a read-only trip link when explicitly requested by its owner.
2. Add source-aware editing and draft publication to the admin interface; obtain photos for more venues and verify the seven drafts.
3. Add opening-hours structure, accessibility information and clearly sourced transport/parking details. Avoid claiming a place is open from stale free text.
4. Add native sharing and physical-device testing, followed by privacy/support pages and TestFlight preparation.
5. Add monitoring for API errors and Supabase availability, export/backup instructions, and a tested restoration process.

## Repository maintenance

The repository currently includes `oracleJdk-27.jdk`, a roughly 368 MB development tool installation. It is excluded from web deployment and formatting. Move Java tooling outside the project and remove it from version control in a reviewed cleanup; `.gitignore` alone cannot untrack existing files. Keep downloaded SDKs, build outputs and secrets out of future commits.
