import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bearing,
  formatClock,
  formatStart,
  parseClock,
  tripRoute,
} from '../resources/js/lib/trip-route';
import {
  moveStop,
  optimizeTrip,
  tripSchema,
  tripsSchema,
  tripSummary,
  type DayTrip,
} from '../resources/js/lib/trips';
import type { Place } from '../resources/js/types';

const place = (id: number, lat: number, lng: number): Place => ({
  id,
  name: `Place ${id}`,
  type: 'activity',
  description: 'A place',
  location: 'Martinique',
  lat,
  lng,
});
// A is close to C and about 11 km from B, so the nearest-stop order from A is A, C, B.
const places = [place(1, 14.6, -61.0), place(2, 14.6, -60.9), place(3, 14.61, -61.0)];
const trip = (placeIds: number[], extra: Partial<DayTrip> = {}): DayTrip => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Day',
  date: '',
  notes: '',
  stops: placeIds.map((placeId) => ({ placeId, minutes: 60 })),
  updatedAt: '2026-10-03T10:00:00.000Z',
  ...extra,
});
const order = (route: ReturnType<typeof tripRoute>) => route.points.map((p) => p.place.id);

test('the route follows the trip order and changes when stops are moved or optimised', () => {
  const planned = trip([1, 2, 3]);
  const route = tripRoute(planned, places);
  assert.deepEqual(order(route), [1, 2, 3]);
  assert.deepEqual(
    route.points.map((p) => p.order),
    [1, 2, 3],
  );
  assert.deepEqual(
    route.legs.map((leg) => [leg.from.place.id, leg.to.place.id]),
    [
      [1, 2],
      [2, 3],
    ],
  );
  assert.deepEqual(order(tripRoute(moveStop(planned, 2, -1), places)), [1, 3, 2]);
  assert.deepEqual(order(tripRoute(moveStop(planned, 0, 1), places)), [2, 1, 3]);
  const optimised = tripRoute(optimizeTrip(planned, places), places);
  assert.deepEqual(order(optimised), [1, 3, 2]);
  assert.deepEqual(
    optimised.points.map((p) => p.order),
    [1, 2, 3],
    'numbers follow the new list order',
  );
  assert.ok(
    optimised.legs.reduce((km, leg) => km + leg.km, 0) <
      route.legs.reduce((km, leg) => km + leg.km, 0),
  );
});

test('an unlisted place keeps its number, is left off the map and breaks the line', () => {
  const route = tripRoute(trip([1, 999, 3, 2]), places);
  assert.deepEqual(order(route), [1, 3, 2]);
  assert.deepEqual(
    route.points.map((p) => p.order),
    [1, 3, 4],
    'the list still counts the unlisted stop as number 2',
  );
  assert.equal(route.missing, true);
  assert.deepEqual(
    route.legs.map((leg) => [leg.from.place.id, leg.to.place.id]),
    [[3, 2]],
    'stop 1 is not joined to stop 3 across the unlisted place',
  );
  assert.deepEqual(tripRoute(trip([]), places).points, []);
  assert.equal(tripRoute(trip([]), places).finish, null);
});

test('one stop has no legs, and times need a start time', () => {
  const single = tripRoute(trip([1]), places);
  assert.equal(single.points.length, 1);
  assert.deepEqual(single.legs, []);
  const untimed = tripRoute(trip([1, 2]), places);
  assert.equal(untimed.start, null);
  assert.equal(untimed.finish, null);
  assert.deepEqual(
    untimed.points.map((p) => [p.arrive, p.leave]),
    [
      [null, null],
      [null, null],
    ],
  );
});

test('arrival times add visits and travel, and the finish matches the planner summary', () => {
  const planned = trip([1, 2, 3], { startTime: '09:00' });
  const route = tripRoute(planned, places);
  const [first, second, third] = route.points;
  assert.equal(first.arrive, 9 * 60, 'the first stop starts when the trip starts');
  assert.equal(first.leave, 10 * 60);
  assert.ok(second.arrive! > first.leave!, 'travel takes time between stops');
  assert.ok(third.arrive! >= second.leave!);
  assert.equal(second.leave! - second.arrive!, 60);
  const summary = tripSummary(planned, places);
  assert.equal(route.finish, 9 * 60 + summary.totalMinutes);
  assert.equal(third.leave, route.finish);
  // With an unlisted stop in the middle, the same equality holds: it keeps its visit time, not its travel.
  const withGap = trip([1, 999, 2], { startTime: '09:00' });
  assert.equal(
    tripRoute(withGap, places).finish,
    9 * 60 + tripSummary(withGap, places).totalMinutes,
  );
  // Moving a stop changes the times, because travel between different places differs.
  assert.notEqual(tripRoute(moveStop(planned, 2, -1), places).finish, route.finish);
});

test('clock helpers read, write and wrap past midnight', () => {
  assert.equal(parseClock('00:00'), 0);
  assert.equal(parseClock('09:05'), 545);
  assert.equal(parseClock('23:59'), 1439);
  for (const bad of ['24:00', '9:30', '09:60', '09:00:00', '', undefined])
    assert.equal(parseClock(bad), null);
  assert.deepEqual(formatClock(545), { time: '09:05', nextDay: false });
  assert.deepEqual(formatClock(1500), { time: '01:00', nextDay: true });
  const late = tripRoute(trip([1, 2], { startTime: '22:30' }), places);
  assert.equal(formatClock(late.finish!).nextDay, true);
  assert.equal(formatClock(late.points[0].arrive!).nextDay, false);
});

test('bearings point from one stop to the next', () => {
  const origin = { lat: 14.6, lng: -61 };
  assert.ok(Math.abs(bearing(origin, { lat: 14.7, lng: -61 }) - 0) < 0.5);
  assert.ok(Math.abs(bearing(origin, { lat: 14.6, lng: -60.9 }) - 90) < 0.5);
  assert.ok(Math.abs(bearing(origin, { lat: 14.5, lng: -61 }) - 180) < 0.5);
  assert.ok(Math.abs(bearing(origin, { lat: 14.6, lng: -61.1 }) - 270) < 0.5);
});

test('the start is written in the reader language and ignores an invalid time', () => {
  const english = formatStart('2026-10-04', '09:00', 'en')!;
  assert.match(english, /Sun/);
  assert.match(english, /4/);
  assert.match(english, /09:00$/);
  assert.match(formatStart('2026-10-04', '09:00', 'fr')!, /dim/i);
  assert.equal(formatStart('', '09:00', 'en'), '09:00');
  assert.match(formatStart('2026-10-04', undefined, 'en')!, /Sun/);
  assert.equal(formatStart('2026-10-04', '25:00', 'en')?.includes('25:00'), false);
  assert.equal(formatStart('', undefined, 'en'), null);
});

test('start times are validated and older saved trips without one still load', () => {
  const saved = trip([1, 2]);
  assert.equal(tripSchema.safeParse(saved).success, true);
  assert.equal(tripSchema.parse(saved).startTime, undefined);
  for (const good of ['00:00', '09:30', '23:59'])
    assert.equal(tripSchema.safeParse({ ...saved, startTime: good }).success, true, good);
  for (const bad of ['24:00', '9:30', '09:60', '09:00:00', 'soon', ''])
    assert.equal(tripSchema.safeParse({ ...saved, startTime: bad }).success, false, bad);
  const stored = JSON.parse(
    JSON.stringify({ version: 1, trips: [{ ...saved, startTime: '08:15' }] }),
  );
  assert.equal(tripsSchema.parse(stored).trips[0].startTime, '08:15');
});
