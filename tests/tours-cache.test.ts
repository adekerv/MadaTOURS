import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheTours, readTours, type Tour } from '../resources/js/lib/tours';

const tour: Tour = {
  id: 1,
  name: 'South coast',
  nameFr: null,
  description: 'Beaches and a lighthouse.',
  descriptionFr: null,
  published: true,
  stops: [
    { placeId: 1, minutes: 60 },
    { placeId: 2, minutes: 45 },
  ],
  route: {
    geometry: {
      type: 'LineString',
      coordinates: [
        [-61, 14.6],
        [-61.1, 14.7],
      ],
    },
    distanceM: 9000,
    durationS: 800,
  },
  routeSource: 'road',
};
test('the last tours are kept on the device and corrupt or unavailable storage is tolerated', () => {
  const items = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    },
  });
  try {
    assert.equal(readTours(), null);
    cacheTours([tour]);
    assert.deepEqual(readTours(), [tour]);
    // An empty list is a real answer (every tour was unpublished) and replaces the old one.
    cacheTours([]);
    assert.deepEqual(readTours(), []);
    // A record that no longer matches the contract is dropped on its own, not with the whole list.
    items.set(
      'madatours:tours:v1',
      JSON.stringify({ version: 1, tours: [tour, { id: 2, name: 'Broken', stops: 'no' }] }),
    );
    assert.deepEqual(readTours(), [tour]);
    items.set('madatours:tours:v1', '{broken');
    assert.equal(readTours(), null);
    items.set('madatours:tours:v1', JSON.stringify({ version: 2, tours: [tour] }));
    assert.equal(readTours(), null);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('disabled');
      },
    });
    assert.doesNotThrow(() => cacheTours([tour]));
    assert.equal(readTours(), null);
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
