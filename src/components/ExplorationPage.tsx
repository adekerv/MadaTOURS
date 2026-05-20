import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { List } from 'lucide-react';
import { MapComponent } from './MapComponent';
import { Place, UserLocation } from '../types';
import { PlaceDetailModal } from './PlaceDetailModal';
import { Header } from './exploration/Header';
import { Sidebar } from './exploration/Sidebar';
import { LocationPrompt } from './exploration/LocationPrompt';
import { SelectedPlaceOverlay } from './exploration/SelectedPlaceOverlay';

interface ExplorationPageProps {
  onBack: () => void;
  favorites: Place[];
  onToggleFavorite: (place: Place) => void;
}

export const ExplorationPage: React.FC<ExplorationPageProps> = ({ 
  onBack, 
  favorites, 
  onToggleFavorite 
}) => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [places, setPlaces] = useState<Place[]>([]);
  const [filter, setFilter] = useState<'all' | 'restaurant' | 'activity'>('all');
  const [radius, setRadius] = useState(10);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
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
      const data = await resp.json();
      setPlaces(data);
    } catch (err) {
      console.error('Failed to fetch places', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setUserLocation({ lat, lng, manual: true });
    setShowLocationPrompt(false);
  };

  const getUserGeolocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            manual: false
          });
          setShowLocationPrompt(false);
        },
        (err) => {
          console.error(err);
          alert("Could not get your location automatically. Please tap on the map to set it manually.");
        }
      );
    }
  };

  const filteredPlaces = filter === 'all' 
    ? places 
    : places.filter(p => p.type === filter);

  const isFavorite = (placeId: number) => favorites.some(f => f.id === placeId);

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
          setFilter={setFilter}
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
          }}
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
          />

          <LocationPrompt 
            isVisible={showLocationPrompt && !userLocation}
            onGetGeolocation={getUserGeolocation}
            onManualSelect={() => setShowLocationPrompt(false)}
          />

          <SelectedPlaceOverlay 
            place={selectedPlace}
            isVisible={!!selectedPlace && !isDetailModalOpen}
            onClose={() => setSelectedPlace(null)}
            isFavorite={selectedPlace ? isFavorite(selectedPlace.id) : false}
            onToggleFavorite={onToggleFavorite}
            onShowDetails={() => setIsDetailModalOpen(true)}
            googleMapsUrl={selectedPlace ? getGoogleMapsUrl(selectedPlace) : ''}
          />
        </main>
      </div>

      <PlaceDetailModal 
        place={selectedPlace && isDetailModalOpen ? selectedPlace : null}
        onClose={() => setIsDetailModalOpen(false)}
        isFavorite={selectedPlace ? isFavorite(selectedPlace.id) : false}
        onToggleFavorite={onToggleFavorite}
        googleMapsUrl={selectedPlace ? getGoogleMapsUrl(selectedPlace) : ''}
      />
    </div>
  );
};
