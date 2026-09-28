import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { normalizePlace } from '../lib/places-utils';
import { cacheCatalogue, readCatalogue } from '../lib/catalogue-cache';
import type { Place } from '../types';

export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>(() => readCatalogue() ?? []);
  const [catalogueStatus, setCatalogueStatus] = useState<'loading' | 'live' | 'offline'>('loading');
  const [revision, setRevision] = useState(0);
  const refreshPlaces = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const offline = () => setCatalogueStatus('offline');
    window.addEventListener('online', refreshPlaces);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', refreshPlaces);
      window.removeEventListener('offline', offline);
    };
  }, [refreshPlaces]);
  useEffect(() => {
    const controller = new AbortController();
    setCatalogueStatus(navigator.onLine ? 'loading' : 'offline');
    api<unknown[]>('/places', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const next = data.map(normalizePlace);
        setPlaces(next);
        cacheCatalogue(next);
        setCatalogueStatus(navigator.onLine ? 'live' : 'offline');
      })
      .catch(async () => {
        if (controller.signal.aborted) return;
        setCatalogueStatus('offline');
        const cached = readCatalogue();
        if (cached) {
          setPlaces(cached);
          return;
        }
        // Keep the complete bundled guide in a separate chunk, available through the offline shell.
        try {
          const { default: seed } = await import('../../../database/data/places.json');
          if (!controller.signal.aborted)
            setPlaces(seed.filter((place) => place.published !== false).map(normalizePlace));
        } catch {
          // A first visit without connectivity may not have the fallback chunk yet.
          // Keep the offline notice and retry action available.
        }
      });
    return () => controller.abort();
  }, [revision]);
  return { places, catalogueStatus, refreshPlaces };
}
