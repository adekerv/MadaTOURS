import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useTheme } from '../../hooks/useTheme';
import { addBasemap, maxZoom, minZoom } from '../../lib/basemap';
/** A still map with one point. It never captures scrolling, so the page stays easy to swipe. */
export default function MiniMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const { dark } = useTheme();
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const map = L.map(element, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      minZoom,
      maxZoom,
    }).setView([lat, lng], 15);
    addBasemap(map, dark);
    L.marker([lat, lng], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        html: '<span class="detail-map-dot"></span>',
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    }).addTo(map);
    // The dialog sizes the map after it mounts and again when the window rotates.
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(element);
    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [lat, lng, dark]);
  return <div ref={frame} role="img" aria-label={label} className="detail-map" />;
}
