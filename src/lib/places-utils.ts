import { sourceSchema, photoCreditSchema } from './content.js';
import type { Place } from '../types';
export const deg2rad = (degrees: number) => (degrees * Math.PI) / 180;
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}
export function normalizePlace(value: unknown): Place {
  if (!value || typeof value !== 'object') throw new Error('Invalid place data.');
  const p = value as Record<string, unknown>;
  let tags = p.tags;
  if (typeof tags === 'string') {
    try {
      tags = JSON.parse(tags);
    } catch {
      tags = [];
    }
  }
  if (
    !Number.isSafeInteger(Number(p.id)) ||
    Number(p.id) < 1 ||
    typeof p.name !== 'string' ||
    typeof p.location !== 'string' ||
    !['restaurant', 'activity'].includes(String(p.type)) ||
    p.lat == null ||
    p.lng == null ||
    !Number.isFinite(Number(p.lat)) ||
    !Number.isFinite(Number(p.lng)) ||
    Math.abs(Number(p.lat)) > 90 ||
    Math.abs(Number(p.lng)) > 180
  )
    throw new Error('Invalid place data.');
  return {
    id: Number(p.id),
    name: p.name,
    type: p.type as Place['type'],
    lat: Number(p.lat),
    lng: Number(p.lng),
    location: p.location,
    description: typeof p.description === 'string' ? p.description : '',
    descriptionFr:
      typeof (p.description_fr ?? p.descriptionFr) === 'string'
        ? String(p.description_fr ?? p.descriptionFr)
        : undefined,
    access: p.access === 'restricted' || p.access === 'open' ? p.access : 'unknown',
    sources: sourceSchema.array().safeParse(p.sources).data ?? [],
    photoCredit: photoCreditSchema.safeParse(p.photo_credit ?? p.photoCredit).data,
    tags: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [],
    rating: p.rating != null && Number.isFinite(Number(p.rating)) ? Number(p.rating) : undefined,
    hours: typeof p.hours === 'string' ? p.hours : undefined,
    image:
      typeof p.image === 'string' &&
      (p.image.startsWith('https://') || /^\/photos\/[a-zA-Z0-9._-]+$/.test(p.image))
        ? p.image
        : undefined,
    distance:
      p.distance != null && Number.isFinite(Number(p.distance)) ? Number(p.distance) : undefined,
  };
}
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .trim();
export function matchesSearch(place: Place, query: string) {
  return normalizeSearch(
    [
      place.name,
      place.location,
      place.type,
      place.type === 'activity' ? 'activités' : 'restaurant',
      place.descriptionFr,
      ...(place.tags ?? []),
    ].join(' '),
  ).includes(normalizeSearch(query));
}
export function matchesInterest(place: Place, interest: string) {
  const tags = (place.tags ?? []).map(normalizeSearch);
  if (interest === 'hiking') return tags.some((tag) => /hik|trail|volcano|mountain/.test(tag));
  if (interest === 'entertainment')
    return tags.some((tag) =>
      /cinema|bowling|karting|laser tag|entertainment|arcade|games/.test(tag),
    );
  return true;
}
export const mapsUrl = (place: Place) =>
  `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
