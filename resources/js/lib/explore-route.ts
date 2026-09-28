import type { ExploreParams } from '../types';

export function readExploreRoute(hash: string): ExploreParams | null {
  if (!/^#explore(?:\?|$)/.test(hash)) return null;
  const params = new URLSearchParams(hash.split('?')[1]);
  const filter = params.get('filter');
  const sort = params.get('sort');
  const selected = Number(params.get('place'));
  return {
    filter: filter === 'restaurant' || filter === 'activity' ? filter : 'all',
    radius: Math.min(100, Math.max(1, Number(params.get('radius')) || 50)),
    sortBy: sort === 'hiking' || sort === 'entertainment' || sort === 'rating' ? sort : undefined,
    selectedPlaceId: Number.isSafeInteger(selected) && selected > 0 ? selected : undefined,
    query: (params.get('q') || '').slice(0, 100),
    town: (params.get('town') || '').slice(0, 100),
    experience: (params.get('experience') || '').slice(0, 40),
  };
}

export function exploreHash(params: ExploreParams): string {
  const search = new URLSearchParams({
    filter: params.filter,
    radius: String(params.radius ?? 50),
  });
  if (params.sortBy) search.set('sort', params.sortBy);
  if (params.selectedPlaceId) search.set('place', String(params.selectedPlaceId));
  if (params.query) search.set('q', params.query);
  if (params.town) search.set('town', params.town);
  if (params.experience) search.set('experience', params.experience);
  return `#explore?${search}`;
}
