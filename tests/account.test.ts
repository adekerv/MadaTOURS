import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startLaravel } from './support/laravel';

type Who = 'alice' | 'bob';
test('Settings: name, language and email changes, and deletion that removes only the signed-in account', async () => {
  const app = await startLaravel();
  const base = `${app.origin}/api`;
  const jar: Record<Who, string> = { alice: '', bob: '' };
  const call = async (path: string, method = 'GET', body?: unknown, who: Who = 'alice') => {
    const res = await fetch(base + path, {
      method,
      headers: { 'X-MadaTours-Client': '1', 'Content-Type': 'application/json', Cookie: jar[who] },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = res.headers
      .getSetCookie()
      .find((value) => value.startsWith('madatours-session='));
    if (cookie) jar[who] = cookie.split(';')[0];
    const raw = await res.text();
    return { status: res.status, body: JSON.parse(raw) };
  };
  const rows = async (sql: string, params: unknown[] = []) =>
    (await app.db.query<Record<string, unknown>>(sql, params)).rows;
  const count = async (table: string, column: string, id: string) =>
    Number((await rows(`SELECT count(*) AS n FROM ${table} WHERE ${column}=$1`, [id]))[0].n);
  try {
    const alice = (
      await call('/auth/register', 'POST', {
        name: 'Alice',
        email: 'alice@example.test',
        password: 'long test password',
      })
    ).body.user;
    const bob = (
      await call(
        '/auth/register',
        'POST',
        { name: 'Bob', email: 'bob@example.test', password: 'other test password' },
        'bob',
      )
    ).body.user;
    assert.equal(alice.hasPassword, true);

    // Name and language: saved for the signed-in account only, and copied to the public profile.
    const saved = await call('/account/profile', 'POST', {
      name: '  Alice Martin ',
      language: 'fr',
      id: bob.id,
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.user.id, alice.id);
    assert.equal(saved.body.user.name, 'Alice Martin');
    assert.equal(saved.body.user.language, 'fr');
    assert.equal((await call('/auth/session')).body.user.name, 'Alice Martin');
    const names = await rows('SELECT user_id, display_name FROM mt_public_profiles');
    assert.equal(names.find((row) => row.user_id === alice.id)?.display_name, 'Alice Martin');
    assert.equal(names.find((row) => row.user_id === bob.id)?.display_name, 'Bob');
    assert.equal((await call('/auth/session', 'GET', undefined, 'bob')).body.user.name, 'Bob');
    for (const body of [{ name: '<b>x</b>' }, { name: ' ' }, { language: 'de' }, {}]) {
      assert.equal((await call('/account/profile', 'POST', body)).status, 400);
    }

    // The browser clients cannot rewrite the verification flag or the role themselves (RLS and grants).
    await app.db.exec(`UPDATE mt_profiles SET email_verified_at=now() WHERE id='${alice.id}'`);
    await app.db.exec('SET ROLE authenticated');
    await app.db.exec(`SELECT set_config('request.jwt.claim.sub','${alice.id}',false)`);
    await assert.rejects(app.db.exec(`UPDATE mt_profiles SET role='admin' WHERE id='${alice.id}'`));
    await assert.rejects(
      app.db.exec(`UPDATE mt_profiles SET email_verified_at=NULL WHERE id='${alice.id}'`),
    );
    await app.db.exec('RESET ROLE');
    assert.equal((await call('/auth/session')).body.user.emailVerified, true);

    // Email: needs the password, refuses taken addresses, and takes effect at once with no email involved.
    assert.equal(
      (await call('/account/email', 'POST', { email: 'alice.new@example.test', password: 'wrong' }))
        .status,
      400,
    );
    assert.equal(
      (await call('/account/email', 'POST', { email: bob.email, password: 'long test password' }))
        .status,
      400,
    );
    assert.equal((await call('/auth/session')).body.user.email, 'alice@example.test');
    const changed = await call('/account/email', 'POST', {
      email: 'Alice.New@example.test',
      password: 'long test password',
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.user.email, 'alice.new@example.test');
    // Alice was verified, and an address nobody has checked cannot count as verified.
    assert.equal(changed.body.verificationLost, true);
    assert.equal(changed.body.user.emailVerified, false);
    assert.equal((await call('/auth/session')).body.user.emailVerified, false);
    assert.equal(
      (
        await call('/auth/login', 'POST', {
          email: 'alice@example.test',
          password: 'long test password',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call('/auth/login', 'POST', {
          email: 'alice.new@example.test',
          password: 'long test password',
        })
      ).status,
      200,
    );

    // Deletion: give Alice data in every kind of place, and Bob data that must survive.
    const [first, second] = (await rows('SELECT id FROM mt_places ORDER BY id LIMIT 2')).map(
      (row) => Number(row.id),
    );
    await call('/favorites', 'POST', { placeId: first });
    await call('/favorites', 'POST', { placeId: first }, 'bob');
    await app.db.exec(`
      INSERT INTO mt_reviews(user_id,place_id,rating,body) VALUES ('${alice.id}',${first},5,'A review that is long enough.'),('${bob.id}',${first},4,'Bob review that is long enough.');
      INSERT INTO mt_comments(user_id,place_id,body) VALUES ('${alice.id}',${first},'Alice comment'),('${bob.id}',${first},'Bob comment');
      INSERT INTO mt_checkins(user_id,place_id) VALUES ('${alice.id}',${first}),('${bob.id}',${first});
      INSERT INTO mt_follows(follower_id,following_id,status) VALUES ('${alice.id}','${bob.id}','accepted'),('${bob.id}','${alice.id}','accepted');
      UPDATE mt_places SET submitted_by='${alice.id}' WHERE id=${second};
    `);
    const tables: [string, string][] = [
      ['mt_saved_places', 'user_id'],
      ['mt_reviews', 'user_id'],
      ['mt_comments', 'user_id'],
      ['mt_checkins', 'user_id'],
      ['mt_follows', 'follower_id'],
      ['mt_follows', 'following_id'],
      ['mt_public_profiles', 'user_id'],
      ['mt_profiles', 'id'],
    ];
    for (const [table, column] of tables)
      assert.ok(await count(table, column, alice.id), `Alice should have ${table} data first`);

    const confirmation = 'alice.new@example.test';
    const password = 'long test password';
    // Nothing is deleted without the exact typed email and the password.
    for (const body of [
      { password },
      { password, confirmation: 'alice@example.test' },
      { password, confirmation: bob.email },
      { confirmation },
      { confirmation, password: 'wrong' },
    ])
      assert.equal((await call('/account', 'DELETE', body)).status, 400, JSON.stringify(body));
    assert.equal((await call('/auth/session')).body.user.id, alice.id);
    assert.ok(await count('mt_profiles', 'id', alice.id));

    const deleted = await call('/account', 'DELETE', {
      password,
      confirmation: ` ${confirmation.toUpperCase()} `,
    });
    assert.equal(deleted.status, 200);
    assert.equal((await call('/auth/session')).body.user, null);
    assert.equal((await call('/favorites')).status, 401);
    for (const [table, column] of tables)
      assert.equal(await count(table, column, alice.id), 0, `${table} should be empty for Alice`);
    // Bob, the places and their ownership survive; the published place just loses its author.
    for (const [table, column] of [
      ['mt_saved_places', 'user_id'],
      ['mt_reviews', 'user_id'],
      ['mt_comments', 'user_id'],
      ['mt_checkins', 'user_id'],
      ['mt_public_profiles', 'user_id'],
      ['mt_profiles', 'id'],
    ])
      assert.equal(await count(table, column, bob.id), 1, `${table} should keep Bob's row`);
    assert.equal(await count('mt_follows', 'follower_id', bob.id), 0);
    assert.equal((await call('/auth/session', 'GET', undefined, 'bob')).body.user.id, bob.id);
    const place = (await rows('SELECT submitted_by FROM mt_places WHERE id=$1', [second]))[0];
    assert.equal(place.submitted_by, null);
  } finally {
    await app.close();
  }
});
