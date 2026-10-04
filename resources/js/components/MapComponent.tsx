import { useI18n } from '../i18n/I18nProvider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, useMap, useMapEvents, Circle, ZoomControl } from 'react-leaflet';
import { Basemap } from './ui/Basemap';
import { maxZoom, minZoom } from '../lib/basemap';
import L from 'leaflet';
// The plugin attaches itself to the global Leaflet object that the import above provides.
import 'leaflet.markercluster';
import type { Place, UserLocation } from '../types';
import { useTheme } from '../hooks/useTheme';
import { getPlaceTheme } from '../utils/emoji';
interface Props {
  userLocation: UserLocation;
  places: Place[];
  onLocationSelect: (lat: number, lng: number) => void;
  onPlaceSelect: (place: Place) => void;
  onMapClick: () => void;
  radius: number;
  selectedPlace: Place | null;
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  manualSelect: boolean;
}
function MapHandler({
  userLocation,
  selectedPlace,
  onLocationSelect,
  onMapClick,
  manualSelect,
  radius,
}: Omit<Props, 'places' | 'onPlaceSelect' | 'hoveredId' | 'onHover'>) {
  const map = useMap();
  useEffect(() => {
    const frameSearch = () => {
      const container = map.getContainer();
      if (!container.clientWidth || !container.clientHeight) return;
      map.invalidateSize({ pan: false });
      if (selectedPlace)
        map.setView([selectedPlace.lat, selectedPlace.lng], 14, { animate: false });
      else
        map.fitBounds(L.latLng(userLocation.lat, userLocation.lng).toBounds(radius * 2000), {
          padding: [25, 25],
          maxZoom: 14,
          animate: false,
        });
    };
    // A map mounted in the mobile List view has no measurable size yet.
    // Frame it once visible and again after rotation or a split-view resize.
    const observer = new ResizeObserver(frameSearch);
    observer.observe(map.getContainer());
    frameSearch();
    return () => observer.disconnect();
  }, [map, selectedPlace, userLocation, radius]);
  useMapEvents({
    click(event) {
      if (manualSelect) onLocationSelect(event.latlng.lat, event.latlng.lng);
      else onMapClick();
    },
  });
  return null;
}
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/**
 * A pill with the place's emoji, name and rating. Built with DOM nodes and textContent so
 * catalogue text is never parsed as HTML.
 */
