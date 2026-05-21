import placesJson from '../data/places.json';

export interface Place {
  id: number;
  name: string;
  type: 'restaurant' | 'activity';
  location: string;
  description: string;
  lat: number;
  lng: number;
  distance?: number;
  rating?: number;
  hours?: string;
  tags?: string[];
  image?: string;
}

export function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

export async function getPlacesData(): Promise<Place[]> {
  // Return imported JSON directly (bundled by build tools)
  return placesJson as Place[];
}
