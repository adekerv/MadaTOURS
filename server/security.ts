import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Database } from './db';
import type { User } from '../src/types';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const derive = (password: string, salt: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, hash] = encoded.split(':');
  if (
    algorithm !== 'scrypt' ||
    !/^[a-f0-9]{32}$/.test(salt ?? '') ||
    !/^[a-f0-9]{128}$/.test(hash ?? '')
  )
    return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(hash, 'hex'));
}
const cookieName = 'madatours_session';
const lifetimeSeconds = 60 * 60 * 24 * 7;
export function readToken(req: Request) {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  return cookie?.slice(cookieName.length + 1) ?? '';
}
export function setSessionCookie(res: Response, token: string, clear = false) {
  const secure = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : lifetimeSeconds}${secure ? '; Secure' : ''}`,
  );
}
export async function createSession(db: Database, req: Request, res: Response, userId: number) {
  if (readToken(req))
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [digest(readToken(req))]);
  await db.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);
  const token = randomBytes(32).toString('hex');
  await db.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [
    digest(token),
    userId,
    Date.now() + lifetimeSeconds * 1000,
  ]);
  setSessionCookie(res, token);
}
export async function requireUser(db: Database, req: Request): Promise<User> {
  const token = readToken(req);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(401, 'Please sign in to continue.');
  const [user] = await db.query<User>(
    `SELECT u.id, u.email, u.role FROM users u JOIN sessions s ON s.user_id = u.id
    WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [digest(token), Date.now()],
  );
  if (!user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  return user;
}
export async function rateLimit(db: Database, key: string, limit: number) {
  const now = Date.now();
  await db.query('DELETE FROM rate_limits WHERE resets_at < $1', [now]);
  const [row] = await db.query<{ hits: number }>(
    `INSERT INTO rate_limits (key, hits, resets_at) VALUES ($1,1,$2)
    ON CONFLICT (key) DO UPDATE SET hits = rate_limits.hits + 1 RETURNING hits`,
    [digest(key), now + 15 * 60 * 1000],
  );
  if (row.hits > limit)
    throw new HttpError(429, 'Too many attempts. Please try again in 15 minutes.');
}
