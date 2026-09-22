# Database and authentication

## One runtime model

`server/app.ts` is shared by the local Node server and the Vercel function. SQLite is used only for local development and tests. PostgreSQL is the production database. Both use the schema defined in `server/db/schema.ts`.

The database contains users, places, two saved-place relations, hashed sessions, short-lived authentication rate limits, and initialization metadata. Foreign keys remove saved entries and sessions when their owning user or place is deleted. Unique keys make repeated save operations idempotent.

The catalogue seed uses stable IDs, advances the PostgreSQL ID sequence, and records successful completion. Re-running initialization does not bring back places an administrator deleted. An interrupted first seed can resume without duplicating rows.

## New production database

1. Provision an empty PostgreSQL database. Use a pooled connection URL where your host requires one, and enable certificate-verified TLS using your provider's documented connection settings.
2. Set `DATABASE_URL` in a local shell or private `.env` pointing to that database. Never use a `VITE_` variable for a database credential.
3. Run `npm run db:init` once. This is an explicit schema/seed operation; it does not run automatically against PostgreSQL during API requests.
4. Set `DATABASE_URL` and `APP_ORIGIN=https://your-real-domain` on the hosted server. Add your mobile origins to `ALLOWED_ORIGINS` when using native builds.
5. Register the intended administrator and run `npm run admin:grant -- address@example.com` with access to that database.
6. Verify `/api/health`, registration, login, save/remove, admin add/delete, and account deletion against the deployed environment.

The runtime does not scan unrelated environment variables, disable TLS verification, or switch a failing database to an in-memory store. Failed operations return an error instead of pretending to persist data.

## Existing prototype data

**Do not run the new app against the old schema without a migration.** The prototype had multiple schemas, plaintext credentials, user-selected IDs, and automatically elevated admin roles. `db:init` detects an existing legacy PostgreSQL `users` table without the new metadata table and stops before changing it.

No existing remote database was accessed or migrated during this review. The working folder contained no user-data JSON files or environment file to migrate.

For an existing deployment:

1. Back up the database and any old `src/data/users.json`, `user_favorites.json`, and `user_revisits.json` files privately. Do not add them to Git.
2. Create a new database with this schema and test the app against it.
3. Review and import legitimate place records, preserving IDs where saved lists refer to them. Normalize tags from JSON/text into arrays and validate coordinates. Advance the place sequence after importing explicit IDs.
4. Treat old passwords and administrator privileges as untrusted. Arrange verified account recovery or ask users to re-register; do not import plaintext credentials or infer roles from email names. Preserve legitimate saved lists through a reviewed user-ID mapping after ownership is established.
5. Validate row counts, duplicate handling, foreign keys, and deletion behavior before switching production traffic. Retain the backup according to your retention policy.

The old Laravel snippets are retained in `docs/legacy/laravel-database` as reference only. They are not a second backend. Their seeder no longer creates weak default accounts or duplicates the catalogue.

## Session behavior

Passwords are salted and hashed with scrypt (N=32768, r=8, p=3; 64-byte output). These parameters are one of the configurations described by the [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Never log passwords or session cookies.

Sessions use random 256-bit tokens. Only SHA-256 token hashes are stored in the database. The browser receives an HttpOnly, SameSite=Lax cookie scoped to `/api`, with Secure enabled in production and a seven-day expiry. Logout revokes the current session; account deletion revokes every session through a foreign key. Protected routes obtain the user from the session, ignoring client-supplied user IDs.

Writes require a custom client header and enforce allowed origins. This blocks cross-site HTML form submissions. Same-origin HTTPS web hosting is the supported web topology; do not assume cross-site browser cookie authentication works by merely adding a CORS origin. Native API calls use Capacitor's native HTTP client and platform cookie storage, which still need device validation.

Authentication is limited by IP and normalized email using database-backed counters, shared between server instances. On Vercel, the platform's forwarding header is used. A separately hosted reverse proxy should apply its own edge limits and explicitly configure trusted forwarding; the app does not trust arbitrary `X-Forwarded-For` values.

Before public launch, add email verification, secure password recovery, operational monitoring, backups, and a tested recovery procedure. Existing account deletion is password-confirmed and removes the account, saved lists, and sessions; hashed abuse-prevention counters expire after fifteen minutes.
