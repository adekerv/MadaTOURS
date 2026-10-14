# Status and next steps

## Implemented

- Supabase PostgreSQL and authentication with row-level security, accounts without email (one-time recovery codes reset a password), Google sign-in, administrator roles, private saved lists and account deletion.
- French/English interface and place descriptions, persistent language preference and accent-insensitive search.
- Device-local day plans with ordered stops, visit durations, notes and directions. Distances between stops are straight lines, not driving estimates.
- Island tours curated by administrators, with road routes from OpenRouteService.
- Reviews with photos, comments, check-ins, followers and meet-ups (only Google-verified accounts can join), with moderation.
- A full admin dashboard: places, tours, meet-ups, users, reviews, the contact inbox, submissions, photo permissions, sources and Google matching, site content and an activity log.
- Source-cited listings with a repeatable audit, forty places with their own credited photo, labelled illustrations for the rest, and photo reports.
- Offline saved-place text and a cached app shell; responsive, accessible layouts; Capacitor iOS and Android projects.

## Before the class release

The site is live on Vercel (https://mada-tours.vercel.app). Apply every `database/schema` file to the live Supabase project (see [deployment](DEPLOYMENT.md)), get the GitHub `Application checks` workflow passing, and rehearse the [class demonstration](CLASS-DEMO.md) on a computer and a phone.

## Suggested next product work

1. Sync day plans to the account, with an optional read-only share link.
2. Add source-aware editing and draft publication to the admin **Places** section (today it adds and deletes; detailed edits and publishing happen in Supabase), then verify and publish the ten drafts.
3. Obtain more venues' own photos, with recorded permission where they come from the business.
4. Add structured accessibility, transport and parking details from cited sources.
5. Add monitoring for API errors and Supabase availability, and a tested backup-and-restore routine.
6. Sign and test the native apps on physical devices, then prepare TestFlight and Play testing ([mobile](MOBILE.md)).

## Repository maintenance

Keep PHP application code under `app/` and frontend code under `resources/`. A database change is a repeat-safe file in `database/schema`, plus a migration that applies it and an entry in `app/Console/Commands/ExportDatabase.php`; then run `php artisan db:export-setup`. Do not add a second API server. `composer check`, `npm test` and the browser suite verify the maintained paths.
