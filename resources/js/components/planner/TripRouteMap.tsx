import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useTheme } from '../../hooks/useTheme';
import { getPlaceTheme } from '../../utils/emoji';
import type { RoutePoint, TripRoute } from '../../lib/trip-route';

const part = (className: string, text = '') => {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
};
/** A round pin with the place's emoji and its position in the trip. Text goes in through textContent only. */
function routePin(point: RoutePoint, isStart: boolean) {
  const theme = getPlaceTheme(point.place);
  const pin = part(isStart ? 'route-pin route-pin-start' : 'route-pin');
  pin.style.setProperty('--pin', theme.color);
  pin.append(part('route-pin-emoji', theme.emoji), part('route-pin-number', String(point.order)));
  if (isStart) pin.append(part('route-pin-flag', '🏁'));
  return L.divIcon({
    html: pin,
    className: 'route-pin-container',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}
function arrowIcon(bearing: number) {
  const arrow = part('route-arrow');
  arrow.style.transform = `rotate(${Math.round(bearing)}deg)`;
  return L.divIcon({
    html: arrow,
    className: 'route-arrow-container',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/**
 * The planned stops in visiting order, joined by straight lines with direction arrows. On phones the map stays
 * still so the page keeps scrolling; on larger screens it can be dragged and zoomed.
 */
export default function TripRouteMap({ route, label }: { route: TripRoute; label: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fit = useRef<() => void>(() => {});
  const { dark } = useTheme();
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const touch = L.Browser.mobile;
    const map = L.map(element, {
      zoomControl: false,
      dragging: !touch,
      scrollWheelZoom: false,
      doubleClickZoom: !touch,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    }).setView([14.65, -61], 10);
    // Top right, so the start badge in the top left never covers the buttons.
    if (!touch) L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: dark ? 'map-tiles-dark' : '',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    }).addTo(map);
    layer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // The dialog sizes the map after it mounts and again when the window rotates.
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      fit.current();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layer.current = null;
    };
  }, [dark]);
  useEffect(() => {
    const map = mapRef.current;
    const group = layer.current;
    if (!map || !group) return;
    group.clearLayers();
    const at = (point: RoutePoint): L.LatLngTuple => [point.place.lat, point.place.lng];
    for (const leg of route.legs) {
      const ends = [at(leg.from), at(leg.to)];
      const options = { interactive: false, lineCap: 'round' as const };
      // A pale or dark outline keeps the line readable over both busy tiles and the dark map.
      L.polyline(ends, {
        ...options,
        color: dark ? '#0f172a' : '#ffffff',
        weight: 9,
        opacity: 0.9,
        className: 'route-line-casing',
      }).addTo(group);
      L.polyline(ends, {
        ...options,
        color: dark ? '#fb923c' : '#c2410c',
        weight: 4,
        className: 'route-line',
      }).addTo(group);
    }
    // An arrow only where its leg is long enough on screen to hold one without crowding the pins.
    const arrows = L.layerGroup().addTo(group);
    const drawArrows = () => {
      arrows.clearLayers();
      for (const leg of route.legs) {
        const a = at(leg.from);
        const b = at(leg.to);
        if (map.latLngToContainerPoint(a).distanceTo(map.latLngToContainerPoint(b)) < 72) continue;
        L.marker([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], {
          interactive: false,
          keyboard: false,
          icon: arrowIcon(leg.bearing),
          zIndexOffset: -500,
        }).addTo(arrows);
      }
    };
    route.points.forEach((point, index) =>
      L.marker(at(point), {
        interactive: false,
        keyboard: false,
        icon: routePin(point, index === 0),
        zIndexOffset: index === 0 ? 1000 : 0,
      }).addTo(group),
    );
    // Room above for the start badge, and for the pins' own size on every side.
    fit.current = () => {
      if (route.points.length === 1) map.setView(at(route.points[0]), 14, { animate: false });
      else
        map.fitBounds(L.latLngBounds(route.points.map(at)), {
          paddingTopLeft: [48, 64],
          paddingBottomRight: [48, 60],
          maxZoom: 15,
          animate: false,
        });
      drawArrows();
    };
    fit.current();
    map.on('zoomend', drawArrows);
    return () => {
      map.off('zoomend', drawArrows);
    };
  }, [route, dark]);
  return <div ref={frame} role="img" aria-label={label} className="trip-map" />;
}
