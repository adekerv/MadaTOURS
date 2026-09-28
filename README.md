# MadaTours

A Laravel 13 application for discovering Martinique, with a React 19 / TypeScript interface, Leaflet maps, and Supabase PostgreSQL and Auth. Laravel serves the website and every API endpoint; Vite builds the interface. Capacitor projects support iOS and Android.

Browse 354 published places, search in French or English, create an account without email verification, save favorites and revisit lists across devices, recover a password, and manage places as an administrator. Day plans and offline place copies remain on the device; map tiles and itineraries are not synced offline.

## Requirements and local setup

- PHP 8.3+ with Composer 2, cURL, mbstring, XML, OpenSSL and PDO PostgreSQL. The development test suite requires PHP 8.3+.
- Node 22.13+ and npm (CI uses PHP 8.5 / Node 24).
- A Supabase project for accounts and persistent data.

```sh
composer install
npm ci
# New installation only. Do not overwrite existing private configuration.
cp -n .env.example .env
php artisan key:generate
```

Set the three server-only `SUPABASE_*` settings in `.env`. Existing `.env.local` installations remain supported when `.env` is absent; transfer their settings before switching to `.env`. Keep `APP_URL` and `APP_ORIGIN` equal to `http://127.0.0.1:8000` locally. Never put secrets in `VITE_*` variables.

Initialize the database with a Supabase **direct or session-pooler** connection in `DB_URL`:

```sh
php artisan migrate --seed
php artisan supabase:check
composer dev
```

Open **http://127.0.0.1:8000**. `composer dev` starts Laravel and Vite together. `npm run dev` starts only Vite; it is not the application server. For a built interface, use `npm run build` followed by `php artisan serve --host=127.0.0.1`.

Without database connection credentials, `php artisan db:export-setup` generates `supabase/setup.sql` for the Supabase SQL Editor. Both paths use the same schema and seed. See [database setup](docs/SUPABASE-SETUP.md) for existing-project adoption and email configuration. The initial seed runs once and preserves subsequent edits and deletions.

## Structure

| Path                                               | Responsibility                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `app/Http/Controllers`                             | Small controllers for accounts, places, saved lists and health        |
| `app/Http/Requests`                                | Input validation and request authorization                            |
| `app/Http/Resources`                               | Public API response shape                                             |
| `app/Services`                                     | Authentication, provider transport and nearby search                  |
| `app/Repositories`                                 | Database queries with each user's row-level permissions               |
| `app/Console/Commands`                             | Database export, provider checks and admin provisioning               |
| `routes`                                           | Laravel web, API and console routes                                   |
| `database/migrations`, `database/schema`           | Versioned PostgreSQL schema and indexes                               |
| `database/seeders`, `database/data`                | Repeat-safe catalogue initialization and source data                  |
| `resources/js`, `resources/css`, `resources/views` | React interface, styles and Blade entry point                         |
| `tests/Feature`, `tests/Unit`                      | Laravel behavior, security and service tests                          |
| `tests/*.test.ts`, `tests/e2e`                     | PostgreSQL policies, API integration, content and browser checks      |
| `scripts`                                          | Content research/import, email configuration and native asset tooling |
| `public/photos`, `supabase`                        | Licensed photos, catalogue research and email templates               |

Supabase remains the identity and database provider so existing accounts, IDs and saved lists survive the migration. Laravel uses its HTTP client and repositories for ordinary Data API queries, passing the user's token to enforce PostgreSQL RLS. PDO is reserved for migrations and seeding; application requests never use an unrestricted database connection. See [architecture](docs/DATABASE.md).

## Checks and maintenance

```sh
composer check                 # PHP formatting and Laravel tests
npm run lint                   # ESLint and TypeScript
npm test                       # Laravel HTTP + isolated PostgreSQL, content and utility tests
npm run build                  # Typecheck and production web build
npx playwright install chromium webkit
npm run test:e2e                # Desktop/mobile flows through Laravel
npm run format:check
php artisan admin:create your-email@example.com --name="Your name"
```

Automated tests use an isolated PostgreSQL engine and an Auth contract double; they do not use real accounts or send email. `php artisan supabase:check` is a read-only live check. The opt-in `npm run test:live -- --run --url http://127.0.0.1:8000` tests the running Laravel server with temporary Supabase accounts and cleans them up. Actual inbox delivery needs a separate check.

## Deployment and mobile

Deploy Laravel to a PHP host or use the included Dockerfile. The document root is `public/`; the build output is `public/build/`. [Deployment instructions](docs/DEPLOYMENT.md) cover environment variables, migrations, persistent sessions and the optional Render blueprint. The previous Express/Vercel deployment is retired from this source tree; saving these changes does not change a hosted site.

Keep `VITE_API_URL` empty for the website. Native builds use `dist/mobile` and the deployed Laravel HTTPS origin; see [mobile guide](docs/MOBILE.md). Native signing and store submission are separate release steps.

Additional guides: [catalogue research](docs/CATALOGUE-RESEARCH.md), [content and photo credits](docs/CONTENT.md), [class demonstration](docs/CLASS-DEMO.md), [verification](docs/VERIFICATION.md).
