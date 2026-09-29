import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './support/database';
const alice = '00000000-0000-4000-8000-000000000011';
const bob = '00000000-0000-4000-8000-000000000012';
test('Community RPCs enforce ownership, moderation, one daily check-in and account deletion', async () => {
  const db = await testDatabase();
  async function asUser(id: string, sql: string, args: unknown[] = []) {
    await db.exec('BEGIN');
    try {
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [id]);
      await db.exec('SET LOCAL ROLE authenticated');
      const result = await db.query(sql, args);
      await db.exec('COMMIT');
      return result.rows;
    } catch (e) {
      await db.exec('ROLLBACK');
      throw e;
    }
  }
  const write = (id: string, action: string, payload: unknown) =>
    asUser(id, 'SELECT public.mt_community_write($1,$2::jsonb)', [action, JSON.stringify(payload)]);
  try {
    await db.query(
      'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3),($4,$5,$6)',
      [
        alice,
        'alice@example.test',
        '{"display_name":"Alice"}',
        bob,
        'bob@example.test',
        '{"display_name":"Bob"}',
      ],
    );
    await write(alice, 'review', {
      placeId: 1,
      rating: 5,
      body: 'A beautiful afternoon by the coast.',
    });
    await write(alice, 'review', {
      placeId: 1,
      rating: 4,
      body: 'Updated after a second visit to this place.',
    });
    await write(bob, 'review', {
      placeId: 1,
      rating: 2,
      body: 'There was a long wait during my visit.',
    });
    assert.equal((await db.query('SELECT * FROM mt_reviews')).rows.length, 2);
    assert.equal(
      Number(
        (
          await db.query<{ community_rating: string }>(
            'SELECT community_rating FROM mt_places WHERE id=1',
          )
        ).rows[0].community_rating,
      ),
      3,
    );
    await assert.rejects(() =>
      write(alice, 'review', {
        placeId: 1,
        rating: 6,
        body: 'A score outside the permitted range.',
      }),
    );
    await assert.rejects(() =>
      asUser(
        alice,
        `INSERT INTO mt_reviews(user_id,place_id,rating,body) VALUES('${bob}',2,5,'A forged review attributed to Bob.')`,
      ),
    );
    await write(alice, 'checkin', { placeId: 1 });
    await write(alice, 'checkin', { placeId: 1 });
    assert.equal((await db.query('SELECT * FROM mt_checkins')).rows.length, 1);
    const feed = (
      await db.query<{ feed: { reviews: { display_name: string; visits: number }[] } }>(
        'SELECT mt_place_community(1) AS feed',
      )
    ).rows[0].feed;
    assert.equal(feed.reviews.find((r) => r.display_name === 'Alice')?.visits, 1);
    await assert.rejects(() =>
      write(alice, 'block-comments', { userId: bob, reason: 'Attempted unauthorized moderation' }),
    );
    await db.query("UPDATE mt_profiles SET role='admin' WHERE id=$1", [bob]);
    await write(bob, 'block-comments', { userId: alice, reason: 'Repeated spam reports' });
    await assert.rejects(() => write(alice, 'comment', { placeId: 1, body: 'Blocked comment' }));
    const reviewId = (
      await db.query<{ id: number }>('SELECT id FROM mt_reviews WHERE user_id=$1', [alice])
    ).rows[0].id;
    await write(bob, 'moderate-review', {
      id: reviewId,
      rating: 4,
      body: 'Moderated review with personal information removed.',
    });
    assert.equal(
      (
        await db.query<{ moderated: boolean }>('SELECT moderated FROM mt_reviews WHERE id=$1', [
          reviewId,
        ])
      ).rows[0].moderated,
      true,
    );
    await db.query('DELETE FROM auth.users WHERE id=$1', [alice]);
    assert.equal((await db.query('SELECT * FROM mt_checkins')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM mt_comment_blocks')).rows.length, 0);
    assert.equal(
      Number(
        (
          await db.query<{ community_rating: string }>(
            'SELECT community_rating FROM mt_places WHERE id=1',
          )
        ).rows[0].community_rating,
      ),
      2,
    );
    for (let n = 0; n < 14; n++)
      await write(bob, 'comment', { placeId: 1, body: 'Repeated test comment' });
    await assert.rejects(async () => {
      for (let n = 0; n < 10; n++)
        await write(bob, 'comment', { placeId: 1, body: 'Rate limited comment' });
    }, /Too many attempts/);
  } finally {
    await db.close();
  }
});
