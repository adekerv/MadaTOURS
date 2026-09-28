import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeTrip, tripSummary, type DayTrip } from '../resources/js/lib/trips';
import { readExploreRoute, exploreHash } from '../resources/js/lib/explore-route';
import { cacheCatalogue, readCatalogue } from '../resources/js/lib/catalogue-cache';
import {
  rememberSearch,
  recentSearches,
  clearSearches,
} from '../resources/js/lib/local-preferences';
import { normalizePlace } from '../resources/js/lib/places-utils';
import { batchSchema, planImport } from '../scripts/lib/catalogue-import';
import changes from '../supabase/catalogue/2026-09-28.json';
import seed from '../database/data/places.json';

const places = [14.4, 14.5, 14.6, 14.7].map((lat, index) => ({
  ...normalizePlace(seed[0]),
  id: index + 1,
  lat,
  lng: -61,
}));
const trip: DayTrip = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Coast',
  date: '',
  notes: '',
  updatedAt: '2026-09-28T12:00:00Z',
  stops: [
    { placeId: 1, minutes: 30 },
    { placeId: 4, minutes: 90 },
    { placeId: 2, minutes: 45 },
    { placeId: 3, minutes: 60 },
  ],
};
test('route optimization keeps the first stop and durations, shortens distance, and leaves input unchanged', () => {
  const next = optimizeTrip(trip, places);
  assert.deepEqual(
    next.stops.map((s) => s.placeId),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    next.stops.map((s) => s.minutes),
    [30, 45, 60, 90],
  );
  assert.deepEqual(
    trip.stops.map((s) => s.placeId),
    [1, 4, 2, 3],
  );
  assert.ok(tripSummary(next, places).distance < tripSummary(trip, places).distance);
  assert.equal(optimizeTrip(next, places), next);
  assert.equal(optimizeTrip(trip, places.slice(0, 3)), trip);
  const summary = tripSummary(next, places);
  assert.equal(summary.minutes, 225);
  assert.ok(summary.travelMinutes > 0);
  assert.equal(summary.totalMinutes, 225 + summary.travelMinutes);
  assert.equal(tripSummary(trip, places.slice(0, 2)).missing, true);
});
test('existing Explore links survive and new filter state round-trips without sharing location', () => {
  const old = readExploreRoute('#explore?filter=activity&radius=50&place=6')!;
  assert.equal(old.selectedPlaceId, 6);
  assert.equal(old.filter, 'activity');
  const next = {
    ...old,
    query: 'plage & jardin',
    town: 'Schœlcher',
    experience: 'food',
    sortBy: 'rating' as const,
  };
  assert.deepEqual(readExploreRoute(exploreHash(next)), next);
  assert.equal(readExploreRoute('#explorer'), null);
  assert.equal(readExploreRoute('#explore?radius=999&place=-5')?.radius, 100);
});
test('device cache and recent searches tolerate corrupt and unavailable storage', () => {
  const items = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key),
    },
  });
  try {
    cacheCatalogue(places);
    assert.equal(readCatalogue()?.length, places.length);
    rememberSearch(' Balata ');
    rememberSearch('balata');
    assert.deepEqual(recentSearches(), ['balata']);
    for (const value of ['a', 'b', 'c', 'd', 'e', 'f']) rememberSearch(value);
    assert.deepEqual(recentSearches(), ['f', 'e', 'd', 'c', 'b']);
    clearSearches();
    assert.deepEqual(recentSearches(), []);
    items.set('madatours:catalogue:v1', '{broken');
    assert.equal(readCatalogue(), null);
    items.set(
      'madatours:catalogue:v1',
      JSON.stringify({ version: 1, places: [{ id: 1, lat: 'oops' }] }),
    );
    assert.equal(readCatalogue(), null);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('disabled');
      },
    });
    assert.doesNotThrow(() => cacheCatalogue(places));
    assert.equal(readCatalogue(), null);
    assert.deepEqual(rememberSearch('Balata'), ['Balata']);
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
test('reviewed description corrections are repeatable and never overwrite a newer edit', () => {
  const batch = batchSchema.parse(changes);
  const before = batch.updates.map((update) => ({
    id: update.id,
    name: update.name,
    ...update.before,
  }));
  assert.equal(planImport(batch, before, {}).updates.length, 6);
  assert.equal(planImport(batch, seed, {}).updates.length, 0);
  assert.throws(
    () =>
      planImport(
        batch,
        before.map((row, index) => (index ? row : { ...row, description: 'New editorial copy' })),
        {},
      ),
    /changed/,
  );
});
