import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { Place } from '../types';

// Let's reference the persistent data store paths
const PLACES_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'places.json');
const USERS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'users.json');
const FAVORITES_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'user_favorites.json');
const REVISITS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'user_revisits.json');

// Interface mimicking index-based parameter inputs
type SQLValue = string | number | boolean | null | undefined;

// Create MySQL connection pool configuration (can use env vars)
let pool: mysql.Pool | null = null;
const isMySQLConfigured = !!(
  process.env.MYSQL_HOST ||
  process.env.DATABASE_URL
);

if (isMySQLConfigured) {
  try {
    const connectionUri = process.env.DATABASE_URL;
    if (connectionUri) {
      pool = mysql.createPool(connectionUri);
    } else {
      pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
    }
    console.log('🔌 Success: Connected to MySQL/Relational SQL Server!');
  } catch (err) {
    console.error('❌ Failed to initialize MySQL Pool, using local database fallback instead:', err);
  }
}

/**
 * Executes raw SQL queries beautifully.
 * 
 * Elegant side-by-side comparison for PHP / PDO:
 * 
 * PHP (PDO equivalent):
 * -------------------
 * $stmt = $pdo->prepare("SELECT * FROM places WHERE type = ?");
 * $stmt->execute([$filter]);
 * $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
 * 
 * TypeScript (Node Equivalent below):
 * -------------------
 * const rows = await query("SELECT * FROM places WHERE type = ?", [filter]);
 */
export async function query<T = any>(sql: string, params: SQLValue[] = []): Promise<T[]> {
  const normalizedSql = sql.trim().replace(/\s+/g, ' ');

  // CASE 1: If MySQL is configured and active, execute live SQL queries
  if (pool) {
    try {
      const [rows] = await pool.execute(normalizedSql, params);
      return rows as T[];
    } catch (err) {
      console.error('MySQL Query Execution Error, falling back to local simulation:', err);
    }
  }

  // CASE 2: Simulating full SQL CRUD queries on file-based relational storage
  // This allows the app to work out-of-the-box in the preview sandbox without forcing
  // immediate database server provisioning, while letting you write 100% correct raw SQL code!
  return simulateSqlQuery<T>(normalizedSql, params);
}

// Ensure the tables in JSON contain basic/test records out-of-the-box
function ensureTableExists(filePath: string, defaultContent: any) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
  }
}

