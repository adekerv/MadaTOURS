import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './support/database';
test('Daily community picks require three reviews and ignore guide scores; Google quota is global and private', async () => {
  const db = await testDatabase();
  try {
    await db.exec('UPDATE mt_places SET community_rating=NULL,community_count=0');
    await db.exec('UPDATE mt_places SET community_rating=5,community_count=2 WHERE id=1');
    await db.exec('UPDATE mt_places SET community_rating=4.8,community_count=8 WHERE id=2');
    await db.exec('UPDATE mt_places SET community_rating=4.8,community_count=10 WHERE id=3');
    await db.exec(
      "UPDATE mt_places SET community_rating=5,community_count=20,access='restricted' WHERE id=4",
    );
    await db.exec(
      'UPDATE mt_places SET community_rating=5,community_count=20,published=false WHERE id=5',
    );
    await db.exec('SELECT mt_refresh_daily_picks()');
    assert.deepEqual(
      (
        await db.query<{ place_id: number }>(
          'SELECT place_id FROM mt_daily_picks ORDER BY position',
        )
      ).rows.map((r) => r.place_id),
      [3, 2],
    );
    assert.equal(
      (await db.query<{ ok: boolean }>('SELECT mt_claim_google_request(2) ok')).rows[0].ok,
      true,
    );
    assert.equal(
      (await db.query<{ ok: boolean }>('SELECT mt_claim_google_request(2) ok')).rows[0].ok,
      true,
    );
    assert.equal(
      (await db.query<{ ok: boolean }>('SELECT mt_claim_google_request(2) ok')).rows[0].ok,
      false,
    );
    await db.exec('SET ROLE anon');
    assert.equal((await db.query('SELECT * FROM mt_daily_picks')).rows.length, 2);
    await assert.rejects(() => db.query('SELECT * FROM mt_google_matches'));
    await assert.rejects(() => db.query('SELECT mt_claim_google_request(100)'));
    await assert.rejects(() => db.query('SELECT mt_refresh_daily_picks()'));
    await db.exec('RESET ROLE');
    await db.exec('SELECT mt_queue_google_matches()');
    const count = (await db.query('SELECT * FROM mt_google_matches')).rows.length;
    await db.exec('SELECT mt_queue_google_matches()');
    assert.equal((await db.query('SELECT * FROM mt_google_matches')).rows.length, count);
  } finally {
    await db.close();
  }
});
