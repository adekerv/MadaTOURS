import { mkdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import type { DatabaseSync } from 'node:sqlite';
import { schema } from './schema';
import seedPlaces from '../../src/data/places.json';

export type SqlValue = string | number | null;
export interface Database {
  query<T>(sql: string, values?: SqlValue[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  dialect: 'postgres' | 'sqlite';
}

export async function createDatabase(
  options: { url?: string; file?: string } = {},
): Promise<Database> {
  if (options.url) {
    // TLS settings come from the connection string; certificate verification stays enabled.
    const pool = new pg.Pool({
      connectionString: options.url,
      max: 5,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });
    pool.on('error', () => console.error('An idle database connection failed.'));
    return {
      dialect: 'postgres',
      query: async <T>(sql: string, values: SqlValue[] = []) =>
        (await pool.query(sql, values)).rows as T[],
      exec: async (sql) => {
        await pool.query(sql);
      },
      close: () => pool.end(),
    };
  }
  const file = options.file ?? path.resolve('.data/madatours.sqlite');
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const { DatabaseSync: SQLite } = await import('node:sqlite');
  const sqlite: DatabaseSync = new SQLite(file);
  sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  return {
    dialect: 'sqlite',
    query: async <T>(sql: string, values: SqlValue[] = []) => {
      // Positional placeholders are reordered so repeated PostgreSQL parameters work in SQLite.
      const ordered: SqlValue[] = [];
      const translated = sql.replace(/\$(\d+)/g, (_, index: string) => {
        ordered.push(values[Number(index) - 1]);
        return '?';
      });
      const statement = sqlite.prepare(translated);
      if (/^\s*(SELECT|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql))
        return statement.all(...ordered) as T[];
      statement.run(...ordered);
      return [];
    },
    exec: async (sql) => {
      sqlite.exec(sql);
    },
    close: async () => {
      sqlite.close();
    },
  };
}

export async function initializeDatabase(db: Database) {
  if (db.dialect === 'postgres') {
    const [existing] = await db.query<{ users: string | null; metadata: string | null }>(
      "SELECT to_regclass('users')::text AS users, to_regclass('madatours_metadata')::text AS metadata",
    );
    if (existing.users && !existing.metadata)
      throw new Error(
        'Legacy database detected. Follow docs/DATABASE.md before initializing; no existing tables were changed.',
      );
  }
  await db.exec(schema(db.dialect));
  const seeded = await db.query(
    "SELECT value FROM madatours_metadata WHERE key = 'catalogue_seeded'",
  );
  if (!seeded.length) {
    for (const p of seedPlaces) {
      await db.query(
        `INSERT INTO places (id, name, type, lat, lng, location, description, rating, hours, tags, image)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [
          p.id,
          p.name,
          p.type,
          p.lat,
          p.lng,
          p.location,
          p.description,
          p.rating,
          p.hours,
          JSON.stringify(p.tags),
          p.image,
        ],
      );
    }
    if (db.dialect === 'postgres')
      await db.query(
        "SELECT setval(pg_get_serial_sequence('places', 'id'), (SELECT MAX(id) FROM places))",
      );
    await db.query(
      "INSERT INTO madatours_metadata (key,value) VALUES ('catalogue_seeded','1') ON CONFLICT (key) DO NOTHING",
    );
  }
}

let database: Promise<Database> | undefined;
export function getDatabase() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) {
    throw new Error('DATABASE_URL is required for account and write operations in production.');
  }
  database ??= (async () => {
    const db = await createDatabase({ url, file: process.env.LOCAL_DATABASE_PATH });
    if (!url) await initializeDatabase(db);
    return db;
  })().catch((error: unknown) => {
    database = undefined;
    throw error;
  });
  return database;
}
