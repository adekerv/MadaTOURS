# Laravel and Supabase setup

Laravel serves the website and API. Supabase provides PostgreSQL, Auth and photo storage; installing the schema preserves existing accounts and saved places. See [deployment](DEPLOYMENT.md) for hosting.

## 1. Configure Laravel

Install PHP/Composer and Node dependencies as described in the [README](../README.md). Copy `.env.example` to `.env` for a new installation and run `php artisan key:generate` once. Existing private `.env.local` files remain supported when `.env` is absent; transfer settings before creating `.env` on an existing installation.

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` from your project's Connect/API settings. All three are server-only in this application. `APP_URL` and `APP_ORIGIN` must match the application origin (`http://127.0.0.1:8000` locally). Leave `VITE_API_URL` empty for web builds. Keep secrets out of Git and browser-prefixed variables.

## 2. Initialize or adopt the database

Use the Supabase **direct connection or session pooler** PostgreSQL URI for `DB_URL`. Percent-encode reserved characters in passwords. `DATABASE_URL` is an alias when `DB_URL` is absent. Keep TLS enabled for hosted connections.

```sh
php artisan migrate --seed
php artisan supabase:check
```

Migrations apply the files in `database/schema` in order and adopt an existing `mt_*` schema without dropping data. The transaction-protected seed inserts 364 records on first initialization (354 public, 10 drafts). An advisory lock prevents concurrent seed runs; a metadata receipt preserves later edits and deletions. Existing accounts and IDs remain in place. Migrations require Supabase's `auth.users`, `auth.uid()` and API roles; a plain empty PostgreSQL database is not a substitute for Supabase Auth.

If direct database credentials are unavailable:

```sh
php artisan db:export-setup
```

Review `supabase/setup.sql` and run it once in your project's SQL Editor. It is generated from the same Laravel schema and seed sources, and is repeat-safe. `php artisan migrate --seed` can later adopt that installation and record migration history. The application runtime only needs the API settings, so remove `DB_URL` from runtime containers when migrations run elsewhere.

Every schema file can be run again safely. When a release adds or changes one, apply it to the live project before or with the code that needs it, in the order listed in `app/Console/Commands/ExportDatabase.php`.

Do not use `migrate:fresh`, `db:wipe` or drop the auth schema on an existing project. Back up before adopting a production database. For catalogue expansion on an already seeded database, follow [catalogue import](CATALOGUE-RESEARCH.md).

## 3. Accounts without email

The app needs no mail server. Signup signs the person in at once, and a forgotten password is reset with one of eight one-time recovery codes. In the Supabase dashboard, turn off **Confirm email** and **Secure email change** under Authentication → Sign In / Providers → Email, and leave custom SMTP unset. [Accounts without email](ACCOUNTS-WITHOUT-EMAIL.md) explains the whole flow; `npm run auth:signup -- --apply` turns off confirmation through the Management API when a private `SUPABASE_ACCESS_TOKEN` is available.

## 4. Run and provision administrators

```sh
composer dev
# In another terminal:
php artisan supabase:check
php artisan admin:seed
```

Open `http://127.0.0.1:8000/api/health`; a configured schema returns `{"status":"ok","database":"supabase","framework":"laravel"}`. Administrator provisioning uses only server-held credentials. Users cannot assign their own roles.

- `php artisan admin:seed` creates the first administrator from `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` when that account does not exist yet, and warns about a guessable password.
- `php artisan admin:create your-email@example.com --name="Your name"` generates a password instead and writes it once to a private file under `.data/admin-credentials/` (permissions 0600, ignored by Git). It refuses to replace an existing password unless `--replace-password` is supplied.
- `php artisan admin:grant` gives the role to an existing account.

Passwords are held by Supabase Auth as hashes, never in application source code. Once signed in, an administrator manages everything else from the dashboard at `#admin`.

## 5. Verify a deployment

Follow [the deployment guide](DEPLOYMENT.md), then run the read-only `php artisan supabase:check` against the deployed configuration and open `/api/health`. Sign up with a disposable account, save its recovery codes, sign in on a second device, reset the password with one code, and delete the account from **My account**.
