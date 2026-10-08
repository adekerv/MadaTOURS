# Improvements and next steps

## Implemented

- Supabase PostgreSQL and managed authentication, accounts without email (one-time recovery codes reset a password), Google sign-in, explicit administrator roles, private saved lists and account deletion.
- French/English interface and public place descriptions, persistent language preference and accent-insensitive search.
- Device-local day plans with ordered stops, visit durations, notes and directions between eligible stops. Distance is straight-line, not driving distance or a travel-time estimate.
- Offline saved-place text and a cached production app shell. Maps, weather, photos and account changes still require a connection.
- Source-backed catalogue corrections, draft publication controls, removal of unsupported ratings/hours, and three licensed venue photos.
- Responsive layouts, accessible modal behavior, location consent/manual selection, explicit failures and mobile native scaffolds.
- Repeatable setup SQL, redacted configuration checks and a class demonstration guide.

## Finish the class release first

The Laravel version is live on Vercel (https://mada-tours.vercel.app). Accounts need no email: see [accounts without email](ACCOUNTS-WITHOUT-EMAIL.md). Before the class release, make sure every `database/schema` file is applied to the live Supabase project, get the automated checks passing again, and rehearse on your own computer and phone.

## Suggested next product work

1. Add cloud itinerary synchronization with private ownership policies, then share a read-only trip link when explicitly requested by its owner.
2. Add source-aware editing and draft publication to the admin interface; obtain photos for more venues and verify the seven drafts.
3. Add opening-hours structure, accessibility information and clearly sourced transport/parking details. Avoid claiming a place is open from stale free text.
4. Add native sharing and physical-device testing, followed by privacy/support pages and TestFlight preparation.
5. Add monitoring for API errors and Supabase availability, export/backup instructions, and a tested restoration process.

## Repository maintenance

Keep PHP application code under `app/`, frontend code under `resources/`, and database changes under `database/migrations/`. Do not add a second API server. Generated assets, dependencies, local SDKs and private environment files are ignored. `composer check`, `npm test` and the browser suite verify the maintained Laravel paths.
