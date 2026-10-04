import L from 'leaflet';
import { MaplibreGL, maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import { translate } from '../i18n/core';

/**
 * The base map for every Leaflet map in the app: OpenFreeMap vector tiles, which are free, need no key and may be
 * used in production, drawn by MapLibre GL inside Leaflet so markers, clusters and routes work as before. One style
 * serves both themes: the dark theme darkens it with a CSS filter, as the raster map always did.
 */
const style = 'https://tiles.openfreemap.org/styles/liberty';
const link = (href: string, text: string) =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
export const attribution = `${link('https://openfreemap.org', 'OpenFreeMap')} ${link('https://www.openmaptiles.org/', '&copy; OpenMapTiles')} Data from ${link('https://www.openstreetmap.org/copyright', 'OpenStreetMap')}`;
/** The lowest zoom the maps allow: MapLibre and Leaflet drift apart at world scale. */
export const minZoom = 3;
/** The vector base layer does not set a zoom limit for Leaflet the way a tile layer does, so each map states it. */
export const maxZoom = 19;

/**
 * The Leaflet binding reacts to a resize by scheduling work for the next animation frame. If the layer is removed
 * first (a map being rebuilt or closed while the window changes size), that work reads a map that is gone and throws
 * "Cannot read properties of null". This makes the deferred step do nothing once its layer has been removed.
 * It relies on the binding's internals, so the package is pinned to an exact version.
 */
type Binding = { _map: unknown; _glMap: unknown; _transitionEnd: (...args: unknown[]) => unknown };
const binding = MaplibreGL.prototype as unknown as Binding;
const transitionEnd = binding._transitionEnd;
binding._transitionEnd = function (this: Binding, ...args: unknown[]) {
  const request = L.Util.requestAnimFrame;
  L.Util.requestAnimFrame = (
    fn: (timestamp: number) => void,
    context?: unknown,
    immediate?: boolean,
  ) =>
    request(
      (timestamp: number) => {
        if (this._map && this._glMap) fn.call(context, timestamp);
      },
      undefined,
      immediate,
    );
  try {
    return transitionEnd.apply(this, args);
  } finally {
    L.Util.requestAnimFrame = request;
  }
};

/**
 * Narrower than this, the credit would take two or three rows (every link keeps a 44px touch target) and cover a
 * third of the map, so it folds behind an "i" button, as map libraries do on phones. The credit is still one tap away
 * and every link in it is unchanged.
 */
const foldBelow = 440;
class CreditToggle extends L.Control {
  constructor(private label: () => string) {
    super({ position: 'bottomright' });
  }
  onAdd(map: L.Map) {
    const box = L.DomUtil.create('div', 'leaflet-bar map-credit-toggle');
    const button = L.DomUtil.create('button', '', box);
    button.type = 'button';
    button.textContent = 'i';
    button.setAttribute('aria-expanded', 'false');
    const name = () => button.setAttribute('aria-label', this.label());
    name();
    // The language can change while a map stays open, so the name is read again when the button is used.
    button.addEventListener('focus', name);
    L.DomEvent.disableClickPropagation(box);
    L.DomEvent.on(button, 'click', () =>
      button.setAttribute(
        'aria-expanded',
        String(map.getContainer().classList.toggle('credit-open')),
      ),
    );
    return box;
  }
}
function foldCredit(map: L.Map): () => void {
  const container = map.getContainer();
  const toggle = new CreditToggle(() =>
    translate(document.documentElement.lang === 'fr' ? 'fr' : 'en', 'Map credits'),
  ).addTo(map);
  const apply = () => {
    const folded = map.getSize().x < foldBelow;
    container.classList.toggle('credit-fold', folded);
    if (!folded) {
      container.classList.remove('credit-open');
      toggle.getContainer()?.querySelector('button')?.setAttribute('aria-expanded', 'false');
    }
  };
  map.on('resize', apply);
  apply();
  return () => {
    map.off('resize', apply);
    toggle.remove();
    container.classList.remove('credit-fold', 'credit-open');
  };
}

export type BasemapEvents = { loading?: () => void; loaded?: () => void; failed?: () => void };

/**
 * Adds the base map and returns a function that removes it. Devices without WebGL cannot draw vector tiles, so
 * they fall back to the OpenStreetMap raster tiles, which the map has always been able to use.
 */
export function addBasemap(map: L.Map, dark: boolean, events: BasemapEvents = {}): () => void {
  let layer: L.Layer | undefined;
  try {
    const gl = maplibreGL({
      style,
      // Shown in Leaflet's own attribution control, whatever the style says.
      attributionControl: { customAttribution: attribution },
    });
    layer = gl.addTo(map);
    if (dark) gl.getContainer().classList.add('map-tiles-dark');
    const inner = gl.getMaplibreMap();
    events.loading?.();
    inner.on('idle', () => events.loaded?.());
    inner.on('error', () => events.failed?.());
  } catch {
    if (layer) map.removeLayer(layer);
    const raster = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: dark ? 'map-tiles-dark' : '',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    });
    raster.on('loading', () => events.loading?.());
    raster.on('load', () => events.loaded?.());
    raster.on('tileerror', () => events.failed?.());
    layer = raster.addTo(map);
  }
  const unfold = foldCredit(map);
  return () => {
    unfold();
    if (layer && map.hasLayer(layer)) map.removeLayer(layer);
  };
}
