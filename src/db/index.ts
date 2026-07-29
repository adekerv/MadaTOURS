import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

const { Pool } = pg;

declare global {
  var _postgresPool: pg.Pool | undefined;
}

export const getDbConnectionString = (): string | undefined => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  if (process.env.POSTGRES_PRISMA_URL) return process.env.POSTGRES_PRISMA_URL;
  if (process.env.SUPABASE_POSTGRES_URL) return process.env.SUPABASE_POSTGRES_URL;
  
  // Dynamic fallback search across all env vars for any postgres connection string
  for (const [key, value] of Object.entries(process.env)) {
    if (value && (value.startsWith('postgres://') || value.startsWith('postgresql://'))) {
      return value;
    }
  }
  return undefined;
};

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = getDbConnectionString();
    if (connectionString) {
      global._postgresPool = new Pool({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST || process.env.POSTGRES_HOST || 'localhost',
        user: process.env.SQL_USER || process.env.SQL_ADMIN_USER || process.env.POSTGRES_USER || 'postgres',
        password: process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || process.env.POSTGRES_PASSWORD || '',
        database: process.env.SQL_DB_NAME || process.env.POSTGRES_DATABASE || 'postgres',
        port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT) : 5432,
        ssl: (process.env.SQL_HOST && !process.env.SQL_HOST.includes('localhost')) ? { rejectUnauthorized: false } : false,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
