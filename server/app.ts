import express, { type Request, type Response, type NextFunction } from 'express';
import { z, ZodError } from 'zod';
import {
  requestClient,
  adminClient,
  HttpError,
  requireUser,
  checkAuthError,
  checkDataError,
  limitAttempts,
  type Clients,
} from './supabase';
import { credentials, registration, placeInput, nearbyQuery, positiveId } from './validation';
import { calculateDistance, normalizePlace } from '../src/lib/places-utils';
import seedPlaces from '../src/data/places.json';
const emailInput = credentials.pick({ email: true });
const codeInput = emailInput.extend({
  token: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, 'Enter the code from your email.'),
});
type Handler = (req: Request, res: Response) => Promise<unknown>;
const route = (handler: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(handler(req, res)).catch(next);
};
export function createApp(clients: Clients = { client: requestClient, admin: adminClient }) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = req.headers.origin;
    const allowed = new Set(
      (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    );
    if (process.env.APP_ORIGIN) allowed.add(process.env.APP_ORIGIN);
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
      allowed.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL)
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
    if (!['GET', 'HEAD'].includes(req.method) && req.get('X-MadaTours-Client') !== '1')
      return res.status(403).json({ error: 'Invalid request. Please reload and try again.' });
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.get(
    '/api/health',
    route(async (req, res) => {
      const { data, error } = await clients
        .client(req, res)
        .from('mt_metadata')
        .select('value')
        .eq('key', 'schema_version')
        .single();
      checkDataError(error);
      if (data?.value !== '1') throw new HttpError(503, 'The database has not been initialized.');
      res.json({ status: 'ok', database: 'supabase' });
    }),
  );
  app.get(
    '/api/places',
    route(async (req, res) => {
      const hasCoordinates = ['lat', 'lng', 'radius'].some((key) => req.query[key] !== undefined);
      const nearby = hasCoordinates ? nearbyQuery.parse(req.query) : null;
      const { data, error } = await clients
        .client(req, res)
        .from('mt_places')
        .select('*')
        .eq('published', true)
        .order('id');
      checkDataError(error);
      let places = (data ?? []).map(normalizePlace);
      if (nearby)
        places = places
          .map((p) => ({ ...p, distance: calculateDistance(nearby.lat, nearby.lng, p.lat, p.lng) }))
          .filter((p) => p.distance <= nearby.radius)
          .sort((a, b) => a.distance - b.distance);
      res.json(places);
    }),
  );
  app.post(
    '/api/places',
    route(async (req, res) => {
      const client = clients.client(req, res);
      if ((await requireUser(client)).role !== 'admin')
        throw new HttpError(403, 'Only administrators can manage places.');
      const input = placeInput.parse(req.body);
      const { data, error } = await client.from('mt_places').insert(input).select().single();
      checkDataError(error);
      res.status(201).json(normalizePlace(data));
    }),
  );
  app.delete(
    '/api/places/:id',
    route(async (req, res) => {
      const client = clients.client(req, res);
      if ((await requireUser(client)).role !== 'admin')
        throw new HttpError(403, 'Only administrators can manage places.');
      const { data, error } = await client
        .from('mt_places')
        .delete()
        .eq('id', positiveId.parse(req.params.id))
        .select('id');
      checkDataError(error);
      if (!data?.length) throw new HttpError(404, 'This place could not be found.');
      res.json({ success: true });
    }),
  );
  app.post(
    '/api/auth/register',
    route(async (req, res) => {
      const input = registration.parse(req.body);
      await limitAttempts(clients.admin(), req, 'auth', input.email);
      const client = clients.client(req, res);
      const { data, error } = await client.auth.signUp(input);
      checkAuthError(error);
      res.status(201).json({
        user: data.session ? await requireUser(client) : null,
        verificationRequired: !data.session,
      });
    }),
  );
  app.post(
    '/api/auth/login',
    route(async (req, res) => {
      const input = credentials.parse(req.body);
      await limitAttempts(clients.admin(), req, 'auth', input.email);
      const client = clients.client(req, res);
      const { error } = await client.auth.signInWithPassword(input);
      checkAuthError(error);
      res.json({ user: await requireUser(client) });
    }),
  );
  app.post(
    '/api/auth/verify',
    route(async (req, res) => {
      const input = codeInput.parse(req.body);
      await limitAttempts(clients.admin(), req, 'verify', input.email);
      const client = clients.client(req, res);
      const { error } = await client.auth.verifyOtp({ ...input, type: 'email' });
      checkAuthError(error);
      res.json({ user: await requireUser(client) });
    }),
  );
  app.post(
    '/api/auth/resend',
    route(async (req, res) => {
      const { email } = emailInput.parse(req.body);
      await limitAttempts(clients.admin(), req, 'email', email);
      const { error } = await clients.client(req, res).auth.resend({ email, type: 'signup' });
      checkAuthError(error);
      res.json({ success: true });
    }),
  );
  app.post(
    '/api/auth/forgot-password',
    route(async (req, res) => {
      const { email } = emailInput.parse(req.body);
      await limitAttempts(clients.admin(), req, 'email', email);
      const { error } = await clients.client(req, res).auth.resetPasswordForEmail(email);
      checkAuthError(error);
      res.json({ success: true });
    }),
  );
  app.post(
    '/api/auth/reset-password',
    route(async (req, res) => {
      const input = codeInput.extend({ password: registration.shape.password }).parse(req.body);
      await limitAttempts(clients.admin(), req, 'verify', input.email);
      const client = clients.client(req, res);
      const { error } = await client.auth.verifyOtp({
        email: input.email,
        token: input.token,
        type: 'recovery',
      });
      checkAuthError(error);
      try {
        const result = await client.auth.updateUser({ password: input.password });
        checkAuthError(result.error);
      } finally {
        // End the recovery session even when a password update fails. Never expose its tokens.
        const result = await client.auth.signOut({ scope: 'global' });
        checkAuthError(result.error);
      }
      res.json({ success: true });
    }),
  );
  app.get(
    '/api/auth/session',
    route(async (req, res) => {
      if (!req.headers.cookie?.includes('madatours-auth')) return res.json({ user: null });
      try {
        res.json({ user: await requireUser(clients.client(req, res)) });
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) return res.json({ user: null });
        throw error;
      }
    }),
  );
  app.post(
    '/api/auth/logout',
    route(async (req, res) => {
      const { error } = await clients.client(req, res).auth.signOut({ scope: 'local' });
      checkAuthError(error);
      res.json({ success: true });
    }),
  );
  app.delete(
    '/api/account',
    route(async (req, res) => {
      const client = clients.client(req, res);
      const user = await requireUser(client);
      const input = credentials.parse({ email: user.email, password: req.body?.password });
      const admin = clients.admin();
      await limitAttempts(admin, req, 'delete', user.email);
      // Password reauthentication prevents a stolen open session from deleting an account.
      const { data, error } = await client.auth.signInWithPassword(input);
      checkAuthError(error);
      if (data.user?.id !== user.id)
        throw new HttpError(401, 'Incorrect password. Your account has not been deleted.');
      const deleted = await admin.auth.admin.deleteUser(user.id);
      checkAuthError(deleted.error);
      await client.auth.signOut({ scope: 'local' });
      res.json({ success: true });
    }),
  );
  for (const collection of ['favorites', 'revisits'] as const) {
    app.get(
      `/api/${collection}`,
      route(async (req, res) => {
        const client = clients.client(req, res);
        const user = await requireUser(client);
        const { data, error } = await client
          .from('mt_saved_places')
          .select('place:mt_places(*)')
          .eq('user_id', user.id)
          .eq('kind', collection)
          .order('created_at');
        checkDataError(error);
        res.json((data ?? []).filter((row) => row.place).map((row) => normalizePlace(row.place)));
      }),
    );
    app.post(
      `/api/${collection}`,
      route(async (req, res) => {
        const client = clients.client(req, res);
        const user = await requireUser(client);
        const placeId = positiveId.parse(req.body?.placeId);
        const existing = await client.from('mt_places').select('id').eq('id', placeId).single();
        if (existing.error?.code === 'PGRST116')
          throw new HttpError(404, 'This place is no longer available.');
        checkDataError(existing.error);
        if (!existing.data) throw new HttpError(404, 'This place is no longer available.');
        const { error } = await client
          .from('mt_saved_places')
          .upsert(
            { user_id: user.id, place_id: placeId, kind: collection },
            { onConflict: 'user_id,place_id,kind', ignoreDuplicates: true },
          );
        checkDataError(error);
        res.json({ success: true });
      }),
    );
    app.delete(
      `/api/${collection}`,
      route(async (req, res) => {
        const client = clients.client(req, res);
        const user = await requireUser(client);
        const { error } = await client
          .from('mt_saved_places')
          .delete()
          .eq('user_id', user.id)
          .eq('kind', collection)
          .eq('place_id', positiveId.parse(req.query.placeId));
        checkDataError(error);
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
// Public bundled content is the frontend's explicit offline fallback; failed database writes never fall back locally.
export const bundledPlaces = seedPlaces;
