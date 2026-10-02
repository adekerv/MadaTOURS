import { useI18n } from '../i18n/I18nProvider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { List, Map as MapIcon, LocateFixed } from 'lucide-react';
import { MapComponent } from './MapComponent';
import { PlaceDetailModal } from './PlaceDetailModal';
import { Header } from './exploration/Header';
import { Sidebar } from './exploration/Sidebar';
import { LocationPrompt } from './exploration/LocationPrompt';
import { PlaceCarousel } from './exploration/PlaceCarousel';
import { MapToolbar } from './exploration/MapToolbar';
import { FilterControls } from './exploration/FilterControls';
import { Modal } from './ui/Modal';
import { calculateDistance, mapsUrl, matchesInterest, matchesSearch } from '../lib/places-utils';
import { exploreHash } from '../lib/explore-route';
import { catalogueTown, matchesExperience } from '../lib/catalogue';
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
  const { t } = useI18n();
  const initialPlace = places.find((place) => place.id === initialParams.selectedPlaceId);
  const [center, setCenter] = useState<UserLocation>(
    initialPlace ? { lat: initialPlace.lat, lng: initialPlace.lng, manual: true } : islandCenter,
  );
  const resolvedInitialSelection = useRef(!!initialPlace || !initialParams.selectedPlaceId);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialParams.selectedPlaceId ?? null,
  );
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  // The carousel keeps its order while you swipe through it; only a pin or list pick re-centres it.
  const [anchorId, setAnchorId] = useState<number | null>(initialParams.selectedPlaceId ?? null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [filter, setFilter] = useState(initialParams.filter);
  const [radius, setRadius] = useState(initialParams.radius ?? 50);
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'hiking' | 'entertainment'>(
    initialParams.sortBy ?? 'default',
  );
  const [query, setQuery] = useState(initialParams.query ?? '');
  const [town, setTown] = useState(initialParams.town ?? '');
  const [minRating, setMinRating] = useState(initialParams.minRating ?? 0);
  const [experience, setExperience] = useState(initialParams.experience ?? '');
  useEffect(() => {
    // Preserve browser Back while making the current filters and selection copyable.
    // Device coordinates stay private and are never written into the URL.
    const hash = exploreHash({
      filter,
      radius,
      sortBy: sortBy === 'default' ? undefined : sortBy,
      selectedPlaceId: selectedId ?? undefined,
      query,
      town,
      experience,
      minRating,
    });
    if (location.hash.startsWith('#explore') && location.hash !== hash)
      history.replaceState(history.state, '', hash);
  }, [filter, radius, sortBy, selectedId, query, town, experience, minRating]);
  const towns = useMemo(
    () =>
      [...new Set(places.map((place) => catalogueTown(place.location)))].sort((a, b) =>
        a.localeCompare(b, 'fr'),
      ),
    [places],
  );
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
            (!town || catalogueTown(place.location) === town) &&
            matchesExperience(place, experience) &&
            matchesInterest(place, sortBy) &&
            matchesSearch(place, query) &&
            (place.communityRating ?? 0) >= minRating,
        )
        .sort((a, b) =>
          sortBy === 'rating'
            ? (b.rating ?? -1) - (a.rating ?? -1) || a.distance - b.distance
            : a.distance - b.distance,
        ),
    [places, center, radius, filter, sortBy, query, town, experience, minRating],
  );
  function changeFilter(value: 'all' | 'restaurant' | 'activity') {
    setFilter(value);
    setSortBy('default');
    setSelectedId(null);
  }
  const filterProps = {
    minRating,
    setMinRating,
    filter,
    setFilter: changeFilter,
    radius,
    setRadius: (value: number) => {
      setRadius(value);
      setSelectedId(null);
    },
    sortBy,
    setSortBy: (value: typeof sortBy) => {
      setSortBy(value);
      setSelectedId(null);
    },
    query,
    setQuery: (value: string) => {
      setQuery(value);
      setSelectedId(null);
    },
    towns,
    town,
    setTown: (value: string) => {
      setTown(value);
      setSelectedId(null);
    },
    experience,
    setExperience: (value: string) => {
      setExperience(value);
      setSelectedId(null);
    },
    manual: center.manual ?? true,
  };
  const activeFilters = [
    filter !== 'all',
    !!town,
    !!experience,
    minRating > 0,
    !!query,
    sortBy !== 'default',
  ].filter(Boolean).length;
  const carousel = useMemo(() => {
    const anchor = places.find((place) => place.id === anchorId);
    if (!anchor) return [];
    const near = filtered
      .filter((place) => place.id !== anchor.id)
      .map((place) => ({
        place,
        gap: calculateDistance(anchor.lat, anchor.lng, place.lat, place.lng),
      }))
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 11)
      .map((item) => item.place);
    return [filtered.find((place) => place.id === anchor.id) ?? anchor, ...near];
  }, [places, filtered, anchorId]);
  function selectPlace(place: Place, fromCarousel = false) {
    if (!fromCarousel) setAnchorId(place.id);
    setSelectedId(place.id);
    setMobileView('map');
    setManual(false);
  }
  function reset() {
    locationRequest.current += 1;
    setCenter(islandCenter);
    setRadius(100);
    setQuery('');
    setTown('');
    setExperience('');
    setMinRating(0);
    setFilter('all');
    setSortBy('default');
    setSelectedId(null);
    setHoveredId(null);
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
      setSortBy('default');
      setMobileView('list');
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
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-orange-100 bg-orange-50 px-4 text-sm">
        <span className="text-orange-900">
          {t(
            center.manual ? 'Find your next stop nearby' : 'Sorted by distance from your location',
          )}
        </span>
        <button
          className="flex shrink-0 items-center gap-2 font-semibold text-orange-800"
          onClick={() => setLocationOpen(true)}
        >
          <LocateFixed size={17} />
          {t('Places near me')}
        </button>
      </div>
      <main id="main-content" className="relative flex min-h-0 flex-1" tabIndex={-1}>
        <div className={`explore-list ${mobileView === 'list' ? 'mobile-active' : ''}`}>
          <Sidebar
            {...filterProps}
            loading={catalogueStatus === 'loading'}
            filteredPlaces={filtered}
            selectedPlace={selectedPlace}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onPlaceSelect={selectPlace}
            onShowDetails={(place) => {
              setSelectedId(place.id);
              setDetailOpen(true);
            }}
            isFavorite={(id) => favorites.some((place) => place.id === id)}
            onResetRadar={reset}
            user={user}
            onAdminClick={onAdminClick}
          />
        </div>
        <div className={`explore-map ${mobileView === 'map' ? 'mobile-active' : ''}`}>
          <MapComponent
            userLocation={center}
            places={filtered}
            radius={radius}
            selectedPlace={selectedPlace}
            hoveredId={hoveredId}
            onHover={setHoveredId}
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
          {!manual && (
            <MapToolbar
              filter={filter}
              onFilterChange={changeFilter}
              onOpenFilters={() => setFiltersOpen(true)}
              activeFilters={activeFilters}
            />
          )}
          {manual && (
            <div role="status" className="map-hint">
              {t('Tap a point on the map to search nearby.')}
              <button className="font-semibold underline" onClick={() => setManual(false)}>
                {t('Cancel')}
              </button>
            </div>
          )}
          {selectedPlace && !detailOpen && !manual && (
            <PlaceCarousel
              places={
                carousel.some((place) => place.id === selectedPlace.id) ? carousel : [selectedPlace]
              }
              selectedId={selectedPlace.id}
              onSelect={(place) => selectPlace(place, true)}
              onClose={() => setSelectedId(null)}
              isFavorite={(id) => favorites.some((place) => place.id === id)}
              onToggleFavorite={onToggleFavorite}
              onShowDetails={() => setDetailOpen(true)}
              mapsUrl={mapsUrl}
              user={user}
              onLoginClick={onLoginClick}
            />
          )}
        </div>
      </main>
      {catalogueStatus === 'offline' && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          <span>{t('Connection unavailable. Showing the last loaded guide.')}</span>
          <button onClick={onRefreshPlaces} className="shrink-0 font-semibold underline">
            {t('Retry')}
          </button>
        </div>
      )}
      <nav
        aria-label={t('Explore views')}
        className="mobile-view-switch grid grid-cols-2 gap-2 border-t border-slate-200 bg-white px-4 pt-2 md:hidden"
      >
        <button
          aria-pressed={mobileView === 'list'}
          onClick={() => setMobileView('list')}
          className={`view-button ${mobileView === 'list' ? 'view-button-active' : ''}`}
        >
          <List size={19} />
          {t('List')}
        </button>
        <button
          aria-pressed={mobileView === 'map'}
          onClick={() => setMobileView('map')}
          className={`view-button ${mobileView === 'map' ? 'view-button-active' : ''}`}
        >
          <MapIcon size={19} />
          {t('Map')}
        </button>
      </nav>
      {filtersOpen && (
        <Modal title={t('Filters')} sheet onClose={() => setFiltersOpen(false)}>
          <div className="p-5">
            <FilterControls {...filterProps} />
            <button className="primary-button w-full" onClick={() => setFiltersOpen(false)}>
              {t('Show results')} ({filtered.length})
            </button>
          </div>
        </Modal>
      )}
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
          onRatingChanged={onRefreshPlaces}
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
