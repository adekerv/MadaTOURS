# Database and authentication

The website and Vercel function share `server/app.ts`. Supabase manages PostgreSQL and Auth; the app no longer uses SQLite at runtime. Follow [SUPABASE-SETUP.md](SUPABASE-SETUP.md) to initialize it.

## Data ownership

| Table             | Purpose and access                                                              |
| ----------------- | ------------------------------------------------------------------------------- |
| `auth.users`      | Supabase-managed accounts; passwords are handled by Supabase Auth               |
| `mt_profiles`     | User/admin role; a user can read their own role but cannot change it            |
| `mt_places`       | Public catalogue; guests see published rows; admins can manage entries          |
| `mt_saved_places` | Favorites/revisits belonging to the authenticated user only                     |
| `mt_metadata`     | Schema and seed state; only the schema version is public                        |
| `mt_rate_limits`  | Hashed abuse counters; only the service role can access the rate-limit function |

Every public application table has row-level security. Protected API requests validate the session with Supabase `getUser()`, ignoring client-supplied identity. The server secret is used only for privileged account operations and rate limits; ordinary catalogue and saved-place requests use the request-scoped authenticated client. User deletion cascades to their role and saved lists; place deletion cascades to related saved entries.

The schema trigger creates ordinary user profiles, including for accounts created through Supabase. Admin provisioning is an explicit local command. No account is elevated based on its name, email or signup metadata.

## Sessions and requests

Supabase sessions are stored in chunkable HttpOnly cookies scoped to `/api`, SameSite=Lax, Secure in production. Tokens are not returned in JSON or stored in browser localStorage. The browser and API must share one HTTPS origin. Native calls use the platform HTTP client and require physical-device cookie testing.

Writes require a custom header and accepted origin. Authentication counters are shared in PostgreSQL and expire after 15 minutes. Supabase's own Auth limits also apply. Password recovery verifies the emailed recovery code, changes the password, and signs out the recovery session and refresh sessions globally. Already issued access tokens follow Supabase's token-expiry semantics.

## Local-only features

Day plans are saved on the device and are not synchronized across accounts or phones. A separate offline copy stores the most recently fetched favorites/revisits without email or session tokens. It is cleared on successful logout/account deletion, when switching accounts, or with the Remove offline copy button. A shared-device user can see that copy while offline; avoid retaining it on public computers. Clearing browser storage removes local plans and offline copies.

The production service worker caches the compiled application shell, not API responses, map tiles, weather, or remote photos. Offline reads never pretend to perform a successful account write.

## Existing data

Old local `.data` files remain untouched and ignored by Git. Legacy Laravel snippets in `docs/legacy` are reference material, not another backend. Migrating genuine old accounts or saved lists requires a reviewed user-ID mapping and verified account ownership. Do not import plaintext passwords or infer old administrator privileges. Back up any genuine existing data before a separate migration.

The generated setup transaction seeds once and preserves subsequent edits/deletions on rerun. Back up important cloud data and test restoration separately; a setup script is not a backup.
