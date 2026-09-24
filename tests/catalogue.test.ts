import { test } from 'node:test';
import assert from 'node:assert/strict';
import raw from '../supabase/catalogue/2026-09-24.json';
import { batchSchema, planImport } from '../scripts/lib/catalogue-import';
import { catalogueTown, experiences, matchesExperience } from '../src/lib/catalogue';
import { normalizePlace, matchesSearch } from '../src/lib/places-utils';
import { french } from '../src/i18n/fr';
import seed from '../src/data/places.json';

const batch = batchSchema.parse(raw);
test('reviewed batch is bilingual, source-backed, deduplicated, and covered by experience filters', () => {
  assert.equal(
    new Set(batch.additions.map((place) => place.name.toLowerCase())).size,
    batch.additions.length,
  );
  for (const [index, row] of batch.additions.entries()) {
    const place = normalizePlace({ ...row, id: index + 1 });
    assert.ok(place.sources?.every((source) => source.checkedAt === batch.checkedAt));
    assert.ok(
      experiences.some((group) => matchesExperience(place, group.id)),
      place.name,
    );
    assert.ok(
      row.tags.every((tag) => french[tag]),
      `${place.name}: untranslated tag`,
    );
    assert.equal(row.rating, undefined);
    assert.equal(row.hours, undefined);
    assert.equal(row.image, undefined);
    assert.notDeepEqual(
      [row.lat, row.lng],
      [14.641528, -61.024174],
      'Generic island-centre placeholder',
    );
  }
  for (const experience of experiences) assert.ok(french[experience.label]);
  assert.equal(planImport(batch, [], {}).additions.length, batch.additions.length);
  for (const name of ['Habitation La Salle', 'Musee Du Pere Pinchon', 'Rando/Training/Brunch']) {
    assert.equal(seed.find((place) => place.name === name)?.published, false, name);
  }
});
test('imports resume without duplicate inserts and preserve deleted listings and edited coordinates', () => {
  const first = batch.additions[0];
  const row = { ...first, id: 100 };
  const small = { ...batch, additions: [first], updates: [] };
  assert.equal(planImport(small, [row], {}).additions.length, 0);
  assert.equal(planImport(small, [], { [first.sources[0].url]: 100 }).additions.length, 0);
  assert.throws(() => planImport(small, [{ ...row, sources: [] }], {}), /manual review/);
  assert.throws(() => planImport({ ...small, additions: [first, first] }, [], {}), /Duplicate/);
  const correction = batch.updates[0];
  const before = { id: correction.id, name: correction.name, ...correction.before };
  const corrections = { ...small, additions: [], updates: [correction] };
  assert.equal(planImport(corrections, [before], {}).updates.length, 1);
  assert.equal(planImport(corrections, [{ ...before, ...correction.after }], {}).updates.length, 0);
  assert.throws(() => planImport(corrections, [{ ...before, lat: 14.7 }], {}), /changed/);
});
test('experience and bilingual description search find relevant places without requiring tags', () => {
  assert.equal(catalogueTown('Tartane'), 'La Trinité');
  assert.equal(catalogueTown("Les Anses-d'Arlet"), catalogueTown('Les Anses-d’Arlet'));
  const restaurant = normalizePlace({
    ...batch.additions.find((row) => row.type === 'restaurant'),
    id: 1,
  });
  assert.ok(matchesExperience(restaurant, 'food'));
  assert.equal(matchesExperience(restaurant, 'unknown'), false);
  assert.ok(
    matchesSearch(
      {
        ...restaurant,
        tags: [],
        description: 'Lebanese family cooking',
        descriptionFr: 'Cuisine libanaise familiale',
      },
      'lebanese',
    ),
  );
  assert.ok(
    matchesSearch(
      { ...restaurant, tags: [], descriptionFr: 'Cuisine libanaise familiale' },
      'libanaise',
    ),
  );
});
