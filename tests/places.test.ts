import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistance,
  matchesSearch,
  matchesInterest,
  normalizePlace,
} from '../src/lib/places-utils';
import data from '../src/data/places.json';

test('catalogue is valid and uses unique IDs', () => {
  const places = data.map(normalizePlace);
  assert.equal(new Set(places.map((place) => place.id)).size, places.length);
  assert.ok(
    places.every((place) => place.lat > 14 && place.lat < 15 && place.lng > -62 && place.lng < -60),
  );
});
test('distance handles identical points, symmetry, and antipodes without NaN', () => {
  assert.equal(calculateDistance(14, -61, 14, -61), 0);
  assert.equal(calculateDistance(10, 20, 30, 40), calculateDistance(30, 40, 10, 20));
  assert.ok(Math.abs(calculateDistance(0, 0, 0, 1) - 111.195) < 0.01);
  assert.ok(Number.isFinite(calculateDistance(90, 0, -90, 180)));
});
test('search handles accents, case, whitespace, and missing tags', () => {
  assert.ok(matchesSearch(normalizePlace(data[4]), '  pelee  '));
  assert.ok(matchesSearch(normalizePlace(data[12]), 'schoelcher'));
  assert.ok(matchesSearch({ ...normalizePlace(data[0]), tags: undefined }, 'petibonum'));
});
test('hiking filter recognizes Hiking as well as Hike', () => {
  assert.ok(matchesInterest(normalizePlace(data[6]), 'hiking'));
  assert.ok(matchesInterest(normalizePlace(data[12]), 'entertainment'));
  assert.equal(matchesInterest(normalizePlace(data[0]), 'hiking'), false);
});
test('normalization accepts database JSON tags, preserves zero, and rejects invalid coordinates', () => {
  const place = normalizePlace({
    ...data[0],
    tags: '["Seafood"]',
    lat: '0',
    lng: '0',
    distance: 0,
    rating: 0,
  });
  assert.deepEqual(place.tags, ['Seafood']);
  assert.equal(place.distance, 0);
  assert.equal(place.rating, 0);
  assert.throws(() => normalizePlace({ ...data[0], lat: 'broken' }));
});
