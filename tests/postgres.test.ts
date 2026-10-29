import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { testDatabase } from './support/database';
const alice = '00000000-0000-4000-8000-000000000001',
  bob = '00000000-0000-4000-8000-000000000002';
test('Supabase SQL enforces RLS even when requests bypass the application API', async () => {
  const db = await testDatabase();
  const asUser = async (id: string, statement: string) => {
    await db.exec('BEGIN');
    try {
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [id]);
      await db.exec('SET LOCAL ROLE authenticated');
      const result = await db.query<Record<string, unknown>>(statement);
      await db.exec('COMMIT');
      return result.rows;
    } catch (e) {
      await db.exec('ROLLBACK');
      throw e;
    }
  };
  try {
    await db.query(
      'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3),($4,$5,$6)',
      [alice, 'admin-in-name@example.test', '{"role":"admin"}', bob, 'bob@example.test', '{}'],
    );
    assert.deepEqual(
      (await asUser(alice, 'SELECT role FROM public.mt_profiles')).map((r) => r.role),
      ['user'],
    );
    await assert.rejects(() => asUser(alice, "UPDATE public.mt_profiles SET role='admin'"));
    await assert.rejects(() =>
      asUser(
        alice,
        `INSERT INTO public.mt_saved_places(user_id,place_id,kind) VALUES('${bob}',1,'favorites')`,
      ),
    );
    await asUser(
      alice,
      `INSERT INTO public.mt_saved_places(user_id,place_id,kind) VALUES('${alice}',1,'favorites')`,
    );
    assert.equal((await asUser(bob, 'SELECT * FROM public.mt_saved_places')).length, 0);
    assert.equal((await asUser(bob, 'DELETE FROM public.mt_saved_places RETURNING *')).length, 0);
    await assert.rejects(() =>
      asUser(
        alice,
        "INSERT INTO public.mt_places(name,type,lat,lng,location,description) VALUES('No','activity',0,0,'x','x')",
      ),
    );
    await assert.rejects(() =>
      asUser(alice, "SELECT public.mt_check_rate_limit(repeat('a',64),1)"),
    );
    await db.query("UPDATE public.mt_profiles SET role='admin' WHERE id=$1", [alice]);
    await asUser(alice, 'DELETE FROM public.mt_places WHERE id=1');
    assert.equal((await asUser(alice, 'SELECT * FROM public.mt_saved_places')).length, 0);
    await db.exec(await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8'));
    assert.equal(
      (await db.query('SELECT * FROM public.mt_places WHERE id=1')).rows.length,
      0,
      'setup must not resurrect deleted records',
    );
    await db.query('DELETE FROM auth.users WHERE id=$1', [bob]);
    assert.equal(
      (await db.query('SELECT * FROM public.mt_profiles WHERE id=$1', [bob])).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test('The sign-in lookup tells password, Google-only and unknown addresses apart, for the server only', async () => {
  const db = await testDatabase();
  await db.query(
    'INSERT INTO auth.users(id,email,encrypted_password) VALUES($1,$2,$3),($4,$5,$6)',
    [alice, 'Alice@Example.test', '$2a$10$hash', bob, 'bob@example.test', ''],
  );
  const lookup = async (email: string) =>
    (await db.query<{ m: string | null }>('SELECT public.mt_account_sign_in($1) AS m', [email]))
      .rows[0].m;
  assert.equal(await lookup('alice@example.TEST'), 'password');
  assert.equal(await lookup('bob@example.test'), 'google');
  assert.equal(await lookup('nobody@example.test'), null);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(lookup('alice@example.test'), /permission denied/);
    await db.exec('RESET ROLE');
  }
  await db.close();
});
