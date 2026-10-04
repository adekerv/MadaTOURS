import { z } from 'zod';
import type { Place } from '../types';
import type { Language } from '../i18n/core';
import { tripRoute, type TripRoute } from './trip-route';
import { tripStopSchema, type DayTrip } from './trips';

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export const tourSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  nameFr: z.string().nullable(),
  description: z.string(),
  descriptionFr: z.string().nullable(),
  published: z.boolean(),
  stops: z.array(tripStopSchema).min(2).max(25),
  /** The road line worked out when the stops were saved, or null while only straight lines are known. */
  route: z
    .object({
      geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(position).min(2) }),
      distanceM: z.number().nullable(),
      durationS: z.number().nullable(),
    })
    .nullable(),
  routeSource: z.enum(['road', 'straight']),
});
export type Tour = z.infer<typeof tourSchema>;

/** Tours that do not match the contract are dropped one by one, so a single bad record never hides the rest. */
export function parseTours(data: unknown): Tour[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const parsed = tourSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export const tourName = (tour: Tour, language: Language) =>
  (language === 'fr' && tour.nameFr) || tour.name;
export const tourDescription = (tour: Tour, language: Language) =>
  (language === 'fr' && tour.descriptionFr) || tour.description;

/** The tour as the map draws it: its stops in order, with no start time. */
export function tourRoute(tour: Tour, places: Place[]): TripRoute {
  const trip: DayTrip = {
    id: '00000000-0000-4000-8000-000000000000',
    name: tour.name,
    date: '',
    notes: '',
    stops: tour.stops,
    updatedAt: new Date(0).toISOString(),
  };
  return tripRoute(trip, places);
}

/** The stored road line, unless a stop is no longer listed: that line would still pass through the missing place. */
export const roadLine = (tour: Tour, route: TripRoute) =>
  tour.route && !route.missing ? tour.route.geometry.coordinates : null;

export function formatRoute(tour: Tour) {
  if (!tour.route?.distanceM) return null;
  const km = tour.route.distanceM / 1000;
  const minutes = tour.route.durationS ? Math.round(tour.route.durationS / 60) : null;
  return { km: km < 10 ? km.toFixed(1) : String(Math.round(km)), minutes };
}
