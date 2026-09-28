# Deploying Laravel

Build from the repository root. Serve only `public/`, never the project root. The included Dockerfile builds Vite assets, installs PHP dependencies and starts Apache. `render.yaml` is an optional deployment blueprint; no hosting changes happen automatically from these local edits.

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

`/up` checks application liveness. `/api/health` checks the database schema through the public Data API. After release, verify signup/email confirmation, login, saved lists in another browser, recovery and admin changes. Existing Express cookies are replaced by Laravel sessions, so users sign in again.

## Sessions, cache and scaling

The default encrypted file sessions and file locks support one application instance. Mount persistent storage for `storage/` to retain sessions across restarts. An ephemeral host can run with file sessions, but restarts/deployments sign everyone out. The included free Render blueprint has this limitation.

For multiple instances, configure shared Redis for both `SESSION_DRIVER=redis` and `CACHE_STORE=redis`, and keep the same `APP_KEY` across instances. Install/enable the PHP Redis extension or add Laravel's supported Predis client. Session blocking requires a shared lock store to protect rotating refresh tokens. The included image uses the default file drivers; extend it with your chosen Redis client when scaling. Queue execution defaults to `sync`; this project has no background queue requirement.

## Container

```sh
docker build -t madatours .
docker run --env-file .env.production -p 10000:10000 madatours
```

Use a private production environment file with the settings above. Port defaults to 10000 and follows the host's `PORT` variable. Keep `storage/` and `bootstrap/cache/` writable by the web user. The former Node function configuration has been removed; deploy this version to a PHP/container host before directing live traffic to it.

The image uses PHP's production INI defaults. OPcache is built into PHP 8.5 and is not compiled again; see the [PHP 8.5 migration notes](https://www.php.net/manual/en/migration85.incompatible.php#opcache). CI is configured to build the container and check its public entry point separately from the PHP and browser suites.
