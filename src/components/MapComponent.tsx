import { useI18n } from '../i18n/I18nProvider';
import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
  Circle,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import type { Place, UserLocation } from '../types';
import { getPlaceTheme } from '../utils/emoji';
interface Props {
  userLocation: UserLocation;
  places: Place[];
  onLocationSelect: (lat: number, lng: number) => void;
  onPlaceSelect: (place: Place) => void;
  onMapClick: () => void;
  radius: number;
  selectedPlace: Place | null;
  manualSelect: boolean;
}
function MapHandler({
  userLocation,
  selectedPlace,
  onLocationSelect,
  onMapClick,
  manualSelect,
  radius,
}: Omit<Props, 'places' | 'onPlaceSelect'>) {
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
function PlaceMarker({ place, onSelect }: { place: Place; onSelect: (place: Place) => void }) {
  const icon = useMemo(() => {
    const theme = getPlaceTheme(place);
    // Theme values are a fixed internal palette; no catalogue text is inserted into HTML.
    return L.divIcon({
      html: `<span class="place-marker" style="background:${theme.color}">${theme.emoji}</span>`,
      className: 'place-marker-container',
      iconSize: [44, 44],
      iconAnchor: [22, 38],
    });
  }, [place]);
  return (
    <Marker
      position={[place.lat, place.lng]}
      icon={icon}
      title={place.name}
      alt={place.name}
      eventHandlers={{ click: () => onSelect(place) }}
    />
  );
}
export function MapComponent(props: Props) {
  const { t } = useI18n();
  const [tileError, setTileError] = useState(false);
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
    <div className="relative h-full w-full isolate" aria-label={t('Map of places in Martinique')}>
      <MapContainer
        center={[14.6415, -61.0242]}
        zoom={10}
        zoomControl={false}
        className="h-full w-full"
        minZoom={3}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <ZoomControl position="topright" />
        <MapHandler {...props} />
        <Marker
          position={[props.userLocation.lat, props.userLocation.lng]}
          icon={userIcon}
          title={props.userLocation.manual ? t('Search center') : t('Your location')}
          alt={t('Search center')}
        />
        <Circle
          center={[props.userLocation.lat, props.userLocation.lng]}
          radius={props.radius * 1000}
          pathOptions={{ color: '#ea580c', fillOpacity: 0.06, weight: 2, dashArray: '5, 8' }}
        />
        {props.places.map((place) => (
          <PlaceMarker key={place.id} place={place} onSelect={props.onPlaceSelect} />
        ))}
      </MapContainer>
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
