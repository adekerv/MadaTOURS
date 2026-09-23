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

## External setup still needed

- Supabase schema and API credentials are verified. Real authentication, saved-place persistence, RLS isolation and account deletion pass.
- An email delivery choice for arbitrary classmates' addresses. Supabase's built-in sender only serves authorized team addresses and has a low hourly limit.
- Vercel connector access to `ade-kerv-s-projects`. The current connection returned HTTP 403 for that scope; this is an authorization mismatch, not evidence of a broken deployment.

The database is initialized, and two temporary test accounts were created and removed during live verification. Existing users and venues were not changed. No deployment has been published in this phase. APP_ORIGIN, the public Vercel URL, and the email delivery decision remain outstanding. See SUPABASE-SETUP.md for the exact steps.
