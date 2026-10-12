import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import seed from '../database/data/places.json';
import subjects from '../resources/content/photo-subjects.json';
import { photoLibrary, placeholderFor } from '../resources/js/lib/placeholders';
import { photoCreditSchema } from '../resources/js/lib/content';
import { normalizePlace } from '../resources/js/lib/places-utils';
import { creditsPath, formattedCredits, libraryFiles } from '../scripts/photo-library';

const places = seed.map((row) => normalizePlace(row));
const byId = (id: number) => places.find((place) => place.id === id)!;
const subjectOf = (id: number) => placeholderFor(byId(id)).key;
const md5 = (path: string) => createHash('md5').update(readFileSync(path)).digest('hex');
const draft = (fields: Record<string, unknown>) =>
  normalizePlace({ id: 9001, lat: 14.6, lng: -61, location: 'Le Robert', ...fields });

test('every published place shows an existing library file or an icon tile', () => {
  const published = places.filter((place, index) => seed[index].published !== false);

  const shown = published.map((place) => [place, placeholderFor(place)] as const);

  assert.equal(published.length, 354);
  for (const [place, image] of shown) {
    assert.equal(subjects[String(place.id) as keyof typeof subjects], image.key, place.name);
    if (image.src) assert.ok(existsSync(`public${image.src}`), `${place.name}: ${image.src}`);
    else assert.ok(image.emoji && image.color && image.label.en && image.label.fr, place.name);
  }
});

test('places from the photo audit get their own subject, never another activity or place', () => {
  assert.equal(subjectOf(303), 'surf');
  assert.equal(subjectOf(186), 'diving');
  assert.equal(subjectOf(338), 'yoga');
  assert.equal(subjectOf(341), 'yoga');
  assert.equal(subjectOf(190), 'kitesurf');
  assert.ok(!subjectOf(197).startsWith('beach'));
  assert.equal(subjectOf(323), 'quad');
  assert.equal(subjectOf(185), 'zoo');
  assert.equal(subjectOf(7), 'restricted');
  // A slavery memorial and a village of the enslaved never show a plantation great-house.
  for (const id of [11, 174]) {
    assert.equal(subjectOf(id), 'heritage');
    assert.equal(placeholderFor(byId(id)).src, undefined);
  }
});

test('a place outside the audit falls back to access, then exact tags, then whole words of its name', () => {
  assert.equal(
    placeholderFor(draft({ name: 'Plongée X', type: 'activity', access: 'restricted' })).key,
    'restricted',
  );
  assert.equal(
    placeholderFor(draft({ name: 'Anse Kite', type: 'activity', tags: ['Kitesurf'] })).key,
    'kitesurf',
  );
  assert.equal(
    placeholderFor(draft({ name: 'Le Ti Bar', type: 'restaurant', tags: ['Sushi', 'Bar'] })).key,
    'sushi',
  );
  assert.equal(placeholderFor(draft({ name: 'Anse Noire', type: 'activity' })).key, 'beach-white');
  // "spa" inside another word, and a restaurant named after a beach, never borrow those subjects.
  assert.equal(
    placeholderFor(draft({ name: 'Espace Découverte', type: 'activity' })).key,
    'activity',
  );
  assert.equal(
    placeholderFor(draft({ name: 'Plage Grill', type: 'restaurant' })).key,
    'restaurant',
  );
});

test('icon-tile subjects never show a photo', () => {
  const tiles = [
    'creole-food',
    'restaurant',
    'heritage',
    'rum',
    'yole',
    'bele',
    'art',
    'bbq-donut',
    'adventure-park',
    'restricted',
  ];

  const shown = places.filter((place) => tiles.includes(placeholderFor(place).key));

  for (const key of tiles) {
    const entry = photoLibrary.find((item) => item.key === key)!;
    assert.equal(entry.kind, 'tile', key);
    assert.deepEqual(entry.files, [], key);
  }
  assert.equal(shown.length, Object.values(subjects).filter((key) => tiles.includes(key)).length);
  assert.ok(shown.every((place) => placeholderFor(place).src === undefined));
});

test('the AI trail image carries its AI credit and consecutive places of one subject get different files', () => {
  const pelee = placeholderFor(byId(5));

  assert.equal(pelee.src, '/assets/placeholders/hiking-ai-v1.jpg');
  assert.equal(pelee.credit?.ai, true);
  for (const entry of photoLibrary.filter((item) => item.files.length > 1)) {
    const tag = { diving: 'Diving', spa: 'Spa' }[entry.key];
    if (!tag) continue;
    const first = placeholderFor(draft({ id: 9001, name: 'A', type: 'activity', tags: [tag] }));
    const next = placeholderFor(draft({ id: 9002, name: 'B', type: 'activity', tags: [tag] }));
    assert.equal(first.key, entry.key);
    assert.notEqual(first.src, next.src, entry.key);
  }
});

test('library files are versioned, credited, within budget and never a copy of a place photo', () => {
  const placePhotos = new Set(
    readdirSync('public/photos')
      .filter((name) => /\.(jpe?g|webp|png)$/.test(name))
      .map((name) => md5(`public/photos/${name}`)),
  );

  const files = libraryFiles();

  assert.ok(files.length > 0);
  for (const file of files) {
    assert.match(file, /^[a-z0-9-]+-v\d+\.(webp|jpg)$/);
    assert.ok(!placePhotos.has(md5(`public/assets/placeholders/${file}`)), file);
  }
  for (const entry of photoLibrary) {
    assert.deepEqual(Object.keys(entry.credits).sort(), [...entry.files].sort(), entry.key);
    for (const [file, credit] of Object.entries(entry.credits)) {
      assert.ok(photoCreditSchema.safeParse(credit).success, `${entry.key}/${file}`);
      assert.ok(credit.basis && credit.retrievedAt && credit.modified, `${entry.key}/${file}`);
      assert.equal(credit.ai === true, credit.basis === 'ai', `${entry.key}/${file}`);
      if (!credit.ai)
        assert.ok(credit.note?.includes('verified'), `${entry.key}/${file}: licence check`);
    }
  }
});

test('every library subject has English and French labels and every audit subject exists', () => {
  const keys = new Set(photoLibrary.map((entry) => entry.key));

  assert.equal(keys.size, photoLibrary.length);
  for (const entry of photoLibrary) {
    assert.ok(entry.labelEn.trim(), entry.key);
    assert.ok(entry.labelFr.trim(), entry.key);
    assert.ok(['photo', 'tile'].includes(entry.kind), entry.key);
  }
  for (const key of Object.values(subjects)) assert.ok(keys.has(key), key);
  assert.ok(keys.has('activity'));
});

test('the committed library credits match the manifest', async () => {
  assert.equal(readFileSync(creditsPath, 'utf8'), await formattedCredits());
});
