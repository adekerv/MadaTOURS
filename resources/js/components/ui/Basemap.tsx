import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { addBasemap, type BasemapEvents } from '../../lib/basemap';
/** The app's base map inside a react-leaflet MapContainer. */
export function Basemap({ dark, ...events }: { dark: boolean } & BasemapEvents) {
  const map = useMap();
  // The callbacks may change on every render; the map layer should not be rebuilt for that.
  const latest = useRef(events);
  latest.current = events;
  useEffect(
    () =>
      addBasemap(map, dark, {
        loading: () => latest.current.loading?.(),
        loaded: () => latest.current.loaded?.(),
        failed: () => latest.current.failed?.(),
      }),
    [map, dark],
  );
  return null;
}
