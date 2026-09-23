import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { normalizePlace } from '../lib/places-utils';
import seed from '../data/places.json';
import type { Place } from '../types';
const initial = seed.filter((place) => place.published !== false).map(normalizePlace);
export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>(initial);
  const [catalogueStatus, setCatalogueStatus] = useState<'loading' | 'live' | 'offline'>('loading');
  const [revision, setRevision] = useState(0);
  const refreshPlaces = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setCatalogueStatus('loading');
    api<unknown[]>('/places', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setPlaces(data.map(normalizePlace));
          setCatalogueStatus('live');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalogueStatus('offline');
      });
    return () => controller.abort();
  }, [revision]);
  return { places, catalogueStatus, refreshPlaces };
}
