import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { calculateDistance, getPlacesData } from './src/lib/places-utils';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get('/api/places', (req, res) => {
    const { lat, lng, radius } = req.query;
    
    try {
      const placesData = getPlacesData();
      
      if (!lat || !lng) {
        return res.json(placesData);
      }

      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const searchRadius = parseFloat(radius as string) || 10;

      const filteredPlaces = placesData.map((place) => {
        const distance = calculateDistance(userLat, userLng, place.lat, place.lng);
        return { ...place, distance };
      }).filter((place) => place.distance <= searchRadius);

      res.json(filteredPlaces);
    } catch (error) {
      console.error('Local API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
