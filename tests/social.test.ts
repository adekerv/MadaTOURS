import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './support/database';
const a = '00000000-0000-4000-8000-000000000021',
  b = '00000000-0000-4000-8000-000000000022',
  c = '00000000-0000-4000-8000-000000000023';
test('Private follows, blocked users, verified event applications, capacity and expiry are enforced by Postgres', async () => {
  const db = await testDatabase();
  async function asUser(user: string, query: string, args: unknown[] = []) {
    await db.exec('BEGIN');
    try {
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [user]);
      await db.exec('SET LOCAL ROLE authenticated');
      const rows = (await db.query<Record<string, unknown>>(query, args)).rows;
      await db.exec('COMMIT');
      return rows;
    } catch (e) {
      await db.exec('ROLLBACK');
      throw e;
    }
  }
  const act = (user: string, action: string, payload: object) =>
    asUser(user, 'SELECT mt_social_write($1,$2::jsonb) AS value', [
      action,
      JSON.stringify(payload),
    ]);
  try {
    await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2),($3,$4),($5,$6)', [
      a,
      'a@test.example',
      b,
      'b@test.example',
      c,
      'c@test.example',
    ]);
    await asUser(a, "SELECT mt_community_write('checkin','{\"placeId\":1}')");
    assert.equal((await asUser(b, 'SELECT * FROM mt_activity')).length, 0);
    await act(b, 'follow', { userId: a });
    assert.equal(
      (await asUser(b, 'SELECT * FROM mt_activity')).length,
      0,
      'pending follow reveals nothing',
    );
    await act(a, 'accept-follow', { userId: b });
    assert.equal((await asUser(b, 'SELECT * FROM mt_activity')).length, 1);
    assert.equal((await asUser(c, 'SELECT * FROM mt_activity')).length, 0, 'stranger has no feed');
    await act(a, 'block', { userId: b });
    assert.equal(
      (await asUser(b, 'SELECT * FROM mt_activity')).length,
      0,
      'blocking immediately removes activity access',
    );
    await assert.rejects(() => act(b, 'follow', { userId: a }));
    await act(a, 'unblock', { userId: b });
    const event = (
      await act(a, 'create-event', {
        title: 'Lunch together',
        placeId: 1,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        price: 20,
        capacity: 2,
        description: 'A relaxed lunch for fellow explorers.',
        lifetimeHours: 24,
      })
    )[0].value as { id: number };
    assert.equal(
      (await asUser(b, 'SELECT * FROM mt_events')).length,
      0,
      'unverified users cannot browse',
    );
    await assert.rejects(() => act(b, 'apply', { eventId: event.id }));
    await db.query('UPDATE mt_profiles SET email_verified_at=now() WHERE id IN ($1,$2)', [b, c]);
    assert.equal((await asUser(b, 'SELECT * FROM mt_events')).length, 1);
    await act(b, 'apply', { eventId: event.id });
    await act(c, 'apply', { eventId: event.id });
    await assert.rejects(() => act(c, 'approve', { eventId: event.id, userId: b }));
    await act(a, 'approve', { eventId: event.id, userId: b });
    assert.equal(
      (await asUser(c, 'SELECT * FROM mt_event_applications')).length,
      2,
      'accepted attendee plus own application',
    );
    await assert.rejects(() => act(a, 'approve', { eventId: event.id, userId: c }), /full/);
    await act(b, 'leave-event', { eventId: event.id });
    await act(a, 'approve', { eventId: event.id, userId: c });
    await db.query("UPDATE mt_events SET expires_at=now()-interval '1 second' WHERE id=$1", [
      event.id,
    ]);
    assert.equal(
      (await asUser(b, 'SELECT * FROM mt_events')).length,
      0,
      'expired listing is hidden before cron',
    );
    await assert.rejects(() => act(b, 'apply', { eventId: event.id }));
    assert.equal(
      Number(
        (await db.query<{ count: number }>('SELECT mt_expire_events() AS count')).rows[0].count,
      ),
      1,
    );
    await db.query('DELETE FROM auth.users WHERE id=$1', [a]);
    assert.equal((await db.query('SELECT * FROM mt_events')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM mt_event_applications')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM mt_follows')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM mt_activity')).rows.length, 0);
  } finally {
    await db.close();
  }
});
