import type { VercelRequest, VercelResponse } from '@vercel/node';
import placesJson from '../src/data/places.json';

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { lat, lng, radius } = req.query;
  
  try {
    if (!lat || !lng) {
      return res.status(200).json(placesJson);
    }

    const userLat = parseFloat(lat as string);
    const userLng = parseFloat(lng as string);
    const searchRadius = parseFloat(radius as string) || 10;

    const filteredPlaces = (placesJson as any[]).map((place) => {
      const distance = calculateDistance(userLat, userLng, place.lat, place.lng);
      return { ...place, distance };
    }).filter((place) => place.distance <= searchRadius);

    return res.status(200).json(filteredPlaces);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
