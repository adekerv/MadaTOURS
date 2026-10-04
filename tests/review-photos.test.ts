import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { startLaravel } from './support/laravel';

type Who = 'alice' | 'bob' | 'admin' | 'guest';
// A real JPEG made by PHP's own image library, so the server's cleaning step runs on genuine data.
const jpeg = () =>
  execFileSync(
    'php',
    [
      '-r',
      'ob_start(); imagejpeg(imagecreatetruecolor(40, 30)); echo base64_encode(ob_get_clean());',
    ],
    { encoding: 'utf8' },
  );

test('Review photos: reviews stay public, their photos reach only signed-in people, in the API and in the database', async () => {
  const app = await startLaravel();
  const base = `${app.origin}/api`;
  const jar: Record<Who, string> = { alice: '', bob: '', admin: '', guest: '' };
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
    return { status: res.status, raw, body: raw ? JSON.parse(raw) : null };
  };
  const rows = async (sql: string, params: unknown[] = []) =>
    (await app.db.query<Record<string, unknown>>(sql, params)).rows;
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
  try {
    const register = async (name: string, who: Who) =>
      (
        await call(
          '/auth/register',
          'POST',
          { name, email: `${name.toLowerCase()}@example.test`, password: 'long test password' },
          who,
        )
      ).body.user;
    const alice = await register('Alice', 'alice');
    const bob = await register('Bob', 'bob');
    await register('Admin', 'admin');
    await app.fixture.grantAdmin('admin@example.test');
    const placeId = Number(
      (await rows('SELECT id FROM mt_places WHERE published ORDER BY id LIMIT 1'))[0].id,
    );
    const photo = jpeg();

    // Alice reviews a place and attaches a photo.
    const review = await call(
      '/community/review',
      'POST',
      { placeId, rating: 5, body: 'A lovely afternoon, with great views.' },
      'alice',
    );
    assert.equal(review.status, 200);
    const reviewId = review.body.id as number;
    const added = await call(`/reviews/${reviewId}/photos`, 'POST', { photo }, 'alice');
    assert.equal(added.status, 201);
    assert.equal(added.body.photo.reviewId, reviewId);
    const photoId = added.body.photo.id as string;

    // Signed-in people see it, through a short-lived link to a private file.
    for (const who of ['alice', 'bob'] as const) {
      const listed = await call(`/places/${placeId}/review-photos`, 'GET', undefined, who);
      assert.equal(listed.status, 200);
      assert.deepEqual(
        listed.body.photos.map((p: { id: string }) => p.id),
        [photoId],
      );
      const file = await fetch(listed.body.photos[0].url);
      assert.equal(file.status, 200);
      assert.equal(file.headers.get('content-type'), 'image/jpeg');
    }

    // Guests read the review but are given nothing about its photos: no link, id, count or hint.
    const guestFeed = await call(`/places/${placeId}/community`);
    assert.equal(guestFeed.status, 200);
    assert.equal(guestFeed.body.reviews[0].body, 'A lovely afternoon, with great views.');
    assert.doesNotMatch(guestFeed.raw, /photo|\.jpg|token=|storage|signed|image/i);
    assert.equal((await call(`/places/${placeId}/review-photos`)).status, 401);
    assert.equal((await call(`/reviews/${reviewId}/photos`, 'POST', { photo })).status, 401);
    assert.equal((await call(`/review-photos/${photoId}`, 'DELETE')).status, 401);
    // Even a guest holding a real, valid link to the API's other photo route gets nothing from the API.
    assert.equal(
      (await call(`/places/${placeId}/review-photos?offset=0`, 'GET', undefined, 'guest')).status,
      401,
    );

    // The database itself refuses guests, not just the API.
    await as('anon', '', async () => {
      await assert.rejects(app.db.query('SELECT * FROM mt_review_photos'), /permission denied/);
      await assert.rejects(
        app.db.query('SELECT mt_place_review_photos($1,0)', [placeId]),
        /permission denied/,
      );
      const feed = await app.db.query<{ f: unknown }>('SELECT mt_place_community($1,0) AS f', [
        placeId,
      ]);
      assert.doesNotMatch(JSON.stringify(feed.rows[0].f), /photo|path|\.jpg/i);
    });
    await as('authenticated', bob.id, async () => {
      assert.equal((await app.db.query('SELECT * FROM mt_review_photos')).rows.length, 1);
      const result = await app.db.query<{ f: { id: string }[] }>(
        'SELECT mt_place_review_photos($1,0) AS f',
        [placeId],
      );
      assert.equal(result.rows[0].f[0].id, photoId);
      await assert.rejects(
        app.db.query('UPDATE mt_review_photos SET path=path'),
        /permission denied/,
      );
      await assert.rejects(app.db.query('DELETE FROM mt_review_photos'), /permission denied/);
    });
    await as('authenticated', '', async () => {
      await assert.rejects(
        app.db.query('SELECT mt_place_review_photos($1,0)', [placeId]),
        /Sign in to see photos/,
      );
    });

    // Only the author can attach photos to a review, and removing needs the author or an administrator.
    assert.equal((await call(`/reviews/${reviewId}/photos`, 'POST', { photo }, 'bob')).status, 404);
    assert.equal((await call(`/review-photos/${photoId}`, 'DELETE', undefined, 'bob')).status, 403);
    await assert.rejects(
      app.db.query(
        'INSERT INTO mt_review_photos(id,review_id,user_id,path) VALUES(gen_random_uuid(),$1,$2,$3)',
        [reviewId, bob.id, `${bob.id}/00000000-0000-4000-8000-000000000001.jpg`],
      ),
      /your own review/,
    );

    // Three photos at most, in the API and, as a backstop, in the database.
    assert.equal(
      (await call(`/reviews/${reviewId}/photos`, 'POST', { photo }, 'alice')).status,
      201,
    );
    assert.equal(
      (await call(`/reviews/${reviewId}/photos`, 'POST', { photo }, 'alice')).status,
      201,
    );
    assert.equal(
      (await call(`/reviews/${reviewId}/photos`, 'POST', { photo }, 'alice')).status,
      422,
    );
    await assert.rejects(
      app.db.query(
        'INSERT INTO mt_review_photos(id,review_id,user_id,path) VALUES(gen_random_uuid(),$1,$2,$3)',
        [reviewId, alice.id, `${alice.id}/00000000-0000-4000-8000-000000000002.jpg`],
      ),
      /up to 3 photos/,
    );
    assert.equal(
      (await call(`/places/${placeId}/review-photos`, 'GET', undefined, 'bob')).body.photos.length,
      3,
    );

    // Removing a photo makes its link stop working.
    const before = (await call(`/places/${placeId}/review-photos`, 'GET', undefined, 'alice')).body
      .photos as { id: string; url: string }[];
    assert.equal(
      (await call(`/review-photos/${before[0].id}`, 'DELETE', undefined, 'alice')).status,
      200,
    );
    assert.equal(
      (await call(`/review-photos/${before[0].id}`, 'DELETE', undefined, 'alice')).status,
      404,
    );
    assert.notEqual((await fetch(before[0].url)).status, 200);
    // An administrator can take down any photo, since reviews go live without waiting for approval.
    assert.equal(
      (await call(`/review-photos/${before[1].id}`, 'DELETE', undefined, 'admin')).status,
      200,
    );
    assert.equal(Number((await rows('SELECT count(*) AS n FROM mt_review_photos'))[0].n), 1);

    // Deleting the review removes the photo and queues its file; deleting an account does the same for all of it.
    const paths = (await rows('SELECT path FROM mt_review_photos')).map((r) => r.path);
    assert.equal(
      (await call('/community/delete-review', 'POST', { id: reviewId }, 'alice')).status,
      200,
    );
    assert.equal(Number((await rows('SELECT count(*) AS n FROM mt_review_photos'))[0].n), 0);
    assert.deepEqual(
      (await rows('SELECT path FROM mt_photo_deletions')).map((r) => r.path),
      paths,
    );
    const bobReview = await call(
      '/community/review',
      'POST',
      { placeId, rating: 4, body: 'Pleasant, and easy to find.' },
      'bob',
    );
    assert.equal(
      (await call(`/reviews/${bobReview.body.id}/photos`, 'POST', { photo }, 'bob')).status,
      201,
    );
    assert.equal(
      (
        await call(
          '/account',
          'DELETE',
          { password: 'long test password', confirmation: bob.email },
          'bob',
        )
      ).status,
      200,
    );
    assert.equal(
      Number(
        (await rows('SELECT count(*) AS n FROM mt_review_photos WHERE user_id=$1', [bob.id]))[0].n,
      ),
      0,
    );
    assert.equal(
      (await rows('SELECT path FROM mt_photo_deletions WHERE path LIKE $1', [`${bob.id}/%`]))
        .length,
      0,
      'the account cleanup removed the files too',
    );
  } finally {
    await app.close();
  }
});
