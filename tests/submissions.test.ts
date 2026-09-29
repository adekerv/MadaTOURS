import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './support/database';
const owner = '00000000-0000-4000-8000-000000000031',
  admin = '00000000-0000-4000-8000-000000000032',
  photo = '00000000-0000-4000-8000-000000000033';
test('Submissions require an owned upload, bilingual moderation, notifications and deletion cleanup', async () => {
  const db = await testDatabase();
  async function act(user: string, action: string, payload: object) {
    await db.exec('BEGIN');
    try {
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [user]);
      await db.exec('SET LOCAL ROLE authenticated');
      const result = (
        await db.query<{ result: { id: number } }>(
          'SELECT mt_submission_write($1,$2::jsonb) AS result',
          [action, JSON.stringify(payload)],
        )
      ).rows[0].result;
      await db.exec('COMMIT');
      return result;
    } catch (e) {
      await db.exec('ROLLBACK');
      throw e;
    }
  }
  try {
    await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2),($3,$4)', [
      owner,
      'owner@example.test',
      admin,
      'admin@example.test',
    ]);
    await db.query("UPDATE mt_profiles SET role='admin' WHERE id=$1", [admin]);
    const input = {
      photoId: photo,
      photoRights: true,
      name: 'A new cultural stop',
      type: 'cultural',
      lat: 14.6,
      lng: -61.05,
      address: 'A verified address in Fort-de-France',
      description: 'A community-submitted cultural venue with exhibitions to discover.',
      language: 'en',
    };
    await assert.rejects(() => act(owner, 'create', input), /photo required/);
    await db.query('INSERT INTO mt_submission_photos(id,user_id,path) VALUES($1,$2,$3)', [
      photo,
      owner,
      `${owner}/${photo}.jpg`,
    ]);
    await assert.rejects(() => act(admin, 'create', input), /photo required/);
    const submission = await act(owner, 'create', input);
    await assert.rejects(() => act(owner, 'approve', { id: submission.id }), /Administrator/);
    await assert.rejects(
      () => act(admin, 'approve', { id: submission.id, description: input.description }),
      /Both descriptions/,
    );
    await act(admin, 'approve', {
      id: submission.id,
      description: input.description,
      descriptionFr:
        'Un lieu culturel proposé par la communauté, avec des expositions à découvrir.',
      origin: 'https://mada-tours.vercel.app',
    });
    const published = (
      await db.query<{ id: number; image: string; tags: string[] }>(
        'SELECT id,image,tags FROM mt_places WHERE submitted_by=$1',
        [owner],
      )
    ).rows[0];
    assert.ok(published.image.includes(photo));
    assert.deepEqual(published.tags, ['culture']);
    assert.equal(
      (await db.query('SELECT * FROM mt_notifications WHERE user_id=$1', [owner])).rows.length,
      1,
    );
    await assert.rejects(() => act(admin, 'approve', { id: submission.id }), /already reviewed/);
    await db.query('DELETE FROM auth.users WHERE id=$1', [owner]);
    assert.equal((await db.query('SELECT * FROM mt_submissions')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM mt_notifications')).rows.length, 0);
    assert.equal(
      (
        await db.query<{ image: null; submitted_by: null }>(
          'SELECT image,submitted_by FROM mt_places WHERE id=$1',
          [published.id],
        )
      ).rows[0].image,
      null,
    );
    assert.equal((await db.query('SELECT * FROM mt_photo_deletions')).rows.length, 1);
  } finally {
    await db.close();
  }
});
