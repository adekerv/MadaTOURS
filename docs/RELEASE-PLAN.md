# Class-project release plan

## Decisions from the owner

- Database: **Supabase Free** (selected September 23, 2026).
- Purpose: a web-development class project accessible remotely, with a demonstrably working backend.
- Existing hosting: Vercel project `mada-tours`, scope `ade-kerv-s-projects`, GitHub repository `adekerv/MadaTOURS`.
- Photographs: suitable openly licensed venue photographs with attribution are authorized.
- No custom domain is required for the class release.

## Implementation

1. French/English interface and place descriptions.
2. Day plans and offline copies of saved places.
3. Supabase-managed authentication, verification codes, password recovery, and PostgreSQL row-level security.
4. Source-backed content corrections, photo provenance, and explicit unverified fields.
5. Repeatable SQL, environment checks, setup instructions, and demonstration script.
6. Local verification followed by live verification on the existing Vercel project.

## Live release status

- Public website: https://mada-tours.vercel.app.
- Supabase schema, server credentials and production Vercel environment are configured and verified.
- The server import failure is fixed; the corrected deployment is promoted to the public domain.
- Real verification/recovery codes, saved-place persistence across independent sessions, RLS isolation and account deletion pass through the public API. Tests generated codes without sending email and removed their temporary accounts.
- A mobile Chromium browser verified login, saving a favorite and session/favorite restoration after refresh.

## Owner setup still needed

Choose separate demo accounts for the class or configure an email provider so classmates can register themselves. Supabase's built-in sender only serves authorized team addresses and has a low hourly limit. Actual email templates and inbox delivery remain unverified. See [SUPABASE-SETUP.md](SUPABASE-SETUP.md) for the email settings and [CLASS-DEMO.md](CLASS-DEMO.md) for the presentation walkthrough.

App Store release is a later milestone: physical device checks, native cookie persistence, compilation, signing and store submission are still required.
