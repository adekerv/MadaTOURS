import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { normalizePlace } from '../lib/places-utils';
import type { Place } from '../types';

/** Places opened this session, kept for ten minutes so a reopened page is instant but never long out of date. */
const loaded = new Map<number, { place: Place; at: number }>();
const fresh = (id: number) => {
  const entry = loaded.get(id);
  return entry && Date.now() - entry.at < 600_000 ? entry.place : undefined;
};

/**
 * The place with its practical details and sources. The list leaves those out, so this asks for them when a place
 * page opens. Without a connection the bundled guide, which has them all, fills in.
 */
export function usePlaceDetail(listed: Place): {
  place: Place;
  status: 'ready' | 'loading' | 'failed';
} {
  const [fetched, setFetched] = useState<Place | undefined>(() => fresh(listed.id));
  const [failed, setFailed] = useState(false);
  const needed = !listed.detailLoaded;
  useEffect(() => {
    setFailed(false);
    const known = fresh(listed.id);
    if (!needed || known) {
      setFetched(known);
      return;
    }
    setFetched(undefined);
    const controller = new AbortController();
    const keep = (place: Place) => {
      if (controller.signal.aborted) return;
      loaded.set(place.id, { place, at: Date.now() });
      setFetched(place);
    };
    api<unknown>(`/places/${listed.id}`, { signal: controller.signal })
      .then((data) => keep(normalizePlace(data)))
      .catch(async (error) => {
        if (controller.signal.aborted) return;
        // A place the server says is gone or hidden must not come back from the bundled guide. Only a failed
        // connection or a server outage is covered by it.
        if (error instanceof ApiError && error.status < 500) {
          setFailed(true);
          return;
        }
        try {
          const { default: seed } = await import('../../../database/data/places.json');
          const row = seed.find((place) => place.id === listed.id);
          if (row) keep(normalizePlace(row));
          else setFailed(true);
        } catch {
          if (!controller.signal.aborted) setFailed(true);
        }
      });
    return () => controller.abort();
  }, [listed.id, needed]);
  // What the list already knows (live ratings, distance) stays; the page adds only what the list left out.
  const place = fetched
    ? {
        ...fetched,
        ...listed,
        details: fetched.details,
        sources: fetched.sources,
        detailLoaded: true,
      }
    : listed;
  return { place, status: !needed || fetched ? 'ready' : failed ? 'failed' : 'loading' };
}
