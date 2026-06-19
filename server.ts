import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { calculateDistance } from './src/lib/places-utils';
import { query } from './src/lib/db-server';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  
  /**
   * GET /api/places
   * 
   * PHP SQL Equivalent:
   * ---------------
   * $stmt = $pdo->prepare("SELECT * FROM places");
   * $stmt->execute();
   * $placesData = $stmt->fetchAll(PDO::FETCH_ASSOC);
   */
  app.get('/api/places', async (req, res) => {
    const { lat, lng, radius } = req.query;
    
    try {
      // Execute standard SQL SELECT query matching relational architecture
      const placesData = await query('SELECT * FROM places');
      
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
      console.error('SQL SELECT API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/places
   * 
   * PHP SQL Equivalent:
   * ---------------
   * $stmt = $pdo->prepare("INSERT INTO places (name, type, lat, lng, location, description, rating, hours, tags, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
   * $stmt->execute([$name, $type, $lat, $lng, $location, $description, $rating, $hours, $tags, $image]);
   * echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
   */
  app.post('/api/places', async (req, res) => {
    const { name, type, lat, lng, location, description, rating, hours, tags, image } = req.body;

    if (!name || !type || !lat || !lng || !location) {
      return res.status(400).json({ error: 'Missing required fields (name, type, lat, lng, location)' });
    }

    try {
      const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : String(tags || '');

      // Execute SQL INSERT query
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

      res.status(201).json({ 
        success: true, 
        message: 'Location added successfully using SQL raw queries!' 
      });
    } catch (error) {
      console.error('SQL INSERT API Error:', error);
      res.status(500).json({ error: 'Failed to insert place.' });
    }
  });

  /**
   * POST /api/auth/register
   * 
   * PHP SQL Equivalent:
   * ---------------
   * $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
   * $stmt->execute([$email]);
   * if ($stmt->fetch()) { die("Email already registered"); }
   * 
   * $stmt = $pdo->prepare("INSERT INTO users (email, password, role) VALUES (?, ?, ?)");
   * $stmt->execute([$email, $password, $role]);
   */
  app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      const existing = await query('SELECT * FROM users WHERE email = ?', [email]);
      if (existing && existing.length > 0) {
        return res.status(400).json({ error: 'Email is already registered.' });
      }

      // Elevate admin status automatically for designated email
      const normalizedEmail = email.toLowerCase().trim();
      const role = normalizedEmail.includes('admin') ? 'admin' : 'user';

      await query('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [
        normalizedEmail,
        password,
        role
      ]);

      const insertedUserList = await query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
      const newUser = insertedUserList[0];

      res.status(201).json({
        success: true,
        user: { id: newUser.id, email: newUser.email, role: newUser.role }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Registration failed' });
    }
  });

  /**
   * POST /api/auth/login
   * 
   * PHP SQL Equivalent:
   * ---------------
   * $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND password = ?");
   * $stmt->execute([$email, $password]);
   * $user = $stmt->fetch();
   */
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const users = await query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
      
      if (!users || users.length === 0) {
        return res.status(401).json({ error: 'Account not found.' });
      }

      const userObj = users[0];
      if (userObj.password !== password) {
        return res.status(401).json({ error: 'Invalid password.' });
      }

      res.json({
        success: true,
        user: { id: userObj.id, email: userObj.email, role: userObj.role }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Login failed' });
    }
  });

  /**
   * GET /api/favorites
   * 
   * PHP SQL Equivalent:
   * ---------------
   * $stmt = $pdo->prepare("SELECT * FROM user_favorites WHERE user_id = ?");
   * $stmt->execute([$userId]);
   */
  app.get('/api/favorites', async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      const favList = await query('SELECT * FROM user_favorites WHERE user_id = ?', [parseInt(userId as string)]);
      const placesData = await query('SELECT * FROM places');
      
      const mappedPlaces = placesData.filter(p => favList.some((f: any) => f.place_id === p.id));
      res.json(mappedPlaces);
    } catch (err) {
      res.status(500).json({ error: 'Failed to query user_favorites table' });
    }
  });

  /**
   * POST /api/favorites
   */
  app.post('/api/favorites', async (req, res) => {
    const { userId, placeId } = req.body;
    if (!userId || !placeId) {
      return res.status(400).json({ error: 'userId and placeId are required' });
    }

    try {
      await query('INSERT INTO user_favorites (user_id, place_id) VALUES (?, ?)', [
        parseInt(userId),
        parseInt(placeId)
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to insert to user_favorites' });
    }
  });

  /**
   * DELETE /api/favorites
   */
  app.delete('/api/favorites', async (req, res) => {
    const { userId, placeId } = req.query;
    if (!userId || !placeId) {
      return res.status(400).json({ error: 'userId and placeId are required' });
    }

    try {
      await query('DELETE FROM user_favorites WHERE user_id = ? AND place_id = ?', [
        parseInt(userId as string),
        parseInt(placeId as string)
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete from user_favorites' });
    }
  });

  /**
   * GET /api/revisits
   */
  app.get('/api/revisits', async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      const revList = await query('SELECT * FROM user_revisits WHERE user_id = ?', [parseInt(userId as string)]);
      const placesData = await query('SELECT * FROM places');
      
      const mappedPlaces = placesData.filter(p => revList.some((r: any) => r.place_id === p.id));
      res.json(mappedPlaces);
    } catch (err) {
      res.status(500).json({ error: 'Failed to query user_revisits table' });
    }
  });

  /**
   * POST /api/revisits
   */
  app.post('/api/revisits', async (req, res) => {
    const { userId, placeId } = req.body;
    if (!userId || !placeId) {
      return res.status(400).json({ error: 'userId and placeId are required' });
    }

    try {
      await query('INSERT INTO user_revisits (user_id, place_id) VALUES (?, ?)', [
        parseInt(userId),
        parseInt(placeId)
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to insert to user_revisits' });
    }
  });

  /**
   * DELETE /api/revisits
   */
  app.delete('/api/revisits', async (req, res) => {
    const { userId, placeId } = req.query;
    if (!userId || !placeId) {
      return res.status(400).json({ error: 'userId and placeId are required' });
    }

    try {
      await query('DELETE FROM user_revisits WHERE user_id = ? AND place_id = ?', [
        parseInt(userId as string),
        parseInt(placeId as string)
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete from user_revisits' });
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
