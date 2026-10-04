import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useI18n } from '../../i18n/I18nProvider';
import { useTheme } from '../../hooks/useTheme';
import { addBasemap, maxZoom, minZoom } from '../../lib/basemap';
import { isTablet } from '../../lib/touch';
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

/** Where an arrow fits along a drawn line: every `spacing` pixels, pointing the way the line runs there. */
function arrowsAlong(map: L.Map, line: L.LatLngTuple[], spacing: number) {
  const points = line.map((point) => map.latLngToContainerPoint(point));
  const found: { at: L.LatLng; bearing: number }[] = [];
  const total = points.reduce(
    (sum, point, i) => (i ? sum + points[i - 1].distanceTo(point) : 0),
    0,
  );
  // A line too short for an arrow gets none; a short one still gets a single arrow at its middle.
  if (total < 72) return found;
  let walked = 0;
  let next = Math.min(spacing / 2, total / 2);
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const length = from.distanceTo(to);
    while (length && walked + length >= next) {
      const share = (next - walked) / length;
      found.push({
        at: map.containerPointToLatLng([
          from.x + (to.x - from.x) * share,
          from.y + (to.y - from.y) * share,
        ]),
        bearing: ((Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI + 360) % 360,
      });
      next += spacing;
    }
    walked += length;
  }
  return found;
}

/**
 * The planned stops in visiting order, joined by their road route when one is stored and by straight lines
 * otherwise, with direction arrows. Phones keep the map still so the page scrolls. Larger screens can drag and
 * zoom it; on tablets two fingers move the map and one finger still scrolls the page.
 */
export default function TripRouteMap({
  route,
  label,
  road,
}: {
  route: TripRoute;
  label: string;
  /** The road line between the stops as GeoJSON positions, [longitude, latitude]. */
  road?: [number, number][] | null;
}) {
  const { t } = useI18n();
  const frame = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fit = useRef<() => void>(() => {});
  const { dark } = useTheme();
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const touch = L.Browser.mobile;
    const tablet = isTablet();
    const map = L.map(element, {
      zoomControl: false,
      dragging: !touch,
      scrollWheelZoom: false,
      doubleClickZoom: !touch,
      boxZoom: false,
      keyboard: false,
      // Leaflet then leaves one-finger gestures to the browser (touch-action: pan-x pan-y) and takes two-finger
      // pinches, which also move the map.
      touchZoom: tablet,
      minZoom,
      maxZoom,
    }).setView([14.65, -61], 10);
    // Top right, so the start badge in the top left never covers the buttons. Tablets get the buttons too, as an
    // alternative to the two-finger gestures.
    if (!touch || tablet) L.control.zoom({ position: 'topright' }).addTo(map);
    addBasemap(map, dark);
    layer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // The dialog sizes the map after it mounts and again when the window rotates.
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      fit.current();
    });
    observer.observe(element);
    // One finger scrolling past the map tells the person how to move it, instead of silently doing nothing.
    let hideHint: ReturnType<typeof setTimeout> | undefined;
    const oneFinger = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      setHint(true);
      clearTimeout(hideHint);
      hideHint = setTimeout(() => setHint(false), 1800);
    };
    const twoFingers = (event: TouchEvent) => {
      if (event.touches.length > 1) setHint(false);
    };
    if (tablet) {
      element.addEventListener('touchmove', oneFinger, { passive: true });
      element.addEventListener('touchstart', twoFingers, { passive: true });
    }
    return () => {
      clearTimeout(hideHint);
      element.removeEventListener('touchmove', oneFinger);
      element.removeEventListener('touchstart', twoFingers);
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
    const roadLine: L.LatLngTuple[] | null =
      road && road.length > 1 && route.points.length > 1
        ? road.map(([lng, lat]) => [lat, lng])
        : null;
    const options = { interactive: false, lineCap: 'round' as const, lineJoin: 'round' as const };
    // A pale or dark outline keeps the line readable over both busy tiles and the dark map.
    const casing = {
      ...options,
      color: dark ? '#0f172a' : '#ffffff',
      weight: 9,
      opacity: 0.9,
      className: 'route-line-casing',
    };
    const line = {
      ...options,
      color: dark ? '#fb923c' : '#c2410c',
      weight: 4,
      className: 'route-line',
    };
    if (roadLine) {
      L.polyline(roadLine, casing).addTo(group);
      L.polyline(roadLine, { ...line, className: 'route-line route-line-road' }).addTo(group);
    } else
      for (const leg of route.legs) {
        const ends = [at(leg.from), at(leg.to)];
        L.polyline(ends, casing).addTo(group);
        L.polyline(ends, line).addTo(group);
      }
    // An arrow only where its line is long enough on screen to hold one without crowding the pins.
    const arrows = L.layerGroup().addTo(group);
    const placeArrow = (position: L.LatLngExpression, bearing: number) =>
      L.marker(position, {
        interactive: false,
        keyboard: false,
        icon: arrowIcon(bearing),
        zIndexOffset: -500,
      }).addTo(arrows);
    const drawArrows = () => {
      arrows.clearLayers();
      if (roadLine) {
        const pins = route.points.map((point) => map.latLngToContainerPoint(at(point)));
        for (const arrow of arrowsAlong(map, roadLine, 140))
          if (pins.every((pin) => pin.distanceTo(map.latLngToContainerPoint(arrow.at)) >= 34))
            placeArrow(arrow.at, arrow.bearing);
        return;
      }
      for (const leg of route.legs) {
        const a = at(leg.from);
        const b = at(leg.to);
        if (map.latLngToContainerPoint(a).distanceTo(map.latLngToContainerPoint(b)) < 72) continue;
        placeArrow([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], leg.bearing);
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
    // Room above for the start badge, and for the pins' own size on every side. The map credit sits along the
    // bottom edge and wraps to two lines on a narrow phone, so the space below follows its real height.
    fit.current = () => {
      const credit = map.attributionControl?.getContainer()?.offsetHeight ?? 0;
      if (route.points.length === 1) map.setView(at(route.points[0]), 14, { animate: false });
      else
        map.fitBounds(L.latLngBounds([...route.points.map(at), ...(roadLine ?? [])]), {
          paddingTopLeft: [48, 64],
          paddingBottomRight: [48, Math.max(60, credit + 28)],
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
  }, [route, road, dark]);
  return (
    <>
      <div ref={frame} role="img" aria-label={label} className="trip-map" />
      {hint && (
        <p role="status" className="map-gesture-hint">
          {t('Use two fingers to move the map')}
        </p>
      )}
    </>
  );
}
