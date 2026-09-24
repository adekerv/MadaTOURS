# MadaTours

A Martinique discovery app for a web-development class, with a responsive React/TypeScript interface, Leaflet maps, and a Supabase backend hosted behind an Express API on Vercel. Capacitor projects are included for iOS and Android.

Browse as a guest, search in French or English, create a verified account, save favorites and revisit lists across devices, recover a password, and delete an account. Day plans and offline saved-place copies live on the current device. Offline maps and cloud itinerary sync are not included.

## Start here

Use Node 22.13 or later and npm (CI uses Node 24).

```sh
npm ci
# Only copy the template if .env.local does not already exist:
cp -n .env.example .env.local
npm run db:prepare
```

Follow [Supabase and Vercel setup](docs/SUPABASE-SETUP.md), then:

```sh
npm run setup:check
npm run dev
```

Open http://localhost:3000. Accounts require your configured Supabase project; the bundled public catalogue remains browseable during a backend outage, with a visible connection notice. No local database silently substitutes for Supabase. Never commit `.env.local` or prefix a secret with `VITE_`.

## Project layout

| Folder                 | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `src/components`       | Home, exploration, planner, account/admin forms, accessible dialogs |
| `src/hooks`, `src/lib` | API requests, search, location, local plans and offline copies      |
| `src/i18n`             | French/English interface and language persistence                   |
| `src/data/places.json` | Canonical starter catalogue, sources and photo credits              |
| `server`               | Supabase cookie adapter, API permissions and input validation       |
| `api/index.ts`         | Vercel API entry point                                              |
| `supabase`             | SQL migration, generated setup script and email templates           |
| `scripts`              | Setup, configuration checks, admin provisioning and asset tools     |
| `public/photos`        | Licensed venue photographs and attribution                          |
| `ios`, `android`       | Capacitor native projects                                           |
| `tests`                | Isolated API, SQL security, utilities and browser checks            |
| `docs`                 | Setup, architecture, demonstration and mobile release instructions  |

## Verify changes

```sh
npm run lint
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
npm run format:check
```

Automated tests use an isolated PostgreSQL engine and a Supabase Auth contract double. They do not send email or use your real Supabase credentials. Run `npm run setup:check` separately for read-only cloud checks. The opt-in `npm run test:live -- --run` verifies real Supabase with temporary accounts that it cleans up; it does not send emails. Then follow the [class demonstration](docs/CLASS-DEMO.md) to verify real authentication and persistence.

## Release guides

- [Supabase and existing Vercel project](docs/SUPABASE-SETUP.md)
- [Database architecture and security](docs/DATABASE.md)
- [Venue sources and photographs](docs/CONTENT.md)
- [Mobile and App Store preparation](docs/MOBILE.md)
- [Implemented improvements and next ideas](docs/IMPROVEMENTS.md)
- [Verification record](docs/VERIFICATION.md)

For the website, keep `VITE_API_URL` empty: web and API share one HTTPS origin. For native builds, set it to the hosted API origin, then run `npm run mobile:sync`. Native signing, physical-device validation and store submission remain separate release steps.
