import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/app';
import { testDatabase } from './support/database';
import { testClients } from './support/clients';
test('Supabase API: verification, ownership, roles, recovery, logout, validation, and deletion', async () => {
  const db = await testDatabase();
  const fixture = testClients(db);
  const server = createApp(fixture.clients).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  const base = `http://127.0.0.1:${address.port}/api`;
  const jar = { alice: '', bob: '' };
  const call = async (
    path: string,
    method = 'GET',
    body?: unknown,
    who: 'alice' | 'bob' = 'alice',
    headers: Record<string, string> = {},
  ) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        'X-MadaTours-Client': '1',
        'Content-Type': 'application/json',
        Cookie: jar[who],
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = res.headers.get('set-cookie');
    if (cookie) jar[who] = cookie.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
  try {
    assert.equal((await call('/health')).status, 200);
    assert.equal((await call('/favorites')).status, 401);
    const signup = await call('/auth/register', 'POST', {
      email: 'Alice@example.test',
      password: 'long test password',
      role: 'admin',
    });
    assert.equal(signup.status, 201);
    assert.equal(signup.body.verificationRequired, true);
    assert.equal(signup.body.user, null);
    assert.equal(
      (
        await call('/auth/login', 'POST', {
          email: 'alice@example.test',
          password: 'long test password',
        })
      ).status,
      403,
    );
    const verified = await call('/auth/verify', 'POST', {
      email: 'alice@example.test',
      token: '123456',
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.user.role, 'user');
    const aliceId = verified.body.user.id;
    assert.equal((await call('/auth/session')).body.user.id, aliceId);
    await call(
      '/auth/register',
      'POST',
      { email: 'bob@example.test', password: 'other test password' },
      'bob',
    );
    await call('/auth/verify', 'POST', { email: 'bob@example.test', token: '123456' }, 'bob');
    assert.equal(
      (await call('/favorites', 'POST', { placeId: 1, userId: 'someone-else' })).status,
      200,
    );
    await call('/favorites', 'POST', { placeId: 1 });
    assert.equal((await call('/favorites')).body.length, 1);
    assert.equal(
      (await call(`/favorites?userId=${aliceId}`, 'GET', undefined, 'bob')).body.length,
      0,
    );
    assert.equal((await call('/places', 'POST', { name: 'Denied' })).status, 403);
    assert.equal((await call('/favorites', 'POST', { placeId: 999999 })).status, 404);
    assert.equal((await call('/places?lat=&lng=0&radius=4')).status, 400);
    assert.equal(
      (
        await call('/favorites', 'POST', { placeId: 1 }, 'alice', {
          Origin: 'https://attacker.example',
        })
      ).status,
      403,
    );
    assert.equal(
      (await call('/favorites', 'POST', { placeId: 1 }, 'alice', { 'X-MadaTours-Client': '' }))
        .status,
      403,
    );
    assert.equal((await call('/favorites?placeId=1', 'DELETE')).status, 200);
    assert.equal((await call('/favorites')).body.length, 0);
    await fixture.grantAdmin('alice@example.test');
    const added = await call('/places', 'POST', {
      name: 'Test place',
      type: 'activity',
      lat: 14.7,
      lng: -61,
      location: 'Test',
      description: 'Test place',
      tags: ['Hiking'],
      hours: '09:00–17:00',
    });
    assert.equal(added.status, 201);
    assert.ok(added.body.id > 24);
    assert.equal(added.body.hours, '09:00–17:00');
    assert.deepEqual(added.body.tags, ['Hiking']);
    await call('/favorites', 'POST', { placeId: added.body.id }, 'bob');
    assert.equal((await call(`/places/${added.body.id}`, 'DELETE')).status, 200);
    assert.equal((await call('/favorites', 'GET', undefined, 'bob')).body.length, 0);
    await call('/auth/forgot-password', 'POST', { email: 'bob@example.test' }, 'bob');
    assert.equal(
      (
        await call(
          '/auth/reset-password',
          'POST',
          { email: 'bob@example.test', token: '123456', password: 'new very long password' },
          'bob',
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          '/auth/reset-password',
          'POST',
          { email: 'bob@example.test', token: '654321', password: 'new very long password' },
          'bob',
        )
      ).status,
      200,
    );
    assert.equal((await call('/auth/session', 'GET', undefined, 'bob')).body.user, null);
    assert.equal(
      (
        await call(
          '/auth/login',
          'POST',
          { email: 'bob@example.test', password: 'new very long password' },
          'bob',
        )
      ).status,
      200,
    );
    assert.equal((await call('/account', 'DELETE', { password: 'wrong' }, 'bob')).status, 400);
    await call('/favorites', 'POST', { placeId: 1 }, 'bob');
    assert.equal(
      (await call('/account', 'DELETE', { password: 'new very long password' }, 'bob')).status,
      200,
    );
    assert.equal((await call('/auth/session', 'GET', undefined, 'bob')).body.user, null);
    const oldCookie = jar.alice;
    await call('/auth/logout', 'POST');
    assert.equal((await call('/auth/session')).body.user, null);
    assert.equal(
      (await call('/favorites', 'GET', undefined, 'alice', { Cookie: oldCookie })).status,
      401,
    );
  } finally {
    server.close();
    await once(server, 'close');
    await db.close();
  }
});