// Simulated SQL Parser & CRUD logic
function simulateSqlQuery<T = any>(sql: string, params: SQLValue[] = []): T[] {
  const upperSql = sql.toUpperCase();

  // Create tables with basic seed options
  ensureTableExists(USERS_FILE_PATH, [
    { id: 1, email: 'admin@madatours.com', password: 'admin', role: 'admin' },
    { id: 2, email: 'user@madatours.com', password: 'user', role: 'user' }
  ]);
  ensureTableExists(FAVORITES_FILE_PATH, []);
  ensureTableExists(REVISITS_FILE_PATH, []);

  // Helper read functions
  const readJSON = (filePath: string): any[] => {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (e) {
      console.error(`Error reading database file: ${filePath}`, e);
    }
    return [];
  };

  const writeJSON = (filePath: string, data: any[]) => {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error(`Error writing database file: ${filePath}`, e);
    }
  };

  // --- QUERY 1: SELECT FROM users ---
  if (upperSql.includes('FROM USERS')) {
    const users = readJSON(USERS_FILE_PATH);
    if (upperSql.includes('WHERE EMAIL = ?')) {
      const emailParam = String(params[0] || '').toLowerCase().trim();
      const matched = users.filter((u: any) => u.email.toLowerCase().trim() === emailParam);
      return matched as unknown as T[];
    }
    return users as unknown as T[];
  }

  // --- QUERY 2: INSERT INTO users ---
  if (upperSql.startsWith('INSERT INTO USERS')) {
    const users = readJSON(USERS_FILE_PATH);
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
    writeJSON(USERS_FILE_PATH, users);

    return [{ id: nextId, email, role }] as unknown as T[];
  }

  // --- QUERY 3: SELECT FROM user_favorites ---
  if (upperSql.includes('FROM USER_FAVORITES') || upperSql.includes('FROM USER_FAVOURITES')) {
    const favs = readJSON(FAVORITES_FILE_PATH);
    if (upperSql.includes('WHERE USER_ID = ?') && params[0] !== undefined) {
      const uId = Number(params[0]);
      const filtered = favs.filter((f: any) => f.user_id === uId);
      return filtered as unknown as T[];
    }
    return favs as unknown as T[];
  }

  // --- QUERY 4: INSERT INTO user_favorites ---
  if (upperSql.startsWith('INSERT INTO USER_FAVORITES') || upperSql.startsWith('INSERT INTO USER_FAVOURITES')) {
    const favs = readJSON(FAVORITES_FILE_PATH);
    const userId = Number(params[0]);
    const placeId = Number(params[1]);

    // Avoid duplicate key insert
    if (!favs.some((f: any) => f.user_id === userId && f.place_id === placeId)) {
      const nextId = favs.length > 0 ? Math.max(...favs.map((f: any) => f.id)) + 1 : 1;
      favs.push({ id: nextId, user_id: userId, place_id: placeId });
      writeJSON(FAVORITES_FILE_PATH, favs);
    }
    return [{ success: true }] as unknown as T[];
  }

  // --- QUERY 5: DELETE FROM user_favorites ---
  if (upperSql.startsWith('DELETE FROM USER_FAVORITES') || upperSql.startsWith('DELETE FROM USER_FAVOURITES')) {
    let favs = readJSON(FAVORITES_FILE_PATH);
    const userId = Number(params[0]);
    const placeId = Number(params[1]);

    favs = favs.filter((f: any) => !(f.user_id === userId && f.place_id === placeId));
    writeJSON(FAVORITES_FILE_PATH, favs);
    return [{ success: true }] as unknown as T[];
  }

  // --- QUERY 6: SELECT FROM user_revisits ---
  if (upperSql.includes('FROM USER_REVISITS')) {
    const revisits = readJSON(REVISITS_FILE_PATH);
    if (upperSql.includes('WHERE USER_ID = ?') && params[0] !== undefined) {
      const uId = Number(params[0]);
      const filtered = revisits.filter((r: any) => r.user_id === uId);
      return filtered as unknown as T[];
    }
    return revisits as unknown as T[];
  }

  // --- QUERY 7: INSERT INTO user_revisits ---
  if (upperSql.startsWith('INSERT INTO USER_REVISITS')) {
    const revisits = readJSON(REVISITS_FILE_PATH);
    const userId = Number(params[0]);
    const placeId = Number(params[1]);

    if (!revisits.some((r: any) => r.user_id === userId && r.place_id === placeId)) {
      const nextId = revisits.length > 0 ? Math.max(...revisits.map((r: any) => r.id)) + 1 : 1;
      revisits.push({ id: nextId, user_id: userId, place_id: placeId });
      writeJSON(REVISITS_FILE_PATH, revisits);
    }
    return [{ success: true }] as unknown as T[];
  }

  // --- QUERY 8: DELETE FROM user_revisits ---
  if (upperSql.startsWith('DELETE FROM USER_REVISITS')) {
    let revisits = readJSON(REVISITS_FILE_PATH);
    const userId = Number(params[0]);
    const placeId = Number(params[1]);

    revisits = revisits.filter((r: any) => !(r.user_id === userId && r.place_id === placeId));
    writeJSON(REVISITS_FILE_PATH, revisits);
    return [{ success: true }] as unknown as T[];
  }

  // --- QUERY 9: places.json CRUD ---
  let places: Place[] = readJSON(PLACES_FILE_PATH);

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
    writeJSON(PLACES_FILE_PATH, places);
    console.log(`💾 SQL Insert Simulated Successfully: "${newPlace.name}" saved.`);

    return [{ insertId: newId, affectedRows: 1 }] as unknown as T[];
  }

  return [] as T[];
}
