import { z } from 'zod';
import type { Place } from '../types';
import { calculateDistance } from './places-utils';
const day = z
  .string()
  .refine(
    (value) =>
      value === '' ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
        new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value),
    'Invalid date.',
  );
// Local Martinique time, 24 hours. Optional, so trips saved before it existed still load.
export const startTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time.');
export const tripStopSchema = z.object({
  placeId: z.number().int().positive(),
  minutes: z.number().int().min(5).max(720),
});
export const tripSchema = z.object({
  id: z.uuid(),
  name: z.string().max(100),
  date: day,
  startTime: startTimeSchema.optional(),
  notes: z.string().max(2000),
  stops: z
    .array(tripStopSchema)
    .max(20)
    .refine((stops) => new Set(stops.map((s) => s.placeId)).size === stops.length),
  updatedAt: z.iso.datetime(),
});
export type DayTrip = z.infer<typeof tripSchema>;
export const tripsSchema = z.object({ version: z.literal(1), trips: z.array(tripSchema).max(20) });
/**
 * A planning allowance, not a routed ETA: 1.4x straight-line distance at 30 km/h,
 * plus five minutes per transfer. Live directions remain the source for road times.
 */
export function travelAllowance(distanceKm: number, legs: number) {
  return Math.ceil(((distanceKm * 1.4) / 30) * 60 + legs * 5);
}
export function moveStop(trip: DayTrip, index: number, direction: -1 | 1): DayTrip {
  const target = index + direction;
  if (index < 0 || index >= trip.stops.length || target < 0 || target >= trip.stops.length)
    return trip;
  const stops = [...trip.stops];
  [stops[index], stops[target]] = [stops[target], stops[index]];
  return { ...trip, stops, updatedAt: new Date().toISOString() };
}
export function tripSummary(trip: DayTrip, places: Place[]) {
  const byId = new Map(places.map((p) => [p.id, p]));
  let distance = 0;
  let legs = 0;
  let missing = trip.stops.some((stop) => !byId.has(stop.placeId));
  for (let i = 1; i < trip.stops.length; i++) {
    const a = byId.get(trip.stops[i - 1].placeId),
      b = byId.get(trip.stops[i].placeId);
    if (a && b) {
      distance += calculateDistance(a.lat, a.lng, b.lat, b.lng);
      legs++;
    } else missing = true;
  }
  const minutes = trip.stops.reduce((sum, stop) => sum + stop.minutes, 0);
  const travelMinutes = travelAllowance(distance, legs);
  return { distance, minutes, travelMinutes, totalMinutes: minutes + travelMinutes, missing };
}
export function optimizeTrip(trip: DayTrip, places: Place[]): DayTrip {
  const byId = new Map(places.map((place) => [place.id, place]));
  if (trip.stops.length < 3 || trip.stops.some((stop) => !byId.has(stop.placeId))) return trip;
  const stops = [trip.stops[0]];
  const remaining = trip.stops.slice(1);
  while (remaining.length) {
    const previous = byId.get(stops[stops.length - 1].placeId)!;
    let nearest = 0;
    let distance = Infinity;
    remaining.forEach((stop, index) => {
      const next = byId.get(stop.placeId)!;
      const candidate = calculateDistance(previous.lat, previous.lng, next.lat, next.lng);
      if (candidate < distance) {
        nearest = index;
        distance = candidate;
      }
    });
    stops.push(remaining.splice(nearest, 1)[0]);
  }
  const candidate = { ...trip, stops };
  return tripSummary(candidate, places).distance < tripSummary(trip, places).distance
    ? { ...candidate, updatedAt: new Date().toISOString() }
    : trip;
}
export function legDirections(place: Place, previous?: Place) {
  const query = new URLSearchParams({ api: '1', destination: `${place.lat},${place.lng}` });
  if (previous) query.set('origin', `${previous.lat},${previous.lng}`);
  return `https://www.google.com/maps/dir/?${query}`;
}
