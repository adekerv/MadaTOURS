import type { VercelRequest, VercelResponse } from '@vercel/node';
import { calculateDistance, getPlacesData } from '../src/lib/places-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { lat, lng, radius } = req.query;
  
  try {
    const placesData = await getPlacesData();
    
    if (!lat || !lng) {
      return res.status(200).json(placesData);
    }

    const userLat = parseFloat(lat as string);
    const userLng = parseFloat(lng as string);
    const searchRadius = parseFloat(radius as string) || 10;

    const filteredPlaces = placesData.map((place) => {
      const distance = calculateDistance(userLat, userLng, place.lat, place.lng);
      return { ...place, distance };
    }).filter((place) => place.distance <= searchRadius);

    return res.status(200).json(filteredPlaces);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
