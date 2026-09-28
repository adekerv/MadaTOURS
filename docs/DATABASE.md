# Database and application architecture

Laravel is the only application server. The Blade entry point mounts React; browser and native clients call `/api/*`. Supabase owns PostgreSQL and authentication. Existing accounts, UUIDs, place IDs and saved lists are retained.

## Request flow

1. `ApiSecurity` validates an exact allowed origin, body size, JSON syntax and the custom request header for mutations.
2. Laravel decrypts its HttpOnly session cookie. Provider access and refresh tokens stay in encrypted server-side session storage.
3. The `supabase` Laravel guard validates the account with Supabase Auth, then reads the server-controlled `mt_profiles.role`. User metadata never grants permissions. Session locks serialize token refreshes.
4. Form requests validate inputs; the `manage-places` gate authorizes catalogue changes.
5. Repositories query the Data API using the publishable key plus the authenticated user's bearer token. PostgreSQL RLS checks ownership and administrator permissions again.
6. API resources expose only the public place fields. Provider errors are mapped to safe messages.

No Eloquent user/password table is created: it would duplicate Supabase Auth and split identity ownership. Likewise, ordinary queries do not connect as PostgreSQL's unrestricted owner. The direct PDO connection is used only by Artisan migrations and seeding. The secret API key is limited to rate-limit RPCs, password-confirmed account deletion and explicit administrator tooling.

## Tables and integrity

| Table             | Purpose and invariants                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `auth.users`      | Supabase-managed credentials and verification                                                      |
| `mt_profiles`     | One role per auth UUID; trigger creates profiles; users cannot promote themselves                  |
| `mt_places`       | Identity IDs; validated coordinates, type, rating and JSON metadata; drafts hidden by RLS          |
| `mt_saved_places` | Composite primary key `(user_id, place_id, kind)` makes repeated saves idempotent; owner-only rows |
| `mt_metadata`     | Schema/seed/import receipts; only schema version is public                                         |
| `mt_rate_limits`  | Hashed keys, counters and expiration; callable only through a privileged RPC                       |

Foreign keys cascade account and place deletions to dependent records. User list queries join places in one request rather than fetching every place separately. Batches of 500 prevent provider row limits from truncating large catalogues. Results have deterministic ordering. Indexes cover the saved-list ownership/kind/order query, reverse place foreign key, published catalogue pages and expired rate-limit cleanup. Nearby search operates on the public catalogue in PHP; at substantially larger scale it should move to a spatial query.

Laravel migration history uses the namespaced `mt_migrations` table, with RLS enabled and guest/authenticated API access revoked. Public catalogue and health routes are stateless so they cannot overwrite a concurrently refreshed account session.

## Migrations and seeds

- `2026_09_26_000001_install_madatours_schema.php` adopts or installs the namespaced Supabase schema without dropping application data.
- `2026_09_26_000002_index_catalogue_queries.php` adds the query indexes to new and existing projects.
- `CatalogueSeed` is shared by `DatabaseSeeder` and `db:export-setup`. It uses one transaction and an advisory lock, fills only missing IDs on first initialization, preserves the identity sequence and records `catalogue_seeded`. Later runs preserve intentional edits and deletions.
- The base migration deliberately refuses rollback because it can adopt existing account-linked data. Do not use `migrate:fresh`, `db:wipe` or migration rollback against a shared Supabase project. Restore a reviewed backup when reversing adoption.

Use a direct connection or session pooler for migration DDL. Runtime Data API requests do not require `DB_URL`. See [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Laravel database configuration](https://laravel.com/docs/13.x/database).

## Verification

PHP tests check request validation, authorization, refresh behavior, origin controls and transport failures. Node integration tests launch the real Laravel HTTP application against a temporary PostgreSQL engine and an Auth contract double. SQL tests exercise policies directly, including attempts to read other users' rows, promote roles and bypass application checks. Browser tests exercise the same Laravel application. These isolated tests do not prove hosted email delivery.
