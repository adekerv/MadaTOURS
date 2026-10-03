import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './support/database';
test('Closing a place archives and hides it, keeps an audit trail, and reopening restores only what was hidden', async () => {
  const db = await testDatabase();
  try {
    const row = async (id: number) =>
      (
        await db.query<{
          listing_status: string;
          archived: boolean;
          published: boolean;
        }>('SELECT listing_status,archived,published FROM mt_places WHERE id=$1', [id])
      ).rows[0];
    assert.deepEqual(await row(1), {
      listing_status: 'active',
      archived: false,
      published: true,
    });
    await db.exec(
      "SELECT mt_set_listing_status(1,'closed','Page says permanently closed.','https://example.test/closed','2026-10-02')",
    );
    assert.deepEqual(await row(1), {
      listing_status: 'closed',
      archived: true,
      published: false,
    });
    assert.equal(
      (await db.query('SELECT 1 FROM mt_places WHERE id=1')).rows.length,
      1,
      'closing never deletes the row',
    );
    await db.exec('SET ROLE anon');
    assert.equal((await db.query('SELECT 1 FROM mt_places WHERE id=1')).rows.length, 0);
    await assert.rejects(() => db.query('SELECT * FROM mt_listing_audits'));
    await assert.rejects(() =>
      db.query("SELECT mt_set_listing_status(2,'closed','x',NULL,'2026-10-02')"),
    );
    await db.exec('RESET ROLE');
    await db.exec(
      "SELECT mt_set_listing_status(1,'active','Reopened per official page.','https://example.test/open','2026-12-01')",
    );
    assert.deepEqual(await row(1), {
      listing_status: 'active',
      archived: false,
      published: true,
    });
    // An editorial draft is not archived, so a status review never publishes it.
    await db.exec(
      "SELECT mt_set_listing_status(12,'needs_review','Link is dead.',NULL,'2026-10-02')",
    );
    const draft = await row(12);
    assert.equal(draft.listing_status, 'needs_review');
    assert.equal(draft.published, false);
    const audits = (
      await db.query<{ from_status: string; to_status: string; evidence_url: string | null }>(
        'SELECT from_status,to_status,evidence_url FROM mt_listing_audits WHERE place_id IN (1,12) ORDER BY id',
      )
    ).rows;
    assert.deepEqual(
      audits.map((a) => `${a.from_status}>${a.to_status}`),
      ['active>closed', 'closed>active', 'active>needs_review'],
    );
    assert.equal(audits[0].evidence_url, 'https://example.test/closed');
    await assert.rejects(() =>
      db.query("SELECT mt_set_listing_status(1,'gone','x',NULL,'2026-10-02')"),
    );
    await assert.rejects(() => db.exec('UPDATE mt_places SET archived=true WHERE id=2'));
    await assert.rejects(() => db.exec("UPDATE mt_places SET details='[]'::jsonb WHERE id=2"));
    await assert.rejects(() =>
      db.query(
        "SELECT mt_set_listing_status(2,'needs_review','x','http://insecure.test','2026-10-02')",
      ),
    );
  } finally {
    await db.close();
  }
});
