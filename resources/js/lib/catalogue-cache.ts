import { normalizePlace } from './places-utils';
import type { Place } from '../types';
const key = 'madatours:catalogue:v1';
export function readCatalogue(): Place[] | null {
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    if (data?.version !== 1 || !Array.isArray(data.places) || data.places.length > 5000)
      return null;
    return data.places.map(normalizePlace);
  } catch {
    return null;
  }
}
export function cacheCatalogue(places: Place[]): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ version: 1, savedAt: new Date().toISOString(), places }),
    );
  } catch {
    /* The bundled guide remains available if device storage is full. */
  }
}
