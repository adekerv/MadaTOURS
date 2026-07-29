import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../src/lib/db-server';
import { calculateDistance } from '../src/lib/places-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { lat, lng, radius } = req.query;
    try {
      const placesData = await query('SELECT * FROM places');

      if (!lat || !lng) {
        return res.status(200).json(placesData);
      }

      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const searchRadius = parseFloat(radius as string) || 10;

      const filteredPlaces = (placesData as any[]).map((place) => {
        const distance = calculateDistance(userLat, userLng, place.lat, place.lng);
        return { ...place, distance };
      }).filter((place) => place.distance <= searchRadius);

      return res.status(200).json(filteredPlaces);
    } catch (error) {
      console.error('API Places GET Error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  if (req.method === 'POST') {
    const { name, type, lat, lng, location, description, rating, hours, tags, image } = req.body || {};

    if (!name || !type || !lat || !lng || !location) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : String(tags || '');
      const sql = 'INSERT INTO places (name, type, lat, lng, location, description, rating, hours, tags, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      const parameters = [
        name,
        type,
        parseFloat(lat),
        parseFloat(lng),
        location,
        description || '',
        parseFloat(rating || '5.0'),
        hours || '9:00 AM - 10:00 PM',
        tagsStr,
        image || 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80'
      ];

      await query(sql, parameters);
      return res.status(201).json({ success: true, message: 'Location added successfully!' });
    } catch (error) {
      console.error('API Places POST Error:', error);
      return res.status(500).json({ error: 'Failed to insert place.' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    try {
      await query('DELETE FROM places WHERE id = ?', [parseInt(id as string)]);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete place' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
