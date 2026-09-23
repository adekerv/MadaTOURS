import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import { createClient, type SupabaseClient, type AuthError } from '@supabase/supabase-js';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import type { User } from '../src/types';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function configuration() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key || !url.startsWith('https://'))
    throw new HttpError(503, 'The database is not configured yet.');
  return { url, key };
}
const boundedFetch: typeof fetch = (input, options) =>
  fetch(input, {
    ...options,
    signal: options?.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(12000)])
      : AbortSignal.timeout(12000),
  });
export function requestClient(req: Request, res: Response): SupabaseClient {
  const { url, key } = configuration();
  const cookies = new Map(
    parseCookieHeader(req.headers.cookie ?? '').map(({ name, value }) => [name, value]),
  );
  const written = new Map<string, string>();
  return createServerClient(url, key, {
    global: { fetch: boundedFetch },
    cookieOptions: {
      name: 'madatours-auth',
      path: '/api',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
      maxAge: 60 * 60 * 24 * 7,
    },
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (updates) => {
        for (const { name, value, options } of updates) {
          cookies.set(name, value);
          written.set(
            name,
            serializeCookieHeader(name, value, {
              ...options,
              httpOnly: true,
              path: '/api',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
            }),
          );
        }
        res.setHeader('Set-Cookie', [...written.values()]);
      },
    },
  });
}
export function adminClient(): SupabaseClient {
  const { url } = configuration();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) throw new HttpError(503, 'Account services are not configured yet.');
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: boundedFetch },
  });
}
export function checkDataError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === '42501')
    throw new HttpError(403, 'You do not have permission to make this change.');
  if (error.code === '23503') throw new HttpError(404, 'This place is no longer available.');
  if (error.code === '23505') throw new HttpError(409, 'This record already exists.');
  // Do not reveal schema, secrets, or raw provider responses to public clients.
  throw new HttpError(503, 'The database request failed. Check the Supabase setup and try again.');
}
export function checkAuthError(error: AuthError | null) {
  if (!error) return;
  if (error.status === 429 || error.code?.startsWith('over_'))
    throw new HttpError(429, 'Too many attempts. Please wait before trying again.');
  if (error.code === 'email_not_confirmed')
    throw new HttpError(403, 'Verify your email before signing in.');
  if (
    error.code === 'email_address_not_authorized' ||
    error.code === 'unexpected_failure' ||
    (error.status && error.status >= 500)
  )
    throw new HttpError(
      503,
      'Email or account services are unavailable. Please contact the project owner.',
    );
  if (error.code === 'otp_expired')
    throw new HttpError(400, 'This code is invalid or has expired. Request a new code.');
  if (error.code === 'same_password') throw new HttpError(400, 'Choose a different password.');
  throw new HttpError(400, 'Check your email, password, or verification code and try again.');
}
export async function requireUser(client: SupabaseClient): Promise<User> {
  // getUser validates against Supabase Auth; cookie data is never trusted as identity.
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'Please sign in to continue.');
  const { data: profile, error: profileError } = await client
    .from('mt_profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  checkDataError(profileError);
  return {
    id: data.user.id,
    email: data.user.email ?? '',
    role: profile?.role === 'admin' ? 'admin' : 'user',
  };
}
export async function limitAttempts(
  admin: SupabaseClient,
  req: Request,
  kind: string,
  email?: string,
) {
  const ip = process.env.VERCEL
    ? req.get('x-vercel-forwarded-for')?.split(',')[0].trim() || req.ip
    : req.ip;
  for (const [identifier, ceiling] of [
    [`${kind}:ip:${ip}`, 30],
    ...(email ? [[`${kind}:email:${email}`, 10]] : []),
  ] as [string, number][]) {
    const { data, error } = await admin.rpc('mt_check_rate_limit', {
      identifier: createHash('sha256').update(identifier).digest('hex'),
      ceiling,
    });
    checkDataError(error);
    if (!data) throw new HttpError(429, 'Too many attempts. Please try again in 15 minutes.');
  }
}
export interface Clients {
  client: (req: Request, res: Response) => SupabaseClient;
  admin: () => SupabaseClient;
}
