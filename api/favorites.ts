import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../src/lib/db-server';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      const favList = await query('SELECT * FROM user_favorites WHERE user_id = ?', [parseInt(userId as string)]);
      const placesData = await query('SELECT * FROM places');
      const mappedPlaces = placesData.filter((p: any) => favList.some((f: any) => f.place_id === p.id));
      return res.status(200).json(mappedPlaces);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to query user_favorites' });
    }
  }

  if (req.method === 'POST') {
    const { userId, placeId } = req.body || {};
    if (!userId || !placeId) {
      return res.status(400).json({ error: 'userId and placeId are required' });
    }

    try {
      await query('INSERT INTO user_favorites (user_id, place_id) VALUES (?, ?)', [
        parseInt(userId),
        parseInt(placeId)
      ]);
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to insert favorite' });
    }
  }

  if (req.method === 'DELETE') {
    const { userId, placeId } = req.query;
    if (!userId || !placeId) {
      return res.status(400).json({ error: 'userId and placeId are required' });
    }

    try {
      await query('DELETE FROM user_favorites WHERE user_id = ? AND place_id = ?', [
        parseInt(userId as string),
        parseInt(placeId as string)
      ]);
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to delete favorite' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
