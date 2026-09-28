# Laravel and Supabase setup

Laravel serves the website and API. Supabase provides PostgreSQL and Auth; the migration preserves existing accounts and saved places. See [deployment](DEPLOYMENT.md) for PHP/container hosting.

## 1. Configure Laravel

Install PHP/Composer and Node dependencies as described in the [README](../README.md). Copy `.env.example` to `.env` for a new installation and run `php artisan key:generate` once. Existing private `.env.local` files remain supported when `.env` is absent; transfer settings before creating `.env` on an existing installation.

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` from your project's Connect/API settings. All three are server-only in this application. `APP_URL` and `APP_ORIGIN` must match the application origin (`http://127.0.0.1:8000` locally). Leave `VITE_API_URL` empty for web builds. Keep secrets out of Git and browser-prefixed variables.

## 2. Initialize or adopt the database

Use the Supabase **direct connection or session pooler** PostgreSQL URI for `DB_URL`. Percent-encode reserved characters in passwords. `DATABASE_URL` is an alias when `DB_URL` is absent. Keep TLS enabled for hosted connections.

```sh
php artisan migrate --seed
php artisan supabase:check
```

Migrations create or adopt the `mt_*` schema and add query indexes. The transaction-protected seed inserts 364 records on first initialization (354 public, 10 drafts). An advisory lock prevents concurrent seed runs; a metadata receipt preserves later edits and deletions. Existing accounts and IDs remain in place. Migrations require Supabase's `auth.users`, `auth.uid()` and API roles; a plain empty PostgreSQL database is not a substitute for Supabase Auth.

If direct database credentials are unavailable:

```sh
php artisan db:export-setup
```

Review `supabase/setup.sql` and run it once in your project's SQL Editor. It is generated from the same Laravel schema and seed sources, and is repeat-safe. `php artisan migrate --seed` can later adopt that installation and record migration history. The application runtime only needs the API settings, so remove `DB_URL` from runtime containers when migrations run elsewhere.

Do not use `migrate:fresh`, `db:wipe` or drop the auth schema on an existing project. Back up before adopting a production database. For catalogue expansion on an already seeded database, follow [catalogue import](CATALOGUE-RESEARCH.md).

## 3. Configure email verification and recovery

Enable email signup and confirmation in Supabase Auth. Set the Auth Site URL to the deployed Laravel HTTPS origin. The app accepts numeric codes rather than link callbacks:

- Use `supabase/templates/confirm-signup.html` for signup confirmation.
- Use `supabase/templates/reset-password.html` for password recovery.
- Both templates must contain `{{ .Token }}`. Signup and recovery use separate verification types.

Configure a transactional SMTP provider for delivery to your intended users. Keep its password only in private configuration.

The optional management tool previews changes by default:

```sh
npm run auth:configure
npm run auth:configure -- --apply
# To configure the SMTP settings from SUPABASE_SMTP_* too:
npm run auth:configure -- --smtp
npm run auth:configure -- --smtp --apply
```

This maintenance tool requires `SUPABASE_ACCESS_TOKEN` from your Supabase account settings. It backs up affected configuration, applies the requested settings, and reads them back. Without `--smtp` it does not submit SMTP credentials. It does not disable confirmation or send a test email. Remove management credentials from runtime environments afterward.

Verify delivery with an inbox you control: create an account, enter its confirmation code, sign out and back in, then request a recovery code and set a new password. The automated test provider cannot verify real SMTP delivery.

## 4. Run and provision administrators

```sh
composer dev
# In another terminal:
php artisan supabase:check
php artisan admin:grant your-verified-email@example.com
```

Open `http://127.0.0.1:8000/api/health`; a configured schema returns `{"status":"ok","database":"supabase","framework":"laravel"}`. Administrator provisioning requires an existing verified account and uses only server-held credentials. Users cannot assign their own roles.

## 5. Verify a deployment

Follow [the deployment guide](DEPLOYMENT.md), then run the read-only `supabase:check`. The optional live check creates temporary accounts without sending email:

```sh
npm run test:live -- --run --url https://your-laravel-origin.example
```

The URL must match configured `APP_URL` or `APP_ORIGIN`. The check covers real verification codes, password recovery, session cookies, saved-list persistence, RLS isolation and deletion, then removes its test accounts. It still requires a separate real-inbox delivery check. Existing Vercel URLs do not automatically switch to Laravel; update hosting and native API origins as part of release.
