import express, { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { getDatabase, type Database } from './db';
import {
  createSession,
  digest,
  HttpError,
  rateLimit,
  readToken,
  requireUser,
  setSessionCookie,
  hashPassword,
  verifyPassword,
} from './security';
import { credentials, registration, placeInput, nearbyQuery, positiveId } from './validation';
import { calculateDistance, normalizePlace } from '../src/lib/places-utils';
import seedPlaces from '../src/data/places.json';
import type { Place, User } from '../src/types';

type Account = User & { password: string };
type Handler = (req: Request, res: Response) => Promise<unknown>;
const route = (handler: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(handler(req, res)).catch(next);
};

export function createApp(database?: Database) {
  const app = express();
  const db = () => (database ? Promise.resolve(database) : getDatabase());
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = req.headers.origin;
    const allowed = new Set(
      (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (process.env.APP_ORIGIN) allowed.add(process.env.APP_ORIGIN);
    // Same-origin web requests and explicitly configured native origins are supported.
    allowed.add(`${req.protocol}://${req.get('host')}`);
    if (origin && !allowed.has(origin))
      return res.status(403).json({ error: 'This origin is not allowed.' });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-MadaTours-Client');
      return res.status(204).end();
    }
    // A custom header prevents cross-site form submissions from using session cookies.
    if (!['GET', 'HEAD'].includes(req.method) && req.get('X-MadaTours-Client') !== '1') {
      return res.status(403).json({ error: 'Invalid request. Please reload and try again.' });
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));

  app.get(
    '/api/health',
    route(async (_req, res) => {
      const ready = await (
        await db()
      ).query("SELECT value FROM madatours_metadata WHERE key = 'catalogue_seeded'");
      if (!ready.length) throw new HttpError(503, 'The database has not been initialized.');
      res.json({ status: 'ok' });
    }),
  );
  app.get(
    '/api/places',
    route(async (req, res) => {
      const hasCoordinates =
        req.query.lat !== undefined ||
        req.query.lng !== undefined ||
        req.query.radius !== undefined;
      const nearby = hasCoordinates ? nearbyQuery.parse(req.query) : null;
      const readOnly =
        !database &&
        !process.env.DATABASE_URL &&
        !process.env.POSTGRES_URL &&
        (process.env.NODE_ENV === 'production' || process.env.VERCEL);
      const raw = readOnly
        ? seedPlaces
        : await (await db()).query<Place>('SELECT * FROM places ORDER BY id');
      let places = raw.map(normalizePlace);
      if (nearby)
        places = places
          .map((place) => ({
            ...place,
            distance: calculateDistance(nearby.lat, nearby.lng, place.lat, place.lng),
          }))
          .filter((place) => place.distance <= nearby.radius)
          .sort((a, b) => a.distance - b.distance);
      res.json(places);
    }),
  );
  app.post(
    '/api/places',
    route(async (req, res) => {
      const connection = await db();
      const user = await requireUser(connection, req);
      if (user.role !== 'admin') throw new HttpError(403, 'Only administrators can manage places.');
      const p = placeInput.parse(req.body);
      const [place] = await connection.query<Place>(
        `INSERT INTO places (name,type,lat,lng,location,description,rating,hours,tags,image)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          p.name,
          p.type,
          p.lat,
          p.lng,
          p.location,
          p.description,
          p.rating ?? null,
          p.hours ?? null,
          JSON.stringify(p.tags),
          p.image ?? null,
        ],
      );
      res.status(201).json(normalizePlace(place));
    }),
  );
  app.delete(
    '/api/places/:id',
    route(async (req, res) => {
      const connection = await db();
      if ((await requireUser(connection, req)).role !== 'admin')
        throw new HttpError(403, 'Only administrators can manage places.');
      const id = positiveId.parse(req.params.id);
      const deleted = await connection.query('DELETE FROM places WHERE id = $1 RETURNING id', [id]);
      if (!deleted.length) throw new HttpError(404, 'This place could not be found.');
      res.json({ success: true });
    }),
  );

  for (const action of ['register', 'login'] as const) {
    app.post(
      `/api/auth/${action}`,
      route(async (req, res) => {
        const connection = await db();
        const input = (action === 'register' ? registration : credentials).parse(req.body);
        // On Vercel, use its platform-controlled forwarding header; never trust arbitrary forwarded headers locally.
        const ip = process.env.VERCEL ? req.get('x-vercel-forwarded-for') || req.ip : req.ip;
        await rateLimit(connection, `auth-ip:${ip}`, 30);
        await rateLimit(connection, `auth-email:${input.email}`, 10);
        let account: Account;
        if (action === 'register') {
          const password = await hashPassword(input.password);
          const [created] = await connection.query<Account>(
            `INSERT INTO users (email,password,role) VALUES ($1,$2,'user') ON CONFLICT (email) DO NOTHING RETURNING *`,
            [input.email, password],
          );
          if (!created)
            throw new HttpError(409, 'An account with this email already exists. Please sign in.');
          account = created;
        } else {
          const [found] = await connection.query<Account>('SELECT * FROM users WHERE email = $1', [
            input.email,
          ]);
          const dummy = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
          if (!(await verifyPassword(input.password, found?.password || dummy)) || !found)
            throw new HttpError(401, 'Incorrect email or password.');
          account = found;
        }
        await createSession(connection, req, res, account.id);
        res
          .status(action === 'register' ? 201 : 200)
          .json({ user: { id: account.id, email: account.email, role: account.role } });
      }),
    );
  }
  app.get(
    '/api/auth/session',
    route(async (req, res) => {
      if (!readToken(req)) return res.json({ user: null });
      try {
        res.json({ user: await requireUser(await db(), req) });
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
          setSessionCookie(res, '', true);
          return res.json({ user: null });
        }
        throw error;
      }
    }),
  );
  app.post(
    '/api/auth/logout',
    route(async (req, res) => {
      if (readToken(req))
        await (
          await db()
        ).query('DELETE FROM sessions WHERE token_hash = $1', [digest(readToken(req))]);
      setSessionCookie(res, '', true);
      res.json({ success: true });
    }),
  );
  app.delete(
    '/api/account',
    route(async (req, res) => {
      const connection = await db();
      const user = await requireUser(connection, req);
      await rateLimit(connection, `delete:${user.id}`, 10);
      const input = credentials.parse({ email: user.email, password: req.body?.password });
      const [account] = await connection.query<Account>('SELECT * FROM users WHERE id = $1', [
        user.id,
      ]);
      if (!account || !(await verifyPassword(input.password, account.password)))
        throw new HttpError(401, 'Incorrect password. Your account has not been deleted.');
      await connection.query('DELETE FROM users WHERE id = $1', [user.id]);
      setSessionCookie(res, '', true);
      res.json({ success: true });
    }),
  );
  for (const collection of ['favorites', 'revisits'] as const) {
    const table = `user_${collection}`; // Fixed internal names, never supplied by a request.
    app.get(
      `/api/${collection}`,
      route(async (req, res) => {
        const connection = await db();
        const user = await requireUser(connection, req);
        const places = await connection.query<Place>(
          `SELECT p.* FROM places p JOIN ${table} c ON c.place_id = p.id WHERE c.user_id = $1 ORDER BY p.name`,
          [user.id],
        );
        res.json(places.map(normalizePlace));
      }),
    );
    app.post(
      `/api/${collection}`,
      route(async (req, res) => {
        const connection = await db();
        const user = await requireUser(connection, req);
        const placeId = positiveId.parse(req.body?.placeId);
        if (!(await connection.query('SELECT id FROM places WHERE id = $1', [placeId])).length)
          throw new HttpError(404, 'This place is no longer available.');
        await connection.query(
          `INSERT INTO ${table} (user_id, place_id) VALUES ($1,$2) ON CONFLICT (user_id,place_id) DO NOTHING`,
          [user.id, placeId],
        );
        res.json({ success: true });
      }),
    );
    app.delete(
      `/api/${collection}`,
      route(async (req, res) => {
        const connection = await db();
        const user = await requireUser(connection, req);
        await connection.query(`DELETE FROM ${table} WHERE user_id = $1 AND place_id = $2`, [
          user.id,
          positiveId.parse(req.query.placeId),
        ]);
        res.json({ success: true });
      }),
    );
  }
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError)
      return res.status(400).json({ error: error.issues[0]?.message || 'Invalid request.' });
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError)
      return res.status(400).json({ error: 'Invalid JSON request.' });
    if (typeof error === 'object' && error && 'status' in error && error.status === 413)
      return res.status(413).json({ error: 'Request is too large.' });
    console.error('API operation failed:', error instanceof Error ? error.name : 'Unknown error');
    res
      .status(503)
      .json({ error: 'The service is temporarily unavailable. Please try again shortly.' });
  });
  return app;
}