function pillIcon(place: Place, active = false) {
  const theme = getPlaceTheme(place);
  const part = (className: string, text: string) => {
    const node = document.createElement('span');
    node.className = className;
    node.textContent = text;
    return node;
  };
  const pill = document.createElement('span');
  pill.className = `map-pill ${active ? 'map-pill-active' : ''}`;
  pill.style.setProperty('--pin', theme.color);
  pill.append(part('map-pill-emoji', theme.emoji), part('map-pill-name', place.name));
  const rating = place.communityCount ? place.communityRating : place.rating;
  if (rating) pill.append(part('map-pill-rating', `★ ${rating.toFixed(1)}`));
  return L.divIcon({
    html: pill,
    className: 'map-pill-container',
    iconSize: [44, 44],
    iconAnchor: [22, 44],
  });
}
function clusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 44 : count < 50 ? 50 : 58;
  return L.divIcon({
    html: `<span class="mt-cluster-count">${count}</span>`,
    className: 'mt-cluster',
    iconSize: [size, size],
  });
}
/** Groups dense pins into numbered clusters that open on zoom and fan out at the deepest zoom. */
function PlaceLayer({
  places,
  hoveredId,
  onSelect,
  onHover,
}: {
  places: Place[];
  hoveredId: number | null;
  onSelect: (place: Place) => void;
  onHover: (id: number | null) => void;
}) {
  const map = useMap();
  const handlers = useRef({ onSelect, onHover });
  const group = useRef<L.MarkerClusterGroup | null>(null);
  const markers = useRef(new Map<number, L.Marker>());
  useEffect(() => {
    handlers.current = { onSelect, onHover };
  });
  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 70,
      disableClusteringAtZoom: 15,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true,
      animate: !reducedMotion(),
      iconCreateFunction: clusterIcon,
    });
    const created = new Map<number, L.Marker>();
    for (const place of places) {
      const marker = L.marker([place.lat, place.lng], {
        icon: pillIcon(place),
        title: place.name,
        alt: place.name,
      });
      marker.on('click', () => handlers.current.onSelect(place));
      marker.on('mouseover', () => handlers.current.onHover(place.id));
      marker.on('mouseout', () => handlers.current.onHover(null));
      created.set(place.id, marker);
    }
    cluster.addLayers([...created.values()]);
    map.addLayer(cluster);
    group.current = cluster;
    markers.current = created;
    return () => {
      map.removeLayer(cluster);
      group.current = null;
      markers.current = new Map();
    };
  }, [map, places]);
  useEffect(() => {
    // Highlight the pin, or the cluster currently hiding it, for the hovered sidebar card.
    const cluster = group.current;
    const marker = hoveredId === null ? undefined : markers.current.get(hoveredId);
    if (!cluster || !marker) return;
    let lit: HTMLElement | undefined;
    const light = () => {
      lit?.classList.remove('is-hot');
      lit = cluster.getVisibleParent(marker)?.getElement();
      lit?.classList.add('is-hot');
    };
    light();
    cluster.on('animationend', light);
    return () => {
      cluster.off('animationend', light);
      lit?.classList.remove('is-hot');
    };
  }, [hoveredId, places]);
  useEffect(() => {
    // Far out, pills shrink to their emoji so neighbouring places stay readable.
    const container = map.getContainer();
    const apply = () => container.classList.toggle('pills-far', map.getZoom() < 13);
    apply();
    map.on('zoomend', apply);
    return () => {
      map.off('zoomend', apply);
      container.classList.remove('pills-far');
    };
  }, [map]);
  return null;
}
/** The chosen place's pill rises above any cluster so it is always findable. */
function ActivePin({ place }: { place: Place | null }) {
  const icon = useMemo(() => (place ? pillIcon(place, true) : undefined), [place]);
  if (!place || !icon) return null;
  return (
    <Marker
      position={[place.lat, place.lng]}
      icon={icon}
      interactive={false}
      keyboard={false}
      zIndexOffset={1000}
    />
  );
}
export function MapComponent(props: Props) {
  const { t } = useI18n();
  const { dark } = useTheme();
  const [tileError, setTileError] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(true);
  const userIcon = useMemo(
    () =>
      L.divIcon({
        html: '<span class="search-center-marker"></span>',
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    [],
  );
  return (
    <div
      className={`relative h-full w-full isolate ${props.manualSelect ? 'map-picking' : ''}`}
      aria-label={t('Map of places in Martinique')}
    >
      <MapContainer
        center={[14.6415, -61.0242]}
        zoom={10}
        zoomControl={false}
        className="h-full w-full"
        minZoom={minZoom}
        maxZoom={maxZoom}
      >
        <Basemap
          dark={dark}
          loading={() => setTilesLoading(true)}
          loaded={() => setTilesLoading(false)}
          failed={() => {
            setTileError(true);
            setTilesLoading(false);
          }}
        />
        <ZoomControl position="topright" />
        <MapHandler {...props} />
        <Marker
          position={[props.userLocation.lat, props.userLocation.lng]}
          icon={userIcon}
          interactive={false}
          keyboard={false}
          title={props.userLocation.manual ? t('Search center') : t('Your location')}
          alt={t('Search center')}
        />
        <Circle
          center={[props.userLocation.lat, props.userLocation.lng]}
          radius={props.radius * 1000}
          pathOptions={{ color: '#ea580c', fillOpacity: 0.06, weight: 2, dashArray: '5, 8' }}
        />
        <PlaceLayer
          places={props.places}
          hoveredId={props.hoveredId}
          onSelect={props.onPlaceSelect}
          onHover={props.onHover}
        />
        <ActivePin place={props.selectedPlace} />
      </MapContainer>
      {tilesLoading && !tileError && (
        <div role="status" className="pointer-events-none absolute inset-0 z-[450] bg-orange-50/70">
          <div className="skeleton h-full w-full" />
          <span className="absolute left-4 top-4 rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow">
            {t('Loading map…')}
          </span>
        </div>
      )}
      {tileError && (
        <p
          role="status"
          className="absolute left-3 top-3 z-[500] max-w-[65%] rounded-xl bg-white p-3 text-xs text-slate-700 shadow"
        >
          {t('Some map tiles could not load. You can still browse places in the list.')}
        </p>
      )}
    </div>
  );
}
