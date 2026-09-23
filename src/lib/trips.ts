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
export const tripStopSchema = z.object({
  placeId: z.number().int().positive(),
  minutes: z.number().int().min(5).max(720),
});
export const tripSchema = z.object({
  id: z.uuid(),
  name: z.string().max(100),
  date: day,
  notes: z.string().max(2000),
  stops: z
    .array(tripStopSchema)
    .max(20)
    .refine((stops) => new Set(stops.map((s) => s.placeId)).size === stops.length),
  updatedAt: z.iso.datetime(),
});
export type DayTrip = z.infer<typeof tripSchema>;
export const tripsSchema = z.object({ version: z.literal(1), trips: z.array(tripSchema).max(20) });
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
  for (let i = 1; i < trip.stops.length; i++) {
    const a = byId.get(trip.stops[i - 1].placeId),
      b = byId.get(trip.stops[i].placeId);
    if (a && b) distance += calculateDistance(a.lat, a.lng, b.lat, b.lng);
  }
  return { distance, minutes: trip.stops.reduce((sum, stop) => sum + stop.minutes, 0) };
}
export function legDirections(place: Place, previous?: Place) {
  const query = new URLSearchParams({ api: '1', destination: `${place.lat},${place.lng}` });
  if (previous) query.set('origin', `${previous.lat},${previous.lng}`);
  return `https://www.google.com/maps/dir/?${query}`;
}
