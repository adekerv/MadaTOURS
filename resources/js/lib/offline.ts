import { normalizePlace } from './places-utils';
import type { Place } from '../types';
export interface OfflinePlaces {
  version: 1;
  ownerId: string;
  savedAt: string;
  favorites: Place[];
  revisits: Place[];
}
const key = 'madatours:offline-places:v1';
export function readOfflinePlaces(): OfflinePlaces | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (
      data.version !== 1 ||
      typeof data.ownerId !== 'string' ||
      !Number.isFinite(Date.parse(data.savedAt)) ||
      !Array.isArray(data.favorites) ||
      !Array.isArray(data.revisits) ||
      data.favorites.length > 1000 ||
      data.revisits.length > 1000
    )
      return null;
    return {
      ...data,
      favorites: data.favorites.map(normalizePlace),
      revisits: data.revisits.map(normalizePlace),
    };
  } catch {
    return null;
  }
}
export function saveOfflinePlaces(ownerId: string, favorites: Place[], revisits: Place[]): boolean {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        ownerId,
        savedAt: new Date().toISOString(),
        favorites,
        revisits,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearOfflinePlaces() {
  try {
    localStorage.removeItem(key);
  } catch {
    /* A disabled store cannot be written. */
  }
}
