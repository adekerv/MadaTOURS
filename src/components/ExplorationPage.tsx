import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { List, Map as MapIcon } from 'lucide-react';
import { MapComponent } from './MapComponent';
import { PlaceDetailModal } from './PlaceDetailModal';
import { Header } from './exploration/Header';
import { Sidebar } from './exploration/Sidebar';
import { LocationPrompt } from './exploration/LocationPrompt';
import { SelectedPlaceOverlay } from './exploration/SelectedPlaceOverlay';
import { calculateDistance, mapsUrl, matchesInterest, matchesSearch } from '../lib/places-utils';
import type { ExploreParams, Place, UserLocation, User } from '../types';
interface Props {
  onBack: () => void;
  places: Place[];
  catalogueStatus: 'loading' | 'live' | 'offline';
  onRefreshPlaces: () => void;
  favorites: Place[];
  revisits: Place[];
  onToggleFavorite: (place: Place) => void;
  onToggleRevisit: (place: Place) => void;
  user: User | null;
  onLoginClick: () => void;
  onAdminClick: () => void;
  initialParams: ExploreParams;
}
const islandCenter: UserLocation = { lat: 14.6415, lng: -61.0242, manual: true };
export function ExplorationPage({
  onBack,
  places,
  catalogueStatus,
  onRefreshPlaces,
  favorites,
  revisits,
  onToggleFavorite,
  onToggleRevisit,
  user,
  onLoginClick,
  onAdminClick,
  initialParams,
}: Props) {
  const initialPlace = places.find((place) => place.id === initialParams.selectedPlaceId);
  const [center, setCenter] = useState<UserLocation>(
    initialPlace ? { lat: initialPlace.lat, lng: initialPlace.lng, manual: true } : islandCenter,
  );
  const resolvedInitialSelection = useRef(!!initialPlace || !initialParams.selectedPlaceId);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialParams.selectedPlaceId ?? null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [filter, setFilter] = useState(initialParams.filter);
  const [radius, setRadius] = useState(initialParams.radius ?? 50);
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'hiking' | 'entertainment'>(
    initialParams.sortBy ?? 'default',
  );
  const [query, setQuery] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'map'>(initialPlace ? 'map' : 'list');
  const locationRequest = useRef(0);
  useEffect(
    () => () => {
      locationRequest.current += 1;
    },
    [],
  );
  // Resolve selections against the shared catalogue, including places added by an administrator.
  const selectedPlace = places.find((place) => place.id === selectedId) ?? null;
  useEffect(() => {
    if (!resolvedInitialSelection.current && selectedPlace) {
      resolvedInitialSelection.current = true;
      setCenter({ lat: selectedPlace.lat, lng: selectedPlace.lng, manual: true });
      setMobileView('map');
    }
  }, [selectedPlace]);
  const filtered = useMemo(
    () =>
      places
        .map((place) => ({
          ...place,
          distance: calculateDistance(center.lat, center.lng, place.lat, place.lng),
        }))
        .filter(
          (place) =>
            place.distance <= radius &&
            (filter === 'all' || place.type === filter) &&
            matchesInterest(place, sortBy) &&
            matchesSearch(place, query),
        )
        .sort((a, b) =>
          sortBy === 'rating'
            ? (b.rating ?? -1) - (a.rating ?? -1) || a.distance - b.distance
            : a.distance - b.distance,
        ),
    [places, center, radius, filter, sortBy, query],
  );
  function selectPlace(place: Place) {
    setSelectedId(place.id);
    setMobileView('map');
    setManual(false);
  }
  function reset() {
    locationRequest.current += 1;
    setCenter(islandCenter);
    setRadius(100);
    setQuery('');
    setFilter('all');
    setSortBy('default');
    setSelectedId(null);
    setManual(false);
    setGeoLoading(false);
    setGeoError('');
  }
  async function getLocation() {
    const request = ++locationRequest.current;
    setGeoLoading(true);
    setGeoError('');
    try {
      const position = Capacitor.isNativePlatform()
        ? await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000,
          })
        : await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error('Location is not supported.'));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 60000,
            });
          });
      if (request !== locationRequest.current) return;
      setCenter({ lat: position.coords.latitude, lng: position.coords.longitude, manual: false });
      setSelectedId(null);
      setLocationOpen(false);
      setManual(false);
    } catch {
      if (request === locationRequest.current)
        setGeoError(
          'Could not access your location. Check device permissions, choose a point on the map, or browse Martinique without sharing your location.',
        );
    } finally {
      if (request === locationRequest.current) setGeoLoading(false);
    }
  }
  return (
    <div className="explore-shell flex flex-col bg-slate-50">
      <Header onBack={onBack} userLocation={center} onGetLocation={() => setLocationOpen(true)} />
      <main id="main-content" className="relative flex min-h-0 flex-1" tabIndex={-1}>
        <div className={`explore-list ${mobileView === 'list' ? 'mobile-active' : ''}`}>
          <Sidebar
            filter={filter}
            setFilter={(value) => {
              setFilter(value);
              setSortBy('default');
              setSelectedId(null);
            }}
            radius={radius}
            setRadius={(value) => {
              setRadius(value);
              setSelectedId(null);
            }}
            loading={catalogueStatus === 'loading'}
            filteredPlaces={filtered}
            selectedPlace={selectedPlace}
            onPlaceSelect={selectPlace}
            onShowDetails={(place) => {
              setSelectedId(place.id);
              setDetailOpen(true);
            }}
            isFavorite={(id) => favorites.some((place) => place.id === id)}
            onResetRadar={reset}
            sortBy={sortBy}
            setSortBy={(value) => {
              setSortBy(value);
              setSelectedId(null);
            }}
            query={query}
            setQuery={(value) => {
              setQuery(value);
              setSelectedId(null);
            }}
            user={user}
            onAdminClick={onAdminClick}
            manual={center.manual ?? true}
          />
        </div>
        <div className={`explore-map ${mobileView === 'map' ? 'mobile-active' : ''}`}>
          <MapComponent
            userLocation={center}
            places={filtered}
            radius={radius}
            selectedPlace={selectedPlace}
            manualSelect={manual}
            onLocationSelect={(lat, lng) => {
              locationRequest.current += 1;
              setCenter({ lat, lng, manual: true });
              setManual(false);
              setSelectedId(null);
            }}
            onPlaceSelect={selectPlace}
            onMapClick={() => setSelectedId(null)}
          />
          {manual && (
            <div role="status" className="map-hint">
              Tap a point on the map to search nearby.
              <button className="font-semibold underline" onClick={() => setManual(false)}>
                Cancel
              </button>
            </div>
          )}
          <SelectedPlaceOverlay
            place={selectedPlace}
            isVisible={!!selectedPlace && !detailOpen && !manual}
            onClose={() => setSelectedId(null)}
            isFavorite={favorites.some((place) => place.id === selectedId)}
            onToggleFavorite={onToggleFavorite}
            onShowDetails={() => setDetailOpen(true)}
            googleMapsUrl={selectedPlace ? mapsUrl(selectedPlace) : ''}
            user={user}
            onLoginClick={onLoginClick}
          />
        </div>
      </main>
      {catalogueStatus === 'offline' && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          <span>Connection unavailable. Showing the last loaded guide.</span>
          <button onClick={onRefreshPlaces} className="shrink-0 font-semibold underline">
            Retry
          </button>
        </div>
      )}
      <nav
        aria-label="Explore views"
        className="mobile-view-switch grid grid-cols-2 gap-2 border-t border-slate-200 bg-white px-4 pt-2 md:hidden"
      >
        <button
          aria-pressed={mobileView === 'list'}
          onClick={() => setMobileView('list')}
          className={`view-button ${mobileView === 'list' ? 'view-button-active' : ''}`}
        >
          <List size={19} />
          List
        </button>
        <button
          aria-pressed={mobileView === 'map'}
          onClick={() => setMobileView('map')}
          className={`view-button ${mobileView === 'map' ? 'view-button-active' : ''}`}
        >
          <MapIcon size={19} />
          Map
        </button>
      </nav>
      {locationOpen && (
        <LocationPrompt
          onClose={() => {
            locationRequest.current += 1;
            setLocationOpen(false);
            setGeoLoading(false);
          }}
          onGetGeolocation={() => void getLocation()}
          onManualSelect={() => {
            locationRequest.current += 1;
            setLocationOpen(false);
            setGeoLoading(false);
            setMobileView('map');
            setManual(true);
          }}
          onBrowseIsland={() => {
            reset();
            setLocationOpen(false);
          }}
          isLoading={geoLoading}
          error={geoError}
        />
      )}
      {selectedPlace && detailOpen && (
        <PlaceDetailModal
          place={selectedPlace}
          onClose={() => setDetailOpen(false)}
          isFavorite={favorites.some((place) => place.id === selectedId)}
          onToggleFavorite={onToggleFavorite}
          isRevisit={revisits.some((place) => place.id === selectedId)}
          onToggleRevisit={onToggleRevisit}
          user={user}
          onLoginClick={onLoginClick}
          googleMapsUrl={mapsUrl(selectedPlace)}
        />
      )}
    </div>
  );
}
