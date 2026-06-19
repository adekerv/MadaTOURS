import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { List } from 'lucide-react';
import { MapComponent } from './MapComponent';
import { Place, UserLocation, User } from '../types';
import { PlaceDetailModal } from './PlaceDetailModal';
import { Header } from './exploration/Header';
import { Sidebar } from './exploration/Sidebar';
import { LocationPrompt } from './exploration/LocationPrompt';
import { SelectedPlaceOverlay } from './exploration/SelectedPlaceOverlay';
import { calculateDistance } from '../lib/places-utils';
import placesJson from '../data/places.json';

interface ExplorationPageProps {
  onBack: () => void;
  favorites: Place[];
  onToggleFavorite: (place: Place) => void;
  revisits: Place[];
  onToggleRevisit: (place: Place) => void;
  user: User | null;
  onLoginClick: () => void;
  onAdminClick: () => void;
  initialParams?: {
    filter: 'all' | 'restaurant' | 'activity';
    radius?: number;
    sortBy?: 'rating' | 'hiking' | 'entertainment';
    selectedPlaceId?: number;
  } | null;
}

export const ExplorationPage: React.FC<ExplorationPageProps> = ({ 
  onBack, 
  favorites, 
  onToggleFavorite,
  revisits,
  onToggleRevisit,
  user,
  onLoginClick,
  onAdminClick,
  initialParams
}) => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(() => {
    if (initialParams) {
      if (initialParams.selectedPlaceId) {
        const place = (placesJson as Place[]).find(p => p.id === initialParams.selectedPlaceId);
        if (place) {
          return { lat: place.lat, lng: place.lng, manual: true };
        }
      }
      return { lat: 14.6415, lng: -61.0242, manual: false }; // Center of Martinique
    }
    return null;
  });
  const [showLocationPrompt, setShowLocationPrompt] = useState(() => {
    return !initialParams;
  });
  const [places, setPlaces] = useState<Place[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'restaurant' | 'activity'>(() => {
    return initialParams?.filter || 'all';
  });
  const [radius, setRadius] = useState<number>(() => {
    return initialParams?.radius || 10;
  });
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'hiking' | 'entertainment'>(() => {
    return initialParams?.sortBy || 'default';
  });
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(() => {
    if (initialParams?.selectedPlaceId) {
      return (placesJson as Place[]).find(p => p.id === initialParams.selectedPlaceId) || null;
    }
    return null;
  });
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Auto-close sidebar on mobile when a place is selected on map
  useEffect(() => {
    if (selectedPlace && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [selectedPlace]);

  useEffect(() => {
    if (userLocation) {
      fetchPlaces();
    }
  }, [userLocation, radius]);

  const fetchPlaces = async () => {
    if (!userLocation) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/places?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${radius}`);
      if (!resp.ok) {
        throw new Error(`API returned status ${resp.status}`);
      }
      const data = await resp.json();
      setPlaces(data);
    } catch (err) {
      console.warn('API fetch failed, falling back to local client-side calculation:', err);
      // Fail-safe client-side calculation fallback
      const filtered = (placesJson as Place[]).map((place) => {
        const distance = calculateDistance(userLocation.lat, userLocation.lng, place.lat, place.lng);
        return { ...place, distance };
      }).filter((place) => place.distance <= radius);
      setPlaces(filtered);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setUserLocation({ lat, lng, manual: true });
    setShowLocationPrompt(false);
    setGeoError(null);
    setGeoLoading(false);
  };

  const getUserGeolocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError("Geolocation is not supported by your browser. Please select 'Set Manually on Map'.");
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          manual: false
        });
        setGeoLoading(false);
        setGeoError(null);
        setShowLocationPrompt(false);
      },
      async (err) => {
        console.warn("Browser HTML5 Geolocation failed, trying IP geolocation fallback...", err);
        
        try {
          // Attempt IP geolocation as an intelligent background fallback
          const resp = await fetch('https://ipapi.co/json/');
          if (resp.ok) {
            const data = await resp.json();
            if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
              setUserLocation({
                lat: data.latitude,
                lng: data.longitude,
                manual: false
              });
              setGeoLoading(false);
              setGeoError(null);
              setShowLocationPrompt(false);
              return;
            }
          }
        } catch (ipErr) {
          console.error("IP geolocation fallback also failed:", ipErr);
        }

        setGeoLoading(false);
        let errorMsg = "Could not detect your location automatically. Please check your browser location permission settings, or choose 'Set Manually on Map' below.";
        if (err.code === 1) { // PERMISSION_DENIED
          errorMsg = "Location access was denied. Please click 'Set Manually on Map' or enable location permissions in your browser URL bar and try again.";
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          errorMsg = "Your network or device location could not be determined. Please set your location manually on the map.";
        } else if (err.code === 3) { // TIMEOUT
          errorMsg = "Location request timed out. Please try again or select 'Set Manually on Map'.";
        }
        setGeoError(errorMsg);
      },
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 300000
      }
    );
  };

  const filteredPlaces = (() => {
    let list = filter === 'all' 
      ? places 
      : places.filter(p => p.type === filter);

    if (sortBy === 'rating') {
      return [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'hiking') {
      return list
        .filter(p => p.tags?.some(t => {
          const l = t.toLowerCase();
          return l.includes('hike') || l === 'volcano' || l === 'mountain' || l === 'trail';
        }))
        .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'entertainment') {
      return list
        .filter(p => p.tags?.some(t => {
          const l = t.toLowerCase();
          return l.includes('cinema') || l.includes('bowling') || l.includes('karting') || l.includes('laser tag') || l.includes('extracurricular') || l.includes('entertainment') || l.includes('play');
        }))
        .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    return list;
  })();

  const isFavorite = (placeId: number) => favorites.some(f => f.id === placeId);
  const isRevisit = (placeId: number) => revisits.some(r => r.id === placeId);

  const getGoogleMapsUrl = (place: Place) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.location} Martinique`)}`;
  };

  const handleMapClick = () => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    setSelectedPlace(null);
  };

  return (
    <div className="h-screen flex flex-col font-sans bg-sky-50 overflow-hidden relative">
      {/* Sidebar Toggle Button (Floating - Mobile Only) */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.button 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-[5rem] left-4 md:hidden z-40 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-slate-800 border-2 border-orange-100 transition-all active:scale-95 border-opacity-50"
          >
            <List size={20} />
          </motion.button>
        )}
      </AnimatePresence>

      <Header 
        onBack={onBack}
        userLocation={userLocation}
        onGetLocation={getUserGeolocation}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          filter={filter}
          setFilter={(f) => {
            setFilter(f);
            setSortBy('default');
          }}
          radius={radius}
          setRadius={setRadius}
          userLocation={userLocation}
          loading={loading}
          filteredPlaces={filteredPlaces}
          selectedPlace={selectedPlace}
          onPlaceSelect={setSelectedPlace}
          onShowDetails={(place) => {
            setSelectedPlace(place);
            setIsDetailModalOpen(true);
          }}
          isFavorite={isFavorite}
          onResetRadar={() => {
            setUserLocation(null);
            setShowLocationPrompt(true);
            setSortBy('default');
            setGeoError(null);
            setGeoLoading(false);
          }}
          sortBy={sortBy}
          setSortBy={setSortBy}
          onRefreshPlaces={fetchPlaces}
          user={user}
          onAdminClick={onAdminClick}
        />

        {/* Map Area */}
        <main className="flex-1 relative bg-slate-100">
          <MapComponent 
            userLocation={userLocation} 
            places={filteredPlaces} 
            onLocationSelect={handleLocationSelect}
            onPlaceSelect={setSelectedPlace}
            onMapClick={handleMapClick}
            radius={radius}
            selectedPlace={selectedPlace}
          />

          <LocationPrompt 
            isVisible={showLocationPrompt && !userLocation}
            onGetGeolocation={getUserGeolocation}
            onManualSelect={() => {
              setShowLocationPrompt(false);
              setGeoError(null);
              setGeoLoading(false);
            }}
            isLoading={geoLoading}
            error={geoError}
          />

          <SelectedPlaceOverlay 
            place={selectedPlace}
            isVisible={!!selectedPlace && !isDetailModalOpen}
            onClose={() => setSelectedPlace(null)}
            isFavorite={selectedPlace ? isFavorite(selectedPlace.id) : false}
            onToggleFavorite={onToggleFavorite}
            onShowDetails={() => setIsDetailModalOpen(true)}
            googleMapsUrl={selectedPlace ? getGoogleMapsUrl(selectedPlace) : ''}
            user={user}
            onLoginClick={onLoginClick}
          />
        </main>
      </div>

      <PlaceDetailModal 
        place={selectedPlace && isDetailModalOpen ? selectedPlace : null}
        onClose={() => setIsDetailModalOpen(false)}
        isFavorite={selectedPlace ? isFavorite(selectedPlace.id) : false}
        onToggleFavorite={onToggleFavorite}
        isRevisit={selectedPlace ? isRevisit(selectedPlace.id) : false}
        onToggleRevisit={onToggleRevisit}
        user={user}
        onLoginClick={onLoginClick}
        googleMapsUrl={selectedPlace ? getGoogleMapsUrl(selectedPlace) : ''}
      />
    </div>
  );
};
