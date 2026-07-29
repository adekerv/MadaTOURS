import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { Place } from '../types';

const { Pool } = pg;

// Let's reference the persistent data store paths
const PLACES_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'places.json');
const USERS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'users.json');
const FAVORITES_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'user_favorites.json');
const REVISITS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'user_revisits.json');

// Interface mimicking index-based parameter inputs
type SQLValue = string | number | boolean | null | undefined;

function getDbConnectionString(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  if (process.env.POSTGRES_PRISMA_URL) return process.env.POSTGRES_PRISMA_URL;
  if (process.env.SUPABASE_POSTGRES_URL) return process.env.SUPABASE_POSTGRES_URL;
  
  for (const [key, value] of Object.entries(process.env)) {
    if (value && (value.startsWith('postgres://') || value.startsWith('postgresql://'))) {
      return value;
    }
  }
  return undefined;
}

// Create PostgreSQL connection pool configuration (can use env vars)
let pool: pg.Pool | null = null;
const isPostgresConfigured = !!(
  getDbConnectionString() ||
  process.env.POSTGRES_HOST ||
  process.env.SQL_HOST
);

// Define robust in-memory data tables for zero-crash fallback (read-only container support)
let inMemoryUsers: any[] = [
  { id: 1, email: 'admin@madatours.com', password: 'admin', role: 'admin' },
  { id: 2, email: 'user@madatours.com', password: 'user', role: 'user' }
];
let inMemoryFavorites: any[] = [];
let inMemoryRevisits: any[] = [];
let inMemoryPlaces: any[] = [];

// Helper safe loaders
const safeLoadInitialJSON = (filePath: string, fallback: any[]) => {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content && content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (e) {
    console.warn(`[Safe Loader] Could not read path: ${filePath}. Falling back to default list.`, e);
  }
  return fallback;
};

// Populate the local in-memory states on initialization
inMemoryPlaces = safeLoadInitialJSON(PLACES_FILE_PATH, []);
inMemoryUsers = safeLoadInitialJSON(USERS_FILE_PATH, inMemoryUsers);
inMemoryFavorites = safeLoadInitialJSON(FAVORITES_FILE_PATH, []);
inMemoryRevisits = safeLoadInitialJSON(REVISITS_FILE_PATH, []);

/**
 * Automatically creates all tables and prepopulates baseline seed data
 * inside the relational database if they do not yet exist.
 * This guarantees pristine, zero-config onboarding on deployed environments.
 */
