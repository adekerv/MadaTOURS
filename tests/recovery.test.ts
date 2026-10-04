import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startLaravel } from './support/laravel';

type Who = 'alice' | 'bob' | 'guest';
const format = /^[A-HJKMNP-TV-Z2-9]{5}-[A-HJKMNP-TV-Z2-9]{5}$/;
test('Accounts without email: signup, login, email change, recovery codes, reuse and rate limits', async () => {
  const app = await startLaravel();
  const base = `${app.origin}/api`;
  const jar: Record<Who, string> = { alice: '', bob: '', guest: '' };
  const call = async (path: string, method = 'GET', body?: unknown, who: Who = 'guest') => {
    const res = await fetch(base + path, {
      method,
      headers: { 'X-MadaTours-Client': '1', 'Content-Type': 'application/json', Cookie: jar[who] },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = res.headers
      .getSetCookie()
      .find((value) => value.startsWith('madatours-session='));
    if (cookie && who !== 'guest') jar[who] = cookie.split(';')[0];
    const raw = await res.text();
    return { status: res.status, body: raw ? JSON.parse(raw) : null };
  };
  const rows = async (sql: string, params: unknown[] = []) =>
    (await app.db.query<Record<string, unknown>>(sql, params)).rows;
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await rows(sql, params))[0].n);
  const as = async (role: 'anon' | 'authenticated', sub: string, run: () => Promise<void>) => {
    await app.db.exec(`SET ROLE ${role}`);
    await app.db.exec(`SELECT set_config('request.jwt.claim.sub','${sub}',false)`);
    try {
      await run();
    } finally {
      await app.db.exec('RESET ROLE');
      await app.db.exec(`SELECT set_config('request.jwt.claim.sub','',false)`);
    }
  };
  const reset = (email: string, code: string, password = 'a brand new password') =>
    call('/auth/recover', 'POST', { email, code, password });
  try {
    // Signup signs in at once and hands over eight codes, once, in a readable form that is never stored.
    const signup = await call(
      '/auth/register',
      'POST',
      { name: 'Alice', email: 'alice@example.test', password: 'long test password' },
      'alice',
    );
    assert.equal(signup.status, 201);
    assert.equal(signup.body.verificationRequired, false);
    const alice = signup.body.user;
    const codes: string[] = signup.body.recoveryCodes;
    assert.equal(codes.length, 8);
    assert.equal(new Set(codes).size, 8);
    for (const code of codes) assert.match(code, format);
    const stored = await rows('SELECT code_hash, used_at FROM mt_recovery_codes WHERE user_id=$1', [
      alice.id,
    ]);
    assert.equal(stored.length, 8);
    for (const row of stored) {
      assert.match(String(row.code_hash), /^\$2y\$/);
      assert.equal(row.used_at, null);
      for (const code of codes) assert.ok(!String(row.code_hash).includes(code.replace('-', '')));
    }
    assert.equal((await call('/auth/session', 'GET', undefined, 'alice')).body.user.id, alice.id);

    // Login works with the password and not with a wrong one.
    const login = (password: string, who: Who = 'guest', email = 'alice@example.test') =>
      call('/auth/login', 'POST', { email, password }, who);
    assert.equal((await login('wrong password')).status, 400);
    assert.equal((await login('long test password', 'alice')).status, 200);
    assert.deepEqual((await call('/account/recovery-codes', 'GET', undefined, 'alice')).body, {
      remaining: 8,
      total: 8,
    });

    // Email change: a wrong password fails and changes nothing; the right one takes effect at once.
    const change = (password: string) =>
      call('/account/email', 'POST', { email: 'alice.new@example.test', password }, 'alice');
    assert.equal((await change('nope nope nope')).status, 400);
    assert.equal(
      (await call('/auth/session', 'GET', undefined, 'alice')).body.user.email,
      'alice@example.test',
    );
    const changed = await change('long test password');
    assert.equal(changed.status, 200);
    assert.equal(changed.body.user.email, 'alice.new@example.test');

    // Nobody but the server can read the codes or call the functions, in the database itself.
    for (const [role, sub] of [
      ['anon', ''],
      ['authenticated', alice.id],
    ] as const)
      await as(role, sub, async () => {
        await assert.rejects(app.db.query('SELECT * FROM mt_recovery_codes'), /permission denied/);
        await assert.rejects(
          app.db.query("SELECT mt_recovery_candidates('alice.new@example.test')"),
          /permission denied/,
        );
        await assert.rejects(
          app.db.query('SELECT mt_consume_recovery_code(1)'),
          /permission denied/,
        );
        await assert.rejects(
          app.db.query('SELECT mt_replace_recovery_codes($1,$2::jsonb)', [alice.id, '["x"]']),
          /permission denied/,
        );
        await assert.rejects(
          app.db.query('SELECT mt_revoke_user_sessions($1)', [alice.id]),
          /permission denied/,
        );
      });

    // Reset with a code: a wrong code and an address that does not exist cannot be told apart.
    const wrong = await reset('alice.new@example.test', 'ZZZZZ-ZZZZZ');
    const unknown = await reset('nobody@example.test', codes[0]);
    assert.equal(wrong.status, 400);
    assert.deepEqual(unknown, wrong);
    assert.equal(
      (await login('long test password', 'guest', 'alice.new@example.test')).status,
      200,
    );

    // The right code (any case or spacing) resets the password, signs every session out, and works once.
    await app.db.exec(`INSERT INTO auth.sessions(user_id) VALUES ('${alice.id}'),('${alice.id}')`);
    const sloppy = ` ${codes[3].toLowerCase().replace('-', ' ')} `;
    assert.equal((await reset('Alice.New@Example.test', sloppy)).status, 200);
    assert.equal(
      await count('SELECT count(*) AS n FROM auth.sessions WHERE user_id=$1', [alice.id]),
      0,
    );
    assert.equal(
      (await login('long test password', 'guest', 'alice.new@example.test')).status,
      400,
      'the old password no longer works',
    );
    assert.equal(
      (await login('a brand new password', 'alice', 'alice.new@example.test')).status,
      200,
    );
    const reuse = await reset('alice.new@example.test', codes[3], 'another long password');
    assert.equal(reuse.status, 400, 'a used code cannot be used again');
    assert.equal(
      (await login('another long password', 'guest', 'alice.new@example.test')).status,
      400,
      'the reused code changed nothing',
    );
    assert.deepEqual((await call('/account/recovery-codes', 'GET', undefined, 'alice')).body, {
      remaining: 7,
      total: 8,
    });
    // Using a code up is atomic: of two claims on the same code, exactly one wins.
    const [claimed] = await rows(
      'SELECT id FROM mt_recovery_codes WHERE user_id=$1 AND used_at IS NULL LIMIT 1',
      [alice.id],
    );
    const first = (await rows('SELECT mt_consume_recovery_code($1) AS won', [claimed.id]))[0].won;
    const second = (await rows('SELECT mt_consume_recovery_code($1) AS won', [claimed.id]))[0].won;
    assert.deepEqual([first, second], [true, false]);

    // New codes need the password and replace the old set entirely.
    assert.equal(
      (await call('/account/recovery-codes', 'POST', { password: 'wrong wrong wrong' }, 'alice'))
        .status,
      400,
    );
    assert.equal(
      await count('SELECT count(*) AS n FROM mt_recovery_codes WHERE user_id=$1', [alice.id]),
      8,
    );
    const fresh = await call(
      '/account/recovery-codes',
      'POST',
      { password: 'a brand new password' },
      'alice',
    );
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.codes.length, 8);
    assert.equal(
      await count('SELECT count(*) AS n FROM mt_recovery_codes WHERE user_id=$1', [alice.id]),
      8,
    );
    assert.equal(
      (await reset('alice.new@example.test', codes[5], 'old set password')).status,
      400,
      'the old codes are gone',
    );
    assert.equal(
      (await reset('alice.new@example.test', fresh.body.codes[0], 'new set password')).status,
      200,
    );

    // Attempts are limited per email: five tries (right or wrong), then even a correct code is refused.
    const bob = (
      await call(
        '/auth/register',
        'POST',
        { name: 'Bob', email: 'bob@example.test', password: 'other test password' },
        'bob',
      )
    ).body;
    for (let i = 0; i < 5; i++)
      assert.equal((await reset('bob@example.test', `ZZZZZ-ZZZZ${i + 2}`)).status, 400);
    assert.equal((await reset('bob@example.test', bob.recoveryCodes[0])).status, 429);
    assert.equal(
      await count(
        'SELECT count(*) AS n FROM mt_recovery_codes WHERE user_id=$1 AND used_at IS NOT NULL',
        [bob.user.id],
      ),
      0,
      'a refused attempt uses nothing up',
    );
    // The limit is per email, so another account is unaffected.
    await call('/auth/register', 'POST', {
      name: 'Carol',
      email: 'carol@example.test',
      password: 'third test password',
    });
    assert.equal((await reset('carol@example.test', 'ZZZZZ-ZZZZZ')).status, 400);
  } finally {
    await app.close();
  }
});
