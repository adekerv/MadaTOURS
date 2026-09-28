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

## 3. Immediate signup, welcome emails and password recovery

Keep the email provider enabled, and disable **Confirm email** for new signups. The application asks for a display name, email and password, then signs the user in immediately. Name metadata is used only for display; administrator roles still come from the protected profile table. Phone signup is postponed.

```sh
npm run auth:signup
npm run auth:signup -- --apply
```

This explicit maintenance command requires a private `SUPABASE_ACCESS_TOKEN`. It previews, backs up and changes only `mailer_autoconfirm`, then reads it back. It does not reset existing passwords, enable SMS, or configure SMTP. Remove management credentials from production runtime environments.

Welcome messages are sent by Laravel using `resources/views/emails/welcome.blade.php` and its text alternative. Set `MAIL_MAILER=smtp`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, and `MAIL_FROM_NAME` in private configuration to deliver them. With `MAIL_MAILER=log`, emails are previews in the local Laravel log, not delivered messages. A delivery failure is logged without credentials and does not undo a successful signup. The app always shows the signup thank-you and personalized welcome.

Password recovery still verifies ownership using a numeric code sent by Supabase. Set the Auth Site URL to the deployed Laravel HTTPS origin and use `supabase/templates/reset-password.html` as the recovery template. The existing confirmation template and verification endpoint remain only for older pending accounts; new signups do not enter this flow.

For hosted recovery email delivery, configure your provider in Supabase separately. The existing helper previews/applies the numeric templates and can configure `SUPABASE_SMTP_*` settings when credentials are available:

```sh
npm run auth:configure
npm run auth:configure -- --smtp --apply
```

This helper does not re-enable confirmation. Laravel welcome SMTP and Supabase recovery SMTP are separate settings and may use the same provider. The built-in Supabase sender has recipient restrictions, so it is not a replacement for production SMTP. Without a provider, do not claim real inbox delivery has been verified.

## 4. Run and provision administrators

```sh
composer dev
# In another terminal:
php artisan supabase:check
php artisan admin:create your-email@example.com --name="Your name"
```

Open `http://127.0.0.1:8000/api/health`; a configured schema returns `{"status":"ok","database":"supabase","framework":"laravel"}`. Administrator provisioning uses only server-held credentials and can create an account or explicitly update an existing one. Users cannot assign their own roles.

The generated password is written once to a private file under `.data/admin-credentials/` (file permissions 0600; ignored by Git). The command verifies password sign-in and administrator access. It refuses to replace an existing password unless `--replace-password` is explicitly supplied. `admin:grant` remains available when an existing account only needs a role change. Passwords are held by Supabase Auth as hashes, not in application source code.

## 5. Verify a deployment

Follow [the deployment guide](DEPLOYMENT.md), then run the read-only `supabase:check`. The optional live check creates temporary accounts without sending email:

```sh
npm run test:live -- --run --url https://your-laravel-origin.example
```

The URL must match configured `APP_URL` or `APP_ORIGIN`. The check covers real verification codes, password recovery, session cookies, saved-list persistence, RLS isolation and deletion, then removes its test accounts. It still requires a separate real-inbox delivery check. Existing Vercel URLs do not automatically switch to Laravel; update hosting and native API origins as part of release.
