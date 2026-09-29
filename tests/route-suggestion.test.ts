import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestRoute, routeSchedule, travelEstimate } from '../resources/js/lib/route-suggestion';
import type { Place } from '../resources/js/types';
const origin = { lat: 14.6, lng: -61.0 };
const place = (id: number, extra: Partial<Place> = {}): Place => ({
  id,
  name: `Place ${id}`,
  type: 'activity',
  description: 'A place',
  location: 'Martinique',
  ...origin,
  ...extra,
});
test('Route suggestions honor known opening hours, group stops, include lunch and label unknown hours', () => {
  const places = [
    place(1, { openingPeriods: [{ day: 2, opens: 12 * 60, closes: 15 * 60 }] }),
    place(2, { lat: 14.602 }),
    place(3, { lat: 14.604 }),
    place(4, { lat: 14.605, type: 'restaurant' }),
    place(5, { access: 'restricted' }),
    place(6, { lat: 15.9 }),
  ];
  const route = suggestRoute(places, origin, 'drive', 2, 10 * 60);
  assert.ok(!route.some((s) => s.placeId === 5 || s.placeId === 6));
  assert.equal(route[0].placeId, 2);
  const scheduled = route.find((s) => s.placeId === 1);
  if (scheduled)
    assert.ok(scheduled.arrival >= 12 * 60 && scheduled.arrival + scheduled.minutes <= 15 * 60);
  assert.ok(route.find((s) => s.placeId === 4)?.reason.includes('lunchtime'));
  assert.equal(route.find((s) => s.placeId === 2)?.hoursKnown, false);
  assert.ok(route.at(-1)!.arrival + route.at(-1)!.minutes <= 16 * 60);
  assert.ok(
    travelEstimate(origin, { lat: 14.7, lng: -61 }, 'walk') >
      travelEstimate(origin, { lat: 14.7, lng: -61 }, 'drive'),
  );
  const manual = routeSchedule([{ placeId: 1, minutes: 60 }], places, origin, 'walk', 2, 8 * 60);
  assert.equal(manual[0].closed, true, 'editing a route must surface an hours conflict');
});
