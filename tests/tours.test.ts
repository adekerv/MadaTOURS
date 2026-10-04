import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startLaravel } from './support/laravel';

process.env.MADATOURS_E2E_TOKEN ??= 'tours-test-token';
type Who = 'admin' | 'visitor' | 'guest';
test('Tours: admin-only writes, a road route stored once per change, and straight lines when routing fails', async () => {
  const app = await startLaravel();
  const base = `${app.origin}/api`;
  const jar: Record<Who, string> = { admin: '', visitor: '', guest: '' };
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
  // The routing stand-in lives in the test provider: switch its mode and read what it was asked.
  const routing = async (mode?: string, reset = false) => {
    const res = await fetch(`${app.providerOrigin}/__test/ors`, {
      method: mode ? 'POST' : 'GET',
      headers: {
        'X-Test-Token': process.env.MADATOURS_E2E_TOKEN!,
        'Content-Type': 'application/json',
      },
      body: mode ? JSON.stringify({ mode, reset }) : undefined,
    });
    return (await res.json()) as {
      requests: { authorization?: string; coordinates: [number, number][] }[];
    };
  };
  const sql = async (statement: string, params: unknown[] = []) =>
    (await app.db.query<Record<string, unknown>>(statement, params)).rows;
  try {
    for (const [who, email] of [
      ['admin', 'admin@example.test'],
      ['visitor', 'visitor@example.test'],
    ] as const) {
      const signup = await call(
        '/auth/register',
        'POST',
        { name: who, email, password: 'long test password' },
        who,
      );
      assert.equal(signup.status, 201);
    }
    await app.fixture.grantAdmin('admin@example.test');
    const [first, second, third] = (await call('/places')).body.slice(0, 3) as {
      id: number;
      lat: number;
      lng: number;
    }[];
    const stops = [
      { placeId: first.id, minutes: 60 },
      { placeId: second.id, minutes: 45 },
    ];
    const tour = {
      name: 'South coast loop',
      nameFr: 'Boucle du sud',
      description: 'Two stops with the road between them.',
      published: true,
      stops,
    };

    // Only administrators write; the database refuses anyone else even if the API were bypassed.
    assert.equal((await call('/tours', 'POST', tour)).status, 401);
    assert.equal((await call('/tours', 'POST', tour, 'visitor')).status, 403);
    assert.equal((await call('/moderation/tours', 'GET', undefined, 'visitor')).status, 403);
    assert.equal((await sql('SELECT count(*)::int AS n FROM mt_tours'))[0].n, 0);
    await routing('ok', true);

    // Saving asks for the road once, with longitude first and the key in the header, and stores the line.
    const created = await call('/tours', 'POST', tour, 'admin');
    assert.equal(created.status, 201);
    assert.equal(created.body.routeSource, 'road');
    assert.equal(created.body.route.geometry.type, 'LineString');
    assert.ok(
      created.body.route.geometry.coordinates.length > 2,
      'the road bends between the stops',
    );
    assert.equal(created.body.route.distanceM, 3000);
    const asked = (await routing()).requests;
    assert.equal(asked.length, 1);
    assert.equal(asked[0].authorization, 'test-ors-key');
    assert.deepEqual(asked[0].coordinates, [
      [first.lng, first.lat],
      [second.lng, second.lat],
    ]);
    const stored = (await sql('SELECT route_geojson, route_stops_hash FROM mt_tours'))[0];
    assert.ok(stored.route_stops_hash);
    assert.equal((stored.route_geojson as { type: string }).type, 'LineString');
    const id = created.body.id;

    // Everyone reads published tours with the stored line, and nobody triggers routing by reading.
    const listed = await call('/tours');
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body[0].route.geometry, created.body.route.geometry);
    assert.equal((await routing()).requests.length, 1);

    // Renaming keeps the road without asking again; changing the stops asks once more.
    assert.equal(
      (await call(`/tours/${id}`, 'POST', { ...tour, name: 'Renamed' }, 'admin')).status,
      200,
    );
    assert.equal((await routing()).requests.length, 1);
    const reordered = await call(
      `/tours/${id}`,
      'POST',
      { ...tour, stops: [...stops].reverse() },
      'admin',
    );
    assert.equal(reordered.status, 200);
    assert.equal(reordered.body.routeSource, 'road');
    assert.equal((await routing()).requests.length, 2);

    // A routing outage never blocks saving: the tour is stored and has no road line.
    await routing('fail');
    const withThree = await call(
      `/tours/${id}`,
      'POST',
      { ...tour, stops: [...stops, { placeId: third.id, minutes: 30 }] },
      'admin',
    );
    assert.equal(withThree.status, 200);
    assert.equal(withThree.body.routeSource, 'straight');
    assert.equal(withThree.body.route, null);
    assert.equal(withThree.body.stops.length, 3);
    const outage = await call(
      '/tours',
      'POST',
      { ...tour, name: 'Saved during an outage' },
      'admin',
    );
    assert.equal(outage.status, 201);
    assert.equal(outage.body.routeSource, 'straight');
    // The map then draws straight lines between the stops; recalculating later fills the road in.
    await routing('ok');
    const recalculated = await call(`/tours/${outage.body.id}/route`, 'POST', undefined, 'admin');
    assert.equal(recalculated.body.routeSource, 'road');
    // A malformed answer is no better than an outage.
    await routing('garbage');
    assert.equal(
      (await call(`/tours/${id}/route`, 'POST', undefined, 'admin')).body.routeSource,
      'straight',
    );
    await routing('ok');

    // Drafts stay hidden from the public, but the administrator still sees them.
    const draft = await call(
      '/tours',
      'POST',
      { ...tour, name: 'Hidden draft', published: false },
      'admin',
    );
    assert.equal(draft.status, 201);
    assert.ok(!(await call('/tours')).body.some((t: { id: number }) => t.id === draft.body.id));
    assert.ok(
      (await call('/moderation/tours', 'GET', undefined, 'admin')).body.some(
        (t: { id: number }) => t.id === draft.body.id,
      ),
    );

    // Bad input never reaches routing or the table.
    const before = (await routing()).requests.length;
    for (const bad of [
      { ...tour, stops: [stops[0]] },
      { ...tour, stops: [stops[0], stops[0]] },
      { ...tour, stops: [stops[0], { placeId: 999999, minutes: 30 }] },
      { ...tour, stops: [stops[0], { placeId: second.id, minutes: 1 }] },
    ])
      assert.ok([400, 404, 422].includes((await call('/tours', 'POST', bad, 'admin')).status));
    assert.equal((await routing()).requests.length, before);

    // A place removed later never blocks renaming or unpublishing the tour.
    const doomed = await call('/tours', 'POST', { ...tour, name: 'Soon missing' }, 'admin');
    await app.db.exec(`DELETE FROM mt_tours WHERE id <> ${doomed.body.id}`);
    await app.db.exec(`DELETE FROM mt_places WHERE id=${second.id}`);
    assert.equal(
      (
        await call(
          `/tours/${doomed.body.id}`,
          'POST',
          { ...tour, name: 'Renamed anyway', published: false },
          'admin',
        )
      ).status,
      200,
    );

    // Deleting removes it for good.
    assert.equal(
      (await call(`/tours/${doomed.body.id}`, 'DELETE', undefined, 'visitor')).status,
      403,
    );
    assert.equal(
      (await call(`/tours/${doomed.body.id}`, 'DELETE', undefined, 'admin')).status,
      200,
    );
    assert.equal(
      (await call(`/tours/${doomed.body.id}`, 'DELETE', undefined, 'admin')).status,
      404,
    );
  } finally {
    await app.close();
  }
});
