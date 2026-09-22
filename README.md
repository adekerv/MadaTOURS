# MadaTours

A responsive Martinique discovery app built with React, TypeScript, Vite, and Leaflet. Browse restaurants and activities, choose a search location, save favorites, and keep a revisit list. Capacitor projects are included for iOS and Android.

## Run locally

Use Node.js **22.13 or later** (Node 24 LTS recommended) and npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open **http://localhost:3000**. No API key or cloud account is needed for local development. A persistent SQLite database is created in `.data/madatours.sqlite`; it is excluded from Git. The supplied catalogue contains 24 entries. There are no default user or admin accounts.

Register in the app. To authorize an administrator you control:

```sh
npm run admin:grant -- your-email@example.com
```

The command only changes an existing account. An email address never grants privileges by itself.

## Project layout

```text
src/
  components/       Home, exploration, admin, and reusable dialog components
  hooks/            Catalogue loading and native back-button behavior
  lib/              API client, request cancellation, search and distance helpers
  data/places.json   Canonical starting catalogue
  types.ts          Shared frontend/API types
server/
  app.ts            Shared API and access checks
  security.ts       Password hashing, sessions, and authentication throttling
  validation.ts     Request schemas
  db/               PostgreSQL/SQLite adapter and canonical schema
api/index.ts        Vercel entry point using the same API
scripts/            Explicit database initialization and admin provisioning
public/             Web assets
native-assets/      Original SVG sources for app icons and launch artwork
ios/                Xcode project using Swift Package Manager
android/            Android Studio project
tests/             API, PostgreSQL-engine, utility, and browser tests
docs/              Architecture, migration, mobile release, and improvements
```

## Checks

```sh
npm run lint
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
npm run format:check
npm audit
```

Browser tests use their own temporary SQLite database and mock external weather, map tiles, and photos. They cover Chromium and WebKit, including seven viewport sizes, authentication, saved places, admin CRUD, location denial, search, and accessibility. They do not replace testing on physical phones.

`npm run build` creates separate `dist/web` and `dist/server` outputs. `npm start` serves both in production mode and requires PostgreSQL for accounts and writes. The public bundled catalogue can still be browsed if no production database is configured; writes never fall back to temporary memory.

## Hosting and mobile

- [Database setup and migration](docs/DATABASE.md)
- [Mobile setup and App Store preparation](docs/MOBILE.md)
- [What changed, remaining work, and product ideas](docs/IMPROVEMENTS.md)
- [Verification record](docs/VERIFICATION.md)

For a production web build, leave `VITE_API_URL` empty and serve the web app and API from the same HTTPS origin. Set `DATABASE_URL` and `APP_ORIGIN` on the server, initialize a new database with `npm run db:init`, then deploy. Vercel routing is configured in `vercel.json`; a live Vercel deployment was not performed during this review.

For a native build, set `VITE_API_URL` to the HTTPS origin of your running API before building, then run `npm run mobile:sync`. Open the project with `npm run mobile:ios` or `npm run mobile:android`.

**This is a development foundation, not an App Store submission.** Native signing, production hosting, device validation, store metadata, a published privacy policy, and verified venue content remain release work.
