import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { initializeDatabase, type Database, type SqlValue } from '../server/db';
import { hashPassword, rateLimit } from '../server/security';

test('PostgreSQL schema, seed sequence, foreign keys, upserts, and initialization use valid PostgreSQL', async () => {
  const pg = new PGlite();
  const db: Database = {
    dialect: 'postgres',
    query: async <T>(sql: string, values: SqlValue[] = []) => (await pg.query<T>(sql, values)).rows,
    exec: async (sql) => {
      await pg.exec(sql);
    },
    close: () => pg.close(),
  };
  try {
    await initializeDatabase(db);
    const [user] = await db.query<{ id: number }>(
      "INSERT INTO users (email,password,role) VALUES ($1,$2,'user') RETURNING id",
      ['test@example.test', await hashPassword('test password 42')],
    );
    const [place] = await db.query<{ id: number }>(
      "INSERT INTO places (name,type,lat,lng,location,description,tags) VALUES ('A','activity',0,0,'Test','Test','[]') RETURNING id",
    );
    assert.ok(place.id > 24);
    await db.query(
      'INSERT INTO user_favorites (user_id,place_id) VALUES ($1,$2) ON CONFLICT (user_id,place_id) DO NOTHING',
      [user.id, place.id],
    );
    await db.query(
      'INSERT INTO user_favorites (user_id,place_id) VALUES ($1,$2) ON CONFLICT (user_id,place_id) DO NOTHING',
      [user.id, place.id],
    );
    assert.equal((await db.query('SELECT * FROM user_favorites')).length, 1);
    await db.query('DELETE FROM places WHERE id = $1', [place.id]);
    assert.equal((await db.query('SELECT * FROM user_favorites')).length, 0);
    await db.query('DELETE FROM places WHERE id = 1');
    await initializeDatabase(db);
    assert.equal(
      (await db.query('SELECT * FROM places WHERE id = 1')).length,
      0,
      'Initialization must not resurrect deleted places.',
    );
    await rateLimit(db, 'test', 1);
    await assert.rejects(() => rateLimit(db, 'test', 1));
    await db.query('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [
      'hash',
      user.id,
      Date.now() + 1000,
    ]);
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    assert.equal((await db.query('SELECT * FROM sessions')).length, 0);
  } finally {
    await db.close();
  }
});

test('initialization refuses to silently reuse the insecure legacy PostgreSQL schema', async () => {
  const pg = new PGlite();
  const db: Database = {
    dialect: 'postgres',
    query: async <T>(sql: string, values: SqlValue[] = []) => (await pg.query<T>(sql, values)).rows,
    exec: async (sql) => {
      await pg.exec(sql);
    },
    close: () => pg.close(),
  };
  try {
    await db.exec('CREATE TABLE users (id INT)');
    await assert.rejects(() => initializeDatabase(db), /Legacy database/);
  } finally {
    await db.close();
  }
});