async function initializeRealDatabase(conn: pg.Pool) {
  try {
    console.log('🏗️  Starting SQL Database Schema Auto-Initialization (Migrations)...');

    // 1. Users Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user'
      );
    `);

    // 2. Places Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS places (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        location VARCHAR(255) NOT NULL,
        description TEXT,
        rating DOUBLE PRECISION DEFAULT 4.5,
        hours VARCHAR(255),
        tags TEXT,
        image VARCHAR(512)
      );
    `);

    // 3. User Favorites Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        place_id INT NOT NULL,
        CONSTRAINT user_place_fav UNIQUE (user_id, place_id)
      );
    `);

    // 4. User Revisits Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_revisits (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        place_id INT NOT NULL,
        CONSTRAINT user_place_rev UNIQUE (user_id, place_id)
      );
    `);

    // Prepopulate Users seed if users table is empty
    const existingUsers = await conn.query('SELECT COUNT(*) as count FROM users');
    const uCount = parseInt(existingUsers.rows[0]?.count || '0');
    if (uCount === 0) {
      console.log('🌱 Seed: Prepopulating first-time baseline users into SQL Database...');
      await conn.query(`
        INSERT INTO users (email, password, role) VALUES 
        ('admin@madatours.com', 'admin', 'admin'),
        ('user@madatours.com', 'user', 'user')
      `);
    }

    // Prepopulate default places seed if empty
    const existingPlaces = await conn.query('SELECT COUNT(*) as count FROM places');
    const pCount = parseInt(existingPlaces.rows[0]?.count || '0');
    if (pCount === 0) {
      console.log('🌱 Seed: Prepopulating initial locations into SQL Database...');
      let placesSeed: any[] = inMemoryPlaces;
      
      // If we couldn't load them, see if they are in places.json
      if (placesSeed.length === 0 && fs.existsSync(PLACES_FILE_PATH)) {
        try {
          placesSeed = JSON.parse(fs.readFileSync(PLACES_FILE_PATH, 'utf-8'));
        } catch {}
      }

      for (const place of placesSeed) {
        const tagsStr = Array.isArray(place.tags) ? JSON.stringify(place.tags) : String(place.tags || '');
        await conn.query(`
          INSERT INTO places (id, name, type, lat, lng, location, description, rating, hours, tags, image) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          place.id,
          place.name,
          place.type,
          place.lat,
          place.lng,
          place.location,
          place.description || '',
          place.rating || 4.5,
          place.hours || '',
          tagsStr,
          place.image || ''
        ]);
      }
    }

    console.log('✅ Success: Real database tables checked/initialized and primed with initial seed records!');
  } catch (err) {
    console.error('❌ Error executing automatic database migration/schema build:', err);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise
  ]);
}

if (isPostgresConfigured) {
  try {
    const connectionUri = getDbConnectionString();
    if (connectionUri) {
      pool = new Pool({
        connectionString: connectionUri,
        ssl: connectionUri.includes('localhost') ? false : { rejectUnauthorized: false }
      });
    } else {
      pool = new Pool({
        host: process.env.POSTGRES_HOST || process.env.SQL_HOST,
        user: process.env.POSTGRES_USER || process.env.SQL_USER,
        password: process.env.POSTGRES_PASSWORD || process.env.SQL_PASSWORD,
        database: process.env.POSTGRES_DATABASE || process.env.SQL_DB_NAME,
        port: parseInt(process.env.POSTGRES_PORT || process.env.SQL_PORT || '5432'),
        ssl: (process.env.SQL_HOST && !process.env.SQL_HOST.includes('localhost')) ? { rejectUnauthorized: false } : false,
      });
    }
    console.log('🔌 Success: Initialized PostgreSQL/Supabase Server connection pool.');
    
    // Asynchronously verify connection and initialize database tables & schema without blocking the server boot
    const verifyAndInitialize = async () => {
      if (!pool) return;
      try {
        console.log('📡 Testing PostgreSQL/Supabase Connection (2.5s Timeout)...');
        await withTimeout(pool.query('SELECT 1'), 2500, 'Database connection timed out');
        console.log('✅ Success: Database server responded. Initializing schemas...');
        await initializeRealDatabase(pool);
      } catch (err: any) {
        console.warn('⚠️ Relational database connection failed/timed out at startup. Disabling Pool to prevent API route hangs.');
        console.warn('Reason:', err.message || err);
        pool = null; // Set to null so queries instantly fallback to JSON simulation
      }
    };
    
    verifyAndInitialize();
  } catch (err) {
    console.error('❌ Failed to initialize Postgres Pool, using local database fallback instead:', err);
  }
}

/**
 * Executes raw SQL queries beautifully.
 * Fallbacks to safe memory-based simulated SQL if no real relational DB is binded.
 */
export async function query<T = any>(sql: string, params: SQLValue[] = []): Promise<T[]> {
  const normalizedSql = sql.trim().replace(/\s+/g, ' ');

  // CASE 1: If Postgres is configured and active, execute live SQL queries
  if (pool) {
    try {
      // Convert ? placeholders to $1, $2 for Postgres if needed
      let pgSql = normalizedSql;
      let paramCount = 1;
      while (pgSql.includes('?')) {
        pgSql = pgSql.replace('?', `$${paramCount++}`);
      }
      const res = await pool.query(pgSql, params as any[]);
      return res.rows as T[];
    } catch (err) {
      console.error('Postgres Query Execution Error, falling back to local simulation:', err);
    }
  }

  // CASE 2: Simulating full SQL CRUD queries on client-side simulation (failsafe memory fallback)
  return simulateSqlQuery<T>(normalizedSql, params);
}

// Simulated SQL Parser & CRUD logic (failsafe offline-first mode)
function simulateSqlQuery<T = any>(sql: string, params: SQLValue[] = []): T[] {
  const upperSql = sql.toUpperCase();

  // Helper read/write methods that respect read-only filesystems using in-memory fallbacks
  const readJSON = (filePath: string, fallbackData: any[]): any[] => {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (e) {
      // Return in-memory fallback if disk operations are restricted
    }
    return fallbackData;
  };

  const writeJSON = (filePath: string, data: any[], cacheRef: any[]) => {
    // Sync the local memory model
    cacheRef.splice(0, cacheRef.length, ...data);
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn(`[Read-Only Protection] Local filesystem is unwritable for path: ${filePath}. Retaining state solely in in-memory session cache.`);
    }
  };

  // --- QUERY 1: SELECT FROM users ---
  if (upperSql.includes('FROM USERS')) {
    const users = readJSON(USERS_FILE_PATH, inMemoryUsers);
    if (upperSql.includes('WHERE EMAIL = ?')) {
      const emailParam = String(params[0] || '').toLowerCase().trim();
      const matched = users.filter((u: any) => u.email.toLowerCase().trim() === emailParam);
      return matched as unknown as T[];
    }
    return users as unknown as T[];
  }

  // --- QUERY 2: INSERT INTO users ---
  if (upperSql.startsWith('INSERT INTO USERS')) {
    const users = readJSON(USERS_FILE_PATH, inMemoryUsers);
    const email = String(params[0] || '').toLowerCase().trim();
    const password = String(params[1] || '');
    const role = String(params[2] || 'user');

    // Prevent duplicates
    if (users.some((u: any) => u.email === email)) {
      throw new Error('User with this email already exists.');
    }

    const nextId = users.length > 0 ? Math.max(...users.map((u: any) => u.id)) + 1 : 1;
    const newUser = { id: nextId, email, password, role };
    users.push(newUser);
    writeJSON(USERS_FILE_PATH, users, inMemoryUsers);

    return [{ id: nextId, email, role }] as unknown as T[];
  }

  // --- QUERY 3: SELECT FROM user_favorites ---
  if (upperSql.includes('FROM USER_FAVORITES') || upperSql.includes('FROM USER_FAVOURITES')) {
    const favs = readJSON(FAVORITES_FILE_PATH, inMemoryFavorites);
    if (upperSql.includes('WHERE USER_ID = ?') && params[0] !== undefined) {
      const uId = Number(params[0]);
      const filtered = favs.filter((f: any) => f.user_id === uId);
      return filtered as unknown as T[];
    }
    return favs as unknown as T[];
  }

  // --- QUERY 4: INSERT INTO user_favorites ---
  if (upperSql.startsWith('INSERT INTO USER_FAVORITES') || upperSql.startsWith('INSERT INTO USER_FAVOURITES')) {
    const favs = readJSON(FAVORITES_FILE_PATH, inMemoryFavorites);
    const userId = Number(params[0]);
    const placeId = Number(params[1]);

    // Avoid duplicate key insert
    if (!favs.some((f: any) => f.user_id === userId && f.place_id === placeId)) {
      const nextId = favs.length > 0 ? Math.max(...favs.map((f: any) => f.id)) + 1 : 1;
      favs.push({ id: nextId, user_id: userId, place_id: placeId });
      writeJSON(FAVORITES_FILE_PATH, favs, inMemoryFavorites);
    }
    return [{ success: true }] as unknown as T[];
  }

  // --- QUERY 5: DELETE FROM user_favorites ---
  if (upperSql.startsWith('DELETE FROM USER_FAVORITES') || upperSql.startsWith('DELETE FROM USER_FAVOURITES')) {
    let favs = readJSON(FAVORITES_FILE_PATH, inMemoryFavorites);
    const userId = Number(params[0]);
    const placeId = Number(params[1]);

    favs = favs.filter((f: any) => !(f.user_id === userId && f.place_id === placeId));
    writeJSON(FAVORITES_FILE_PATH, favs, inMemoryFavorites);
    return [{ success: true }] as unknown as T[];
  }

  // --- QUERY 6: SELECT FROM user_revisits ---
  if (upperSql.includes('FROM USER_REVISITS')) {
    const revisits = readJSON(REVISITS_FILE_PATH, inMemoryRevisits);
    if (upperSql.includes('WHERE USER_ID = ?') && params[0] !== undefined) {
      const uId = Number(params[0]);
      const filtered = revisits.filter((r: any) => r.user_id === uId);
      return filtered as unknown as T[];
    }
    return revisits as unknown as T[];
  }

  // --- QUERY 7: INSERT INTO user_revisits ---
  if (upperSql.startsWith('INSERT INTO USER_REVISITS')) {
    const revisits = readJSON(REVISITS_FILE_PATH, inMemoryRevisits);
    const userId = Number(params[0]);
    const placeId = Number(params[1]);

    if (!revisits.some((r: any) => r.user_id === userId && r.place_id === placeId)) {
      const nextId = revisits.length > 0 ? Math.max(...revisits.map((r: any) => r.id)) + 1 : 1;
      revisits.push({ id: nextId, user_id: userId, place_id: placeId });
      writeJSON(REVISITS_FILE_PATH, revisits, inMemoryRevisits);
    }
    return [{ success: true }] as unknown as T[];
  }

  // --- QUERY 8: DELETE FROM user_revisits ---
  if (upperSql.startsWith('DELETE FROM USER_REVISITS')) {
    let revisits = readJSON(REVISITS_FILE_PATH, inMemoryRevisits);
    const userId = Number(params[0]);
    const placeId = Number(params[1]);

    revisits = revisits.filter((r: any) => !(r.user_id === userId && r.place_id === placeId));
    writeJSON(REVISITS_FILE_PATH, revisits, inMemoryRevisits);
    return [{ success: true }] as unknown as T[];
  }

  // --- QUERY 9: places.json CRUD ---
  let places: Place[] = readJSON(PLACES_FILE_PATH, inMemoryPlaces);

  // SELECT * FROM places ...
  if (upperSql.startsWith('SELECT')) {
    return places as unknown as T[];
  }

  // INSERT INTO places ...
  if (upperSql.startsWith('INSERT INTO')) {
    let tagsArray: string[] = [];
    if (typeof params[7] === 'string') {
      try {
        tagsArray = JSON.parse(params[7] as string);
      } catch {
        tagsArray = (params[7] as string).split(',').map((t: string) => t.trim()).filter(Boolean);
      }
    } else if (Array.isArray(params[7])) {
      tagsArray = params[7];
    }

    const newId = places.length > 0 ? Math.max(...places.map(p => p.id)) + 1 : 1;
    
    const newPlace: Place = {
      id: newId,
      name: String(params[0] || ''),
      type: (params[1] === 'restaurant' ? 'restaurant' : 'activity') as 'restaurant' | 'activity',
      lat: Number(params[2] || 0),
      lng: Number(params[3] || 0),
      location: String(params[4] || ''),
      description: String(params[5] || ''),
      rating: Number(params[6] || 4.5),
      hours: String(params[8] || 'Flexible Hours'),
      tags: tagsArray,
      image: String(params[9] || 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80')
    };

    places.push(newPlace);
    writeJSON(PLACES_FILE_PATH, places, inMemoryPlaces);
    console.log(`💾 SQL Insert Simulated Successfully: "${newPlace.name}" saved.`);

    return [{ insertId: newId, affectedRows: 1 }] as unknown as T[];
  }

  return [] as T[];
}
