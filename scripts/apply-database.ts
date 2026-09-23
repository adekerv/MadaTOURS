import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
config({ path: ['.env.local', '.env'], quiet: true });
if (!process.argv.includes('--apply'))
  throw new Error(
    'Review supabase/setup.sql, then use npm run db:apply -- --apply to execute it on DATABASE_URL.',
  );
const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('Set DATABASE_URL in .env.local, or use the Supabase SQL Editor instead.');
let parsed: URL;
try {
  parsed = new URL(connectionString);
} catch {
  throw new Error('DATABASE_URL must be a PostgreSQL connection string from Supabase Connect.');
}
if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
  throw new Error('Use a PostgreSQL connection string from the Supabase Connect dialog.');
// Certificate verification remains enabled. Use the SQL Editor if local TLS setup is unavailable.
parsed.searchParams.delete('sslmode');
const client = new pg.Client({
  connectionString: parsed.toString(),
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 15000,
});
try {
  await client.connect();
  await client.query(await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8'));
  console.log('Supabase schema and initial catalogue applied successfully.');
} catch {
  throw new Error(
    'Database setup failed. No transaction was committed on SQL failure. Check the connection/TLS configuration or run setup.sql in the Supabase SQL Editor.',
  );
} finally {
  await client.end();
}
