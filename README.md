# MadaTours

A bilingual (French and English) guide to Martinique: 354 published restaurants, beaches, gardens, rum estates and outings on an interactive map, with day planning, curated island tours, reviews and meet-ups.

**Live site: [mada-tours.vercel.app](https://mada-tours.vercel.app)**

Laravel 13 serves the website and every API endpoint. The interface is React 19 and TypeScript, built by Vite, with Leaflet maps drawn from OpenFreeMap vector tiles. Supabase provides PostgreSQL (with row-level security), authentication and photo storage. Capacitor projects package the same interface for iOS and Android.

## Features

- **Explore**: search in either language (accents ignored), filter by town, category, experience and distance, and open each place's facts, sources, hours and photos. Filters are shareable links; GPS coordinates never go into them.
- **Plan**: build day trips on the device, reorder stops by distance, and get directions. Saved places and the app shell stay readable offline.
- **Island tours**: routes between places, curated by administrators, drawn on the road by OpenRouteService.
- **Accounts without email**: sign up with an email and password or with Google. A forgotten password is reset with one of eight one-time recovery codes, so no mail server is needed.
- **Community**: favorites and a revisit list synced across devices, reviews with photos, check-ins, followers and meet-ups. Only Google-verified accounts can join meet-ups.
- **Administration**: a full dashboard at `#admin` covering places, tours, meet-ups, users, reviews, the contact inbox, submissions, photo permissions, sources and Google matching, site content and an activity log.
- **Honest content**: every listing cites its sources. Places without their own photo show an icon or a stock photo clearly labelled "not this place", and closures are applied only after review.

## Run it locally

You need PHP 8.3+ (CI uses 8.5) with Composer 2 and the cURL, mbstring, XML, OpenSSL and PDO PostgreSQL extensions, plus Node 22.13+ and a Supabase project.

```sh
composer install
npm ci
cp -n .env.example .env   # new installation only; never overwrite private configuration
php artisan key:generate
```

In `.env`, set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (all server-only), and keep `APP_URL` and `APP_ORIGIN` at `http://127.0.0.1:8000`. Never put secrets in `VITE_*` variables. An existing `.env.local` is still read when `.env` is absent.

Install the schema and starter catalogue, using either method:

- **With a database connection**: set `DB_URL` to the Supabase direct or session-pooler URI, then run `php artisan migrate --seed`.
- **Without one**: run `php artisan db:export-setup` and paste the generated `supabase/setup.sql` into the Supabase SQL Editor.

Both use the same schema files and seed. Reruns keep later edits and deletions. Then:

```sh
php artisan supabase:check   # read-only check of the schema and catalogue
php artisan admin:seed       # first administrator, from ADMIN_EMAIL and ADMIN_PASSWORD
composer dev                 # Laravel and Vite together
```

Open **http://127.0.0.1:8000**. `npm run dev` starts only Vite; it is not the application server. In the Supabase dashboard, turn off **Confirm email** and **Secure email change** (see [accounts without email](docs/ACCOUNTS-WITHOUT-EMAIL.md)).

## Checks

```sh
composer check               # Pint and the PHP tests
npm run lint                 # ESLint and TypeScript
npm test                     # API, PostgreSQL RLS, content and utility tests on an in-memory PostgreSQL
npm run build                # typecheck and production build
npx playwright install chromium webkit
npm run test:e2e             # browser flows in Chromium and WebKit (iPhone 13), about 10 minutes
npm run format:check
```

The automated tests use an in-memory PostgreSQL engine and a stand-in for Supabase Auth, so they never touch real accounts.

## Project layout

| Path                                               | Contents                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| `app/Http/Controllers`, `app/Http/Requests`        | API endpoints and their validation and authorization                        |
| `app/Services`, `app/Repositories`                 | Supabase Auth and Data API access, routing, photos, sources, recurring jobs |
| `app/Console/Commands`                             | Setup export, admin provisioning, account recovery, tour routes, checks     |
| `database/schema`, `database/migrations`           | The PostgreSQL schema with its RLS policies, and migrations that apply it   |
| `database/data`, `supabase/catalogue`              | The starter catalogue and reviewed correction batches                       |
| `resources/js`, `resources/css`, `resources/views` | React interface, styles and the Blade entry point                           |
| `tests`                                            | PHP tests, Node integration tests and Playwright browser tests              |
| `scripts`                                          | Catalogue research, audits, photo tooling and store assets                  |
| `ios`, `android`, `native-assets`                  | Capacitor projects, icons and store material                                |

Every request is checked by Laravel and again by PostgreSQL row-level security: the server queries Supabase with each user's own token, and no request uses an unrestricted database connection. See [architecture](docs/DATABASE.md).

## Deployment

Production runs on Vercel as one PHP function (`vercel.json`, `api/index.php`), with the Supabase integration and a daily Vercel Cron. A deployment never changes the database: apply new `database/schema` files in the Supabase SQL Editor as a separate step. The Dockerfile and `render.yaml` remain for PHP and container hosts. See [deployment](docs/DEPLOYMENT.md) and [mobile](docs/MOBILE.md).

## Documentation

- [Database setup](docs/SUPABASE-SETUP.md) · [Architecture](docs/DATABASE.md) · [Deployment](docs/DEPLOYMENT.md)
- [Accounts without email](docs/ACCOUNTS-WITHOUT-EMAIL.md) · [Maps](docs/MAPS.md) · [Tours and road routes](docs/TOURS.md)
- [Content and photos](docs/CONTENT.md) · [Source facts and listing audit](docs/SOURCES-AND-AUDIT.md) · [Catalogue research](docs/CATALOGUE-RESEARCH.md)
- [Mobile apps](docs/MOBILE.md) · [Class demonstration](docs/CLASS-DEMO.md) · [Status and next steps](docs/IMPROVEMENTS.md)

## Credits

Map data © OpenStreetMap contributors, tiles by OpenFreeMap, road routes © openrouteservice.org by HeiGIT. Venue facts come from the Martinique tourism board and local tourism offices, cited on each listing. Photos are credited in [public/photos/CREDITS.md](public/photos/CREDITS.md) and [public/assets/placeholders/CREDITS.md](public/assets/placeholders/CREDITS.md).
