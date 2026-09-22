import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/app';
import { createDatabase, initializeDatabase } from '../server/db';
import type { AddressInfo } from 'node:net';

async function fixture() {
  const db = await createDatabase({ file: ':memory:' });
  await initializeDatabase(db);
  const server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = async (
    path: string,
    method = 'GET',
    body?: unknown,
    cookie = '',
    headers: Record<string, string> = {},
  ) => {
    const response = await fetch(`${origin}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-MadaTours-Client': '1',
        Cookie: cookie,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
      headers: response.headers,
    };
  };
  const register = (email = 'visitor@example.test') =>
    request('/auth/register', 'POST', { email, password: 'long test password 42' });
  return {
    db,
    request,
    register,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await db.close();
    },
  };
}

test('registration hashes passwords, normalizes email, and never grants a requested admin role', async () => {
  const f = await fixture();
  try {
    const result = await f.request('/auth/register', 'POST', {
      email: ' ADMIN@example.test ',
      password: 'long test password 42',
      role: 'admin',
    });
    assert.equal(result.status, 201);
    assert.equal(result.data.user.role, 'user');
    assert.equal(result.data.user.email, 'admin@example.test');
    assert.match(result.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(result.headers.get('set-cookie')!, /SameSite=Lax/);
    const [stored] = await f.db.query<{ password: string }>('SELECT password FROM users');
    assert.match(stored.password, /^scrypt:/);
    assert.notEqual(stored.password, 'long test password 42');
    assert.equal((await f.register('ADMIN@example.test')).status, 409);
    assert.equal(
      (await f.request('/auth/register', 'POST', { email: 'bad', password: 'short' })).status,
      400,
    );
    assert.equal(
      (await f.request('/auth/login', 'POST', { email: 'admin@example.test', password: 'wrong' }))
        .status,
      401,
    );
    const login = await f.request('/auth/login', 'POST', {
      email: 'ADMIN@example.test',
      password: 'long test password 42',
    });
    assert.equal(login.status, 200);
    assert.equal(
      (await f.request('/auth/session', 'GET', undefined, login.cookie)).data.user.email,
      'admin@example.test',
    );
  } finally {
    await f.close();
  }
});

test('favorites and revisits belong to the session, survive duplicates, and can be removed', async () => {
  const f = await fixture();
  try {
    const alice = await f.register('alice@example.test');
    const bob = await f.register('bob@example.test');
    for (const collection of ['favorites', 'revisits']) {
      assert.equal((await f.request(`/${collection}?userId=${alice.data.user.id}`)).status, 401);
      assert.equal(
        (
          await f.request(
            `/${collection}`,
            'POST',
            { placeId: 1, userId: bob.data.user.id },
            alice.cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (await f.request(`/${collection}`, 'POST', { placeId: 1 }, alice.cookie)).status,
        200,
      );
      assert.equal(
        (await f.request(`/${collection}`, 'GET', undefined, alice.cookie)).data.length,
        1,
      );
      assert.equal(
        (
          await f.request(
            `/${collection}?userId=${alice.data.user.id}`,
            'GET',
            undefined,
            bob.cookie,
          )
        ).data.length,
        0,
      );
      await f.request(
        `/${collection}?userId=${alice.data.user.id}&placeId=1`,
        'DELETE',
        undefined,
        bob.cookie,
      );
      assert.equal(
        (await f.request(`/${collection}`, 'GET', undefined, alice.cookie)).data.length,
        1,
      );
      await f.request(`/${collection}?placeId=1`, 'DELETE', undefined, alice.cookie);
      assert.equal(
        (await f.request(`/${collection}`, 'GET', undefined, alice.cookie)).data.length,
        0,
      );
      assert.equal(
        (await f.request(`/${collection}`, 'POST', { placeId: 99999 }, alice.cookie)).status,
        404,
      );
    }
  } finally {
    await f.close();
  }
});

test('only a server-authorized admin can add and delete places, with correct fields and cascading saved lists', async () => {
  const f = await fixture();
  try {
    const admin = await f.register('owner@example.test');
    const input = {
      name: 'Test place',
      type: 'activity',
      location: 'Test town',
      lat: 0,
      lng: 0,
      description: 'A test-only place.',
      hours: 'By appointment',
      tags: ['Hiking'],
      rating: 0,
    };
    assert.equal((await f.request('/places', 'POST', input)).status, 401);
    assert.equal((await f.request('/places', 'POST', input, admin.cookie)).status, 403);
    assert.equal((await f.request('/places/1', 'DELETE', undefined, admin.cookie)).status, 403);
    await f.db.query("UPDATE users SET role = 'admin' WHERE id = $1", [admin.data.user.id]);
    assert.equal(
      (await f.request('/places', 'POST', { ...input, lat: 91 }, admin.cookie)).status,
      400,
    );
    assert.equal(
      (await f.request('/places', 'POST', { ...input, image: 'javascript:alert(1)' }, admin.cookie))
        .status,
      400,
    );
    const added = await f.request('/places', 'POST', input, admin.cookie);
    assert.equal(added.status, 201);
    assert.ok(added.data.id > 24);
    assert.equal(added.data.hours, input.hours);
    assert.deepEqual(added.data.tags, input.tags);
    assert.equal(added.data.rating, 0);
    for (const collection of ['favorites', 'revisits'])
      await f.request(`/${collection}`, 'POST', { placeId: added.data.id }, admin.cookie);
    assert.equal(
      (await f.request(`/places/${added.data.id}`, 'DELETE', undefined, admin.cookie)).status,
      200,
    );
    for (const collection of ['favorites', 'revisits'])
      assert.equal(
        (await f.request(`/${collection}`, 'GET', undefined, admin.cookie)).data.length,
        0,
      );
    assert.equal(
      (await f.request(`/places/${added.data.id}`, 'DELETE', undefined, admin.cookie)).status,
      404,
    );
  } finally {
    await f.close();
  }
});

test('logout revokes the session, expired and forged sessions are rejected', async () => {
  const f = await fixture();
  try {
    const user = await f.register();
    assert.equal((await f.request('/auth/logout', 'POST', undefined, user.cookie)).status, 200);
    assert.equal((await f.request('/favorites', 'GET', undefined, user.cookie)).status, 401);
    const login = await f.request('/auth/login', 'POST', {
      email: 'visitor@example.test',
      password: 'long test password 42',
    });
    await f.db.query('UPDATE sessions SET expires_at = $1', [0]);
    assert.equal((await f.request('/favorites', 'GET', undefined, login.cookie)).status, 401);
    assert.equal(
      (await f.request('/favorites', 'GET', undefined, `madatours_session=${'a'.repeat(64)}`))
        .status,
      401,
    );
    assert.equal((await f.request('/auth/session')).data.user, null);
  } finally {
    await f.close();
  }
});

test('account deletion requires the current password and removes all private data', async () => {
  const f = await fixture();
  try {
    const user = await f.register();
    for (const collection of ['favorites', 'revisits'])
      await f.request(`/${collection}`, 'POST', { placeId: 1 }, user.cookie);
    assert.equal(
      (await f.request('/account', 'DELETE', { password: 'wrong' }, user.cookie)).status,
      401,
    );
    assert.equal(
      (await f.request('/account', 'DELETE', { password: 'long test password 42' }, user.cookie))
        .status,
      200,
    );
    for (const table of ['users', 'sessions', 'user_favorites', 'user_revisits'])
      assert.equal((await f.db.query(`SELECT * FROM ${table}`)).length, 0);
    assert.equal((await f.request('/favorites', 'GET', undefined, user.cookie)).status, 401);
  } finally {
    await f.close();
  }
});

test('public catalogue validates query input and returns sorted numeric distances and parsed tags', async () => {
  const f = await fixture();
  try {
    const result = await f.request('/places?lat=14.6415&lng=-61.0242&radius=100');
    assert.equal(result.status, 200);
    assert.equal(result.data.length, 24);
    assert.ok(Array.isArray(result.data[0].tags));
    assert.ok(
      result.data.every(
        (place: { distance: number }, i: number) =>
          i === 0 || result.data[i - 1].distance <= place.distance,
      ),
    );
    for (const query of [
      'lat=no&lng=0',
      'lat=91&lng=0',
      'lat=0',
      'lat=0&lng=0&radius=0',
      'lat=0&lng=0&radius=1000',
      'lat=&lng=0',
      'lat=0&lat=1&lng=0',
    ])
      assert.equal((await f.request(`/places?${query}`)).status, 400);
    assert.equal((await f.request('/unknown')).status, 404);
  } finally {
    await f.close();
  }
});

test('cross-origin and missing CSRF headers cannot perform writes; rate limits are enforced', async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.request('/auth/register', 'POST', {}, '', { Origin: 'https://attacker.example' }))
        .status,
      403,
    );
    assert.equal(
      (await f.request('/auth/register', 'POST', {}, '', { 'X-MadaTours-Client': '' })).status,
      403,
    );
    for (let i = 0; i < 10; i++)
      await f.request('/auth/login', 'POST', { email: 'missing@example.test', password: 'wrong' });
    assert.equal(
      (await f.request('/auth/login', 'POST', { email: 'missing@example.test', password: 'wrong' }))
        .status,
      429,
    );
  } finally {
    await f.close();
  }
});
