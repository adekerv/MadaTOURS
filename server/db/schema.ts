export function schema(dialect: 'postgres' | 'sqlite') {
  const id = dialect === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  return `
    CREATE TABLE IF NOT EXISTS madatours_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      id ${id}, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'))
    );
    CREATE TABLE IF NOT EXISTS places (
      id ${id}, name TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('restaurant', 'activity')),
      lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL,
      location TEXT NOT NULL, description TEXT NOT NULL,
      rating DOUBLE PRECISION, hours TEXT, tags TEXT NOT NULL DEFAULT '[]', image TEXT
    );
    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, place_id)
    );
    CREATE TABLE IF NOT EXISTS user_revisits (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, place_id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS favorites_place_idx ON user_favorites(place_id);
    CREATE INDEX IF NOT EXISTS revisits_place_idx ON user_revisits(place_id);
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY, hits INTEGER NOT NULL, resets_at BIGINT NOT NULL
    );
  `;
}
