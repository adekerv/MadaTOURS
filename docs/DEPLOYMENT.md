# Deploying Laravel

Production runs on Vercel at https://mada-tours.vercel.app (see [Vercel](#vercel) below). The Dockerfile and `render.yaml` remain for PHP/container hosts. Build from the repository root and serve only `public/`, never the project root. The Dockerfile builds Vite assets, installs PHP dependencies and starts Apache.

A deployment never changes the database. When a commit adds a file under `database/schema`, apply it to Supabase as its own release step, after a backup, before or together with the code that needs it. The live project has no Laravel `migrations` table; schema files are applied through the SQL Editor (or `php artisan db:export-setup`).

## Environment

Set persistent `APP_KEY` (generate once with `php artisan key:generate --show`), `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` and `APP_ORIGIN` to the exact HTTPS application origin, and all three server-only Supabase settings. Set `SESSION_SECURE_COOKIE=true`. Keep `VITE_API_URL` empty for the web build.

Configure `TRUSTED_PROXIES` with the hosting platform's proxy IPs/CIDRs. Only trust all proxies when the origin is accessible exclusively through the platform's trusted proxy. Additional origins must be explicitly listed in `ALLOWED_ORIGINS`; wildcard domains are not accepted. Native clients may require `SESSION_SAME_SITE=none` with secure cookies; validate the target WebView's cookie behavior on a device.

`DB_URL` is needed only where migrations/seeds run. Use the Supabase direct or session pooler connection and TLS. Do not bake environment files, management tokens or SMTP credentials into images.

## Release

```sh
composer install --no-dev --prefer-dist --optimize-autoloader
npm ci
npm run build
php artisan migrate --seed --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan supabase:check
```

Run database migrations once in a controlled release step, after a backup. Container startup deliberately does not migrate a shared database. SQL Editor installations can use `php artisan db:export-setup`; later `migrate --seed` safely records the Laravel migration history. The first migration requires Supabase's existing auth schema.

`/up` checks application liveness. `/api/health` checks the database schema through the public Data API. After release, verify immediate signup and the welcome message, login, saved lists in another browser, recovery and admin changes. Existing Express cookies are replaced by Laravel sessions, so users sign in again.

## Vercel

`vercel.json` runs Laravel as one PHP serverless function (`api/index.php`, community runtime `vercel-php@0.9.0`, PHP 8.5) and serves `public/` as static files, including the Vite output in `public/build`. Supabase is connected through the Vercel Supabase integration.

- The entry point keeps writable data in `/tmp`, stores the session in an encrypted cookie and trusts Vercel's proxy. Dashboard variables override these defaults.
- Vercel's own production, deployment and branch URLs are accepted as API origins automatically.
- The runtime has no GD extension. Photo submissions then accept the device-resized JPEG and strip all metadata segments without re-encoding.
- Vercel Cron calls `/api/internal/tasks` daily with `CRON_SECRET`. For the 5-minute and hourly jobs, also enable the GitHub workflow below.

Required variables for Production and Preview, besides the Supabase integration's:

```sh
php artisan key:generate --show | vercel env add APP_KEY production
openssl rand -hex 32 | vercel env add CRON_SECRET production
```

Optional: `GOOGLE_PLACES_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, and `APP_ORIGIN` set to a custom domain. Deploy a preview with `vercel deploy`, check `/api/health`, then promote with `vercel deploy --prod`.

## Recurring tasks

Event expiry, photo cleanup, official-source refresh, Google Place ID matching and the daily MUST GO ranking are listed with their intervals in `config/tasks.php`. Each runs at most once per interval, whatever triggers it.

- The container runs `php artisan tasks:run-due` every minute in the background. Set `RUN_SCHEDULER=false` to turn this off.
- Hosts that sleep when idle, such as the free Render plan, also need the external trigger. Set `RECURRING_TASKS_SECRET` to a random value of at least 32 characters, for example `openssl rand -hex 32`. Then add the repository secrets `MADATOURS_TASKS_URL` (the API origin, no trailing slash) and `MADATOURS_TASKS_SECRET` (the same value). The `Recurring tasks` GitHub workflow calls `POST /api/internal/tasks` every 15 minutes.
- Without a secret the endpoint returns 404. Traditional servers can instead run `php artisan schedule:run` from cron every minute.

Google matching spend is capped per day in the database by `GOOGLE_MATCH_DAILY_LIMIT` (default 10, maximum 100).

## Sessions, cache and scaling

The default encrypted file sessions and file locks support one application instance. Mount persistent storage for `storage/` to retain sessions across restarts. An ephemeral host can run with file sessions, but restarts/deployments sign everyone out. The included free Render blueprint has this limitation.

For multiple instances, configure shared Redis for both `SESSION_DRIVER=redis` and `CACHE_STORE=redis`, and keep the same `APP_KEY` across instances. Install/enable the PHP Redis extension or add Laravel's supported Predis client. Session blocking requires a shared lock store to protect rotating refresh tokens. The included image uses the default file drivers; extend it with your chosen Redis client when scaling. Queue execution defaults to `sync`; this project has no background queue requirement.

## Container

```sh
docker build -t madatours .
docker run --env-file .env.production -p 10000:10000 madatours
```

Use a private production environment file with the settings above. Port defaults to 10000 and follows the host's `PORT` variable. Keep `storage/` and `bootstrap/cache/` writable by the web user. The former Node function configuration has been removed.

The image uses PHP's production INI defaults. OPcache is built into PHP 8.5 and is not compiled again; see the [PHP 8.5 migration notes](https://www.php.net/manual/en/migration85.incompatible.php#opcache). CI is configured to build the container and check its public entry point separately from the PHP and browser suites.
