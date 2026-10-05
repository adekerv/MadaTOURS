import { z } from 'zod';
import type { Place } from '../types';
import type { Language } from '../i18n/core';
import { tripRoute, type TripRoute } from './trip-route';
import { tripStopSchema } from './trips';

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const routeFacts = { distanceM: z.number().nullable(), durationS: z.number().nullable() };
/** A tour as the lists carry it: how long its road is, but not where it goes. */
export const tourSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  nameFr: z.string().nullable(),
  description: z.string(),
  descriptionFr: z.string().nullable(),
  published: z.boolean(),
  stops: z.array(tripStopSchema).min(2).max(25),
  /** Null while only straight lines are known. */
  route: z.object(routeFacts).nullable(),
  routeSource: z.enum(['road', 'straight']),
});
/** The tour's own page also has the road line itself, worked out when its stops were saved. */
export const tourDetailSchema = tourSchema.extend({
  route: z
    .object({
      ...routeFacts,
      geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(position).min(2) }),
    })
    .nullable(),
});
export type Tour = z.infer<typeof tourSchema>;
export type TourDetail = z.infer<typeof tourDetailSchema>;

export function parseTourDetail(data: unknown): TourDetail | null {
  const parsed = tourDetailSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

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
export const tourRoute = (tour: Pick<Tour, 'stops'>, places: Place[]): TripRoute =>
  tripRoute({ stops: tour.stops }, places);

/** The stored road line, unless a stop is no longer listed: that line would still pass through the missing place. */
export const roadLine = (detail: TourDetail | null, route: TripRoute) =>
  detail?.route && !route.missing ? detail.route.geometry.coordinates : null;

export function formatRoute(tour: Tour) {
  if (!tour.route?.distanceM) return null;
  const km = tour.route.distanceM / 1000;
  const minutes = tour.route.durationS ? Math.round(tour.route.durationS / 60) : null;
  return { km: km < 10 ? km.toFixed(1) : String(Math.round(km)), minutes };
}

const cacheKey = 'madatours:tours:v1';
/** The last published tours this device loaded, so the homepage still shows them offline. */
export function readTours(): Tour[] | null {
  try {
    const data = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (data?.version !== 1 || !Array.isArray(data.tours) || data.tours.length > 200) return null;
    return parseTours(data.tours);
  } catch {
    return null;
  }
}
export function cacheTours(tours: Tour[]): void {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({ version: 1, savedAt: new Date().toISOString(), tours }),
    );
  } catch {
    /* Without device storage the tours simply load again next time. */
  }
}
