import { config } from 'dotenv';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { createApp } from '../server/app';
import { adminClient } from '../server/supabase';
config({ path: ['.env.local', '.env'], quiet: true });
if (!process.argv.includes('--run'))
  throw new Error(
    'Use npm run test:live -- --run to create and clean up temporary Supabase test accounts. No emails are sent.',
  );
const admin = adminClient();
const created = new Set<string>();
const password = `Mada-${randomBytes(24).toString('base64url')}-42`;
const replacement = `Mada-${randomBytes(24).toString('base64url')}-43`;
const email = `madatours-test-${randomUUID()}@example.invalid`;
const otherEmail = `madatours-test-${randomUUID()}@example.invalid`;
const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
type Jar = Map<string, string>;
async function request(path: string, jar: Jar, method = 'GET', body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'X-MadaTours-Client': '1',
      'Content-Type': 'application/json',
      Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const cookies = response.headers.getSetCookie();
  for (const cookie of cookies) {
    const pair = cookie.split(';')[0];
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
  return { status: response.status, body: await response.json(), cookies };
}
function ok(result: { status: number }, label: string) {
  assert.equal(result.status, 200, `${label}: HTTP ${result.status}`);
  console.log(`PASS ${label}`);
}
try {
  const a: Jar = new Map(),
    b: Jar = new Map(),
    secondDevice: Jar = new Map();
  ok(await request('/health', a), 'Live database health');
  const catalogue = await request('/places', a);
  ok(catalogue, 'Public catalogue');
  const placeId = catalogue.body[0]?.id;
  assert.ok(placeId, 'At least one public place is required.');
  // Admin-generated verification links produce real Supabase OTPs without sending email.
  const signup = await admin.auth.admin.generateLink({ type: 'signup', email, password });
  assert.ok(!signup.error && signup.data.user, 'Create temporary signup account');
  const userId = signup.data.user.id;
  created.add(userId);
  const verified = await request('/auth/verify', a, 'POST', {
    email,
    token: signup.data.properties.email_otp,
  });
  ok(verified, 'Real Supabase email-code verification (delivery not tested)');
  assert.equal(verified.body.user.id, userId);
  assert.equal(verified.body.user.role, 'user');
  assert.ok(!('session' in verified.body));
  assert.ok(
    verified.cookies.some(
      (c) =>
        c.startsWith('madatours-auth') &&
        /HttpOnly/i.test(c) &&
        /Path=\/api/i.test(c) &&
        /SameSite=Lax/i.test(c),
    ),
    'HttpOnly API-scoped cookie',
  );
  const other = await admin.auth.admin.createUser({
    email: otherEmail,
    password,
    email_confirm: true,
  });
  assert.ok(!other.error && other.data.user, 'Create second temporary account');
  const otherId = other.data.user.id;
  created.add(otherId);
  ok(await request('/auth/login', b, 'POST', { email: otherEmail, password }), 'Second user login');
  ok(await request('/favorites', a, 'POST', { placeId }), 'Save to real Supabase');
  ok(await request('/favorites', a, 'POST', { placeId }), 'Duplicate save remains idempotent');
  ok(
    await request('/auth/login', secondDevice, 'POST', { email, password }),
    'Same account in an independent cookie session',
  );
  const saved = await request('/favorites', secondDevice);
  ok(saved, 'Read saved place in second session');
  assert.equal(saved.body.length, 1);
  assert.equal(saved.body[0].id, placeId);
  const privateSaved = await request('/favorites', b);
  ok(privateSaved, 'Other account reads only its own saved places');
  assert.deepEqual(privateSaved.body, []);
  const direct = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.ok(!(await direct.auth.signInWithPassword({ email: otherEmail, password })).error);
  const forbiddenRead = await direct.from('mt_saved_places').select('*').eq('user_id', userId);
  assert.ok(!forbiddenRead.error);
  assert.deepEqual(forbiddenRead.data, []);
  const forbiddenWrite = await direct
    .from('mt_saved_places')
    .insert({ user_id: userId, place_id: placeId, kind: 'revisits' });
  assert.ok(forbiddenWrite.error);
  const roleWrite = await direct
    .from('mt_profiles')
    .update({ role: 'admin' })
    .eq('id', otherId)
    .select('role');
  assert.ok(roleWrite.error || roleWrite.data?.length === 0);
  console.log('PASS Live RLS blocks cross-user reads/writes and self-promotion');
  await direct.auth.signOut();
  const recovery = await admin.auth.admin.generateLink({ type: 'recovery', email });
  assert.ok(!recovery.error);
  ok(
    await request('/auth/reset-password', new Map(), 'POST', {
      email,
      token: recovery.data.properties.email_otp,
      password: replacement,
    }),
    'Real Supabase recovery code and password update (delivery not tested)',
  );
  assert.notEqual(
    (await request('/auth/login', new Map(), 'POST', { email, password })).status,
    200,
  );
  ok(
    await request('/auth/login', a, 'POST', { email, password: replacement }),
    'Login with replacement password',
  );
  ok(await request('/auth/logout', a, 'POST'), 'Logout');
  assert.equal((await request('/auth/session', a)).body.user, null);
  ok(
    await request('/auth/login', a, 'POST', { email, password: replacement }),
    'Login before account deletion',
  );
  ok(
    await request('/account', a, 'DELETE', { password: replacement }),
    'Password-confirmed account deletion',
  );
  created.delete(userId);
  const rows = await admin.from('mt_saved_places').select('place_id').eq('user_id', userId);
  assert.ok(!rows.error);
  assert.deepEqual(rows.data, []);
  console.log('PASS Deleted account saved rows are removed');
} catch (error) {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : 'Live check failed. Credentials and provider payloads were not logged.',
  );
  process.exitCode = 1;
} finally {
  for (const id of created) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) {
      console.error(
        `Cleanup failed for temporary test account ID ${id}. Remove only this test account in Supabase.`,
      );
      process.exitCode = 1;
    } else console.log('Removed temporary test account.');
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
