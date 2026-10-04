import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { startLaravel } from './support/laravel';

test('the place list is light, and one place still comes with its details and sources', async () => {
  const app = await startLaravel();
  try {
    const get = async (path: string) => (await fetch(`${app.origin}/api${path}`)).text();
    const list = JSON.parse(await get('/places')) as Record<string, unknown>[];
    const full = JSON.parse(await get('/places?full=1')) as Record<string, unknown>[];
    assert.equal(list.length, full.length);
    assert.ok(list.length > 300);
    assert.ok(list.every((place) => !('details' in place) && !('sources' in place)));
    assert.ok(full.some((place) => 'details' in place));

    // What the cards, the map and the planner read is all still there.
    const sample = list.find((place) => place.openingPeriods) as Record<string, unknown>;
    for (const key of [
      'name',
      'lat',
      'lng',
      'location',
      'description',
      'descriptionFr',
      'tags',
      'openingPeriods',
    ])
      assert.ok(key in sample, key);

    // The page for one place has the rest.
    const withDetails = full.find((place) => 'details' in place) as { id: number };
    const one = JSON.parse(await get(`/places/${withDetails.id}`));
    assert.deepEqual(one.details, (withDetails as Record<string, unknown>).details);
    assert.ok(Array.isArray(one.sources));

    // The point of it: a smaller first download. Compression already squeezes the repetitive details well, so the
    // saving is bigger in memory and in the device cache (raw text) than on the wire (gzip).
    const [light, heavy] = [await get('/places'), await get('/places?full=1')];
    assert.ok(light.length < heavy.length * 0.5, `raw ${light.length} against ${heavy.length}`);
    assert.ok(
      gzipSync(light).length < gzipSync(heavy).length * 0.75,
      `gzip ${gzipSync(light).length} against ${gzipSync(heavy).length}`,
    );
    assert.equal((await fetch(`${app.origin}/api/places/999999`)).status, 404);
  } finally {
    await app.close();
  }
});
