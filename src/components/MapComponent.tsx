import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Place, UserLocation } from '../types';
import { Utensils, Mountain, MapPin } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

// Fix for default marker icons in React Leaflet
import 'leaflet/dist/leaflet.css';

const createCustomIcon = (type: 'restaurant' | 'activity' | 'user') => {
  const color = type === 'user' ? '#2563eb' : '#f97316'; // Blue 600 for user, Orange 500 for places
  const emoji = type === 'restaurant' ? '🍴' : type === 'activity' ? '🏄' : null;
  
  const markerHtml = type === 'user' ? `
    <div class="relative flex flex-col items-center">
      <div class="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-20"></div>
      <div class="w-8 h-8 bg-blue-600 border-4 border-white rounded-full shadow-2xl z-20"></div>
    </div>
  ` : `
    <div class="w-8 h-8 bg-orange-500 border-2 border-white rounded-full rounded-bl-none rotate-45 shadow-lg flex items-center justify-center">
      <span class="-rotate-45 text-xs">${emoji}</span>
    </div>
  `;

  return L.divIcon({
    html: markerHtml,
    className: 'custom-vibrant-icon',
    iconSize: type === 'user' ? [32, 32] : [32, 32],
    iconAnchor: type === 'user' ? [16, 16] : [16, 32], // Bottom center tip
  });
};

interface MapComponentProps {
  userLocation: UserLocation | null;
  places: Place[];
  onLocationSelect: (lat: number, lng: number) => void;
  onPlaceSelect: (place: Place) => void;
  onMapClick?: () => void;
  radius?: number;
}

// Component to handle map centering and clicks for manual input
const MapHandler: React.FC<{ 
  userLocation: UserLocation | null, 
  onLocationSelect: (lat: number, lng: number) => void,
  onMapClick?: () => void
}> = ({ userLocation, onLocationSelect, onMapClick }) => {
  const map = useMap();

  useEffect(() => {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 13);
    }
  }, [userLocation, map]);

  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
      onMapClick?.();
    },
  });

  return null;
};

export const MapComponent: React.FC<MapComponentProps> = ({ 
  userLocation, 
  places, 
  onLocationSelect,
  onPlaceSelect,
  onMapClick,
  radius = 10
}) => {
  const martiniqueCenter: [number, number] = [14.6415, -61.0242];

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        center={martiniqueCenter}
        zoom={11}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapHandler userLocation={userLocation} onLocationSelect={onLocationSelect} onMapClick={onMapClick} />

        {userLocation && (
          <>
            <Marker 
              position={[userLocation.lat, userLocation.lng]} 
              icon={createCustomIcon('user')}
            >
              <Popup>
                <div className="font-bold">Your Location</div>
                <div className="text-xs text-gray-500">Tap anywhere to move this</div>
              </Popup>
            </Marker>
            
            <Circle 
              center={[userLocation.lat, userLocation.lng]}
              radius={radius * 1000} // Convert km to meters
              pathOptions={{
                color: '#f97316',
                fillColor: '#f97316',
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '5, 10'
              }}
            />
          </>
        )}

        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={createCustomIcon(place.type)}
            eventHandlers={{
              click: () => onPlaceSelect(place),
            }}
          >
            <Popup>
              <div className="p-1">
                <h3 className="font-bold text-lg text-brand-primary">{place.name}</h3>
                <p className="text-sm italic">{place.location}</p>
                {place.distance && (
                  <p className="text-xs font-semibold text-brand-secondary mt-1">
                    {place.distance.toFixed(1)} km away
                  </p>
                )}
                <button 
                  onClick={() => onPlaceSelect(place)}
                  className="mt-2 w-full bg-brand-primary text-white text-xs py-2 rounded-lg font-bold"
                >
                  View Details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {!userLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-gray-100 animate-pulse">
          <p className="text-sm font-semibold text-brand-primary">Tap on the map to set your location</p>
        </div>
      )}
    </div>
  );
};
