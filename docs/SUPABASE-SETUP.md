# Supabase + your existing Vercel project

The selected setup is Supabase Free for PostgreSQL and accounts, with the existing Vercel `mada-tours` project for the website and API. A custom website domain is unnecessary for the class demonstration. Free-tier limits can change; check [Supabase pricing](https://supabase.com/pricing) and [Vercel Hobby](https://vercel.com/docs/plans/hobby). Supabase Free projects may pause after inactivity, so check the project before your presentation.

## Current project status — September 24, 2026

The database and production environment are already configured. The live site is https://mada-tours.vercel.app, and both its public API and mobile browser sign-in/favorites have passed live checks. You do not need a DATABASE_URL or another database initialization for the current setup. The remaining decision is demo accounts versus email-provider setup for classmates' self-service signup; email templates and actual delivery still need verification. The sections below remain the repeatable setup reference.

## 1. Local configuration

Your `.env.local` should contain the project URL, publishable key, and server-only secret from Supabase Project Settings → API Keys. These are three distinct values. Do not replace an existing file with the example or paste secrets into chat.

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
APP_ORIGIN=https://YOUR_PUBLIC_WEBSITE.vercel.app
ALLOWED_ORIGINS=capacitor://localhost,https://localhost
VITE_API_URL=
```

`APP_ORIGIN` is the exact website origin: no path, `/api`, trailing slash, or `vercel.com` dashboard address. Find it in your Vercel project → Settings → Domains. Empty `VITE_API_URL` is correct for the website. The secret key must never appear in a `VITE_` variable or client code.

## 2. Initialize the database once

Generate the current schema and seed:

```sh
npm run db:prepare
```

Choose one method:

- **SQL Editor:** open your Supabase project → SQL Editor → New query, paste the complete contents of `supabase/setup.sql`, and run it.
- **Command line:** open Supabase's **Connect** dialog and copy a PostgreSQL connection string into `DATABASE_URL` in `.env.local`. Replace its password placeholder with the database password, URL-encoding special characters in that password. The Session pooler is suitable when your network lacks IPv6. Then run:

```sh
npm run db:apply -- --apply
```

The command requires certificate-verified TLS. If your local trust setup cannot validate Supabase's certificate, use the SQL Editor; do not disable certificate verification. See [Supabase connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres).

The SQL runs in one transaction, creates namespaced `mt_*` tables, enables row-level security and seeds 24 records (17 public, 7 awaiting verification). Re-running the same setup preserves existing place edits and deletions. It does not migrate old SQLite accounts or arbitrary existing schemas. `DATABASE_URL` is only needed by the setup command, not the running application or Vercel.

## 3. Configure email authentication

In Supabase Authentication:

1. Enable email/password signup and keep **Confirm email** enabled.
2. Set the minimum password length to **12** to match the app. Use a short email OTP expiry such as **600 seconds**; the form accepts 6–10 numeric digits.
3. Under Email Templates, replace **Confirm signup** with `supabase/templates/confirm-signup.html`, and **Reset password** with `supabase/templates/reset-password.html`. Preserve `{{ .Token }}` exactly. This app asks users to enter an emailed code; the default link-only templates do not match that flow.
4. Under URL Configuration, set **Site URL** to the actual public Vercel website. The code-based flow does not require broad wildcard redirect URLs.
5. Configure a custom SMTP provider and verified sender in Supabase's SMTP settings. Enter SMTP credentials there, not in frontend variables.

Supabase's built-in sender is currently limited to project-team addresses and two messages per hour. Arbitrary classmates cannot register through it. A custom SMTP service is required for their verification and recovery emails. Provider signup, sender verification and deliverability must be completed and tested before presenting. See [Supabase SMTP instructions](https://supabase.com/docs/guides/auth/auth-smtp).

For a class demonstration before SMTP is ready, you can deliberately create separate demonstration users in Supabase Authentication → Users with confirmed emails, then demonstrate login and saved-place persistence. This does not demonstrate verification/recovery delivery; do not claim that it does. Do not disable email confirmation for general public signup.

## 4. Check and run locally

```sh
npm run setup:check
npm run dev
```

The checker reports key acceptance, schema version, catalogue visibility, guest restrictions, and public Auth settings. It prints no keys, passwords, email addresses, or user records. A passing check does not establish SMTP delivery or full RLS correctness; automated SQL tests and the live demonstration provide additional checks.

Visit http://localhost:3000/api/health. The expected response is:

```json
{ "status": "ok", "database": "supabase" }
```

For an optional live backend smoke test:

```sh
npm run test:live -- --run
```

This creates two temporary accounts, generates real Supabase verification/recovery codes without sending emails, checks the application API and direct RLS restrictions, and deletes its test accounts. It does not change existing accounts or venues. It targets the configured Supabase project; expect ordinary Supabase audit records and short-lived rate-limit counters. To check the deployed API instead of a local API instance, use `npm run test:live -- --run --url https://mada-tours.vercel.app`; the URL must exactly match your HTTPS APP_ORIGIN. This is separate from the isolated `npm test` suite.

Create and verify your own account. If you need catalogue administration:

```sh
npm run admin:grant -- your-confirmed-email@example.com
```

Reload afterward. Only grant admin to an account you control. Roles come from the database, never from signup form metadata.

## 5. Configure the existing Vercel project

Open [mada-tours settings](https://vercel.com/ade-kerv-s-projects/mada-tours/settings/environment-variables). Add these variables for **Production**:

| Variable                   | Value                                                             |
| -------------------------- | ----------------------------------------------------------------- |
| `SUPABASE_URL`             | Same project URL as local                                         |
| `SUPABASE_PUBLISHABLE_KEY` | Same publishable key                                              |
| `SUPABASE_SECRET_KEY`      | Same server-only secret; mark sensitive                           |
| `APP_ORIGIN`               | Actual public HTTPS website origin                                |
| `ALLOWED_ORIGINS`          | `capacitor://localhost,https://localhost` if using native clients |

Leave `VITE_API_URL` empty for web. Remove obsolete runtime database settings after confirming they are no longer used. Do not upload `.env.local` or add `DATABASE_URL` to the web bundle. Use a separate Supabase project for isolated preview data if needed; do not automatically share production secrets with every preview.

Use repository root as Root Directory, Node 24, build command `npm run build`, and output directory `dist/web`. `vercel.json` routes `/api/*` to the Express function and serves `/sw.js` and `/photos/*` as real files. The existing GitHub integration deploys changes pushed to its configured production branch; saving files locally does not update the website. Environment changes require a new deployment. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## 6. Verify the public release

1. Wait until the new deployment is Ready and check its build logs.
2. Open the public URL in a private browser, without a Vercel account. If deployment protection blocks it, configure appropriate public access for the class site.
3. Check `/api/health` and `/api/places`; confirm JSON responses and actual catalogue data.
4. Check `/sw.js` returns JavaScript and `/photos/balata.jpg` returns an image.
5. Follow [CLASS-DEMO.md](CLASS-DEMO.md) on two independent devices, including a real emailed code and password recovery.

A static page displaying the bundled guide does not prove the backend is working. Do not mark the release complete until the health endpoint and persistent account actions work remotely.
