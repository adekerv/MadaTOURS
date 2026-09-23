# Class-project release plan

## Decisions from the owner

- Database: **Supabase Free** (selected September 23, 2026).
- Purpose: a web-development class project accessible remotely, with a demonstrably working backend.
- Existing hosting: Vercel project `mada-tours`, scope `ade-kerv-s-projects`, GitHub repository `adekerv/MadaTOURS`.
- Photographs: suitable openly licensed venue photographs with attribution are authorized.
- No custom domain is required for the class release.

## Implementation in progress

1. French/English interface and place descriptions.
2. Day plans and offline copies of saved places.
3. Supabase-managed authentication, verification codes, password recovery, and PostgreSQL row-level security.
4. Source-backed content corrections, photo provenance, and explicit unverified fields.
5. Repeatable SQL, environment checks, setup instructions, and demonstration script.
6. Local verification followed by live verification on the existing Vercel project.

## External setup still needed

- Supabase project URL and configuration, supplied through environment settings rather than chat secrets.
- An email delivery choice for arbitrary classmates' addresses. Supabase's built-in sender only serves authorized team addresses and has a low hourly limit.
- Vercel connector access to `ade-kerv-s-projects`. The current connection returned HTTP 403 for that scope; this is an authorization mismatch, not evidence of a broken deployment.

No live database has been changed and no new deployment has been published in this phase yet.
