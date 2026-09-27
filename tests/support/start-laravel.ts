// Laravel talks HTTP to this isolated Supabase contract double. SQL uses real PGlite RLS.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { Request, Response } from 'express';
import { testDatabase } from './database';
import { testClients } from './clients';
const db = await testDatabase();
const fixture = testClients(db);
const provider = createServer(async (req, res) => {
  try {
    const url = new URL(req.url!, 'http://127.0.0.1:3101');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/__test/admin') {
      if (!process.env.MADATOURS_E2E_TOKEN || req.headers['x-test-token'] !== process.env.MADATOURS_E2E_TOKEN) { res.writeHead(403).end('{}'); return; }
      await fixture.grantAdmin(String(body.email)); res.end('{"success":true}'); return;
    }
    const token = req.headers.authorization?.replace(/^Bearer /, '') || '';
    const client = req.headers.apikey === 'test-secret' ? fixture.clients.admin() : fixture.clients.client(
      { headers: { cookie: `madatours-auth=${token}` } } as Request,
      { setHeader: () => {} } as unknown as Response,
    );
    let result;
    let auth = false;
    if (url.pathname.startsWith('/auth/v1/')) {
      auth = true;
      const path = url.pathname.slice('/auth/v1/'.length);
      if (path === 'signup') result = await client.auth.signUp(body);
      else if (path === 'token') result = await client.auth.signInWithPassword(body);
      else if (path === 'verify') result = await client.auth.verifyOtp(body);
      else if (path === 'resend') result = await client.auth.resend(body);
      else if (path === 'recover') result = await client.auth.resetPasswordForEmail(body.email);
      else if (path === 'logout') result = await client.auth.signOut({ scope: url.searchParams.get('scope') === 'global' ? 'global' : 'local' });
      else if (path === 'user') result = req.method === 'PUT' ? await client.auth.updateUser(body) : await client.auth.getUser();
      else if (path.startsWith('admin/users/')) result = await client.auth.admin.deleteUser(path.slice(12));
      else throw new Error('Unknown mock auth route');
      if (result.error) { res.writeHead(result.error.status || 400).end(JSON.stringify({error_code: result.error.code})); return; }
      const data = result.data as {user?: unknown; session?: Record<string, unknown>};
      res.end(JSON.stringify(path === 'user' ? data.user : data.session ? { ...data.session, user: data.user } : data));
    } else {
      const table = url.pathname.slice('/rest/v1/'.length);
      if (table.startsWith('rpc/')) result = await client.rpc(table.slice(4), body);
      else {
        let query;
        if (req.method === 'POST') query = url.searchParams.has('on_conflict') ? client.from(table).upsert(body, {ignoreDuplicates: true}) : client.from(table).insert(body);
        else if (req.method === 'DELETE') query = client.from(table).delete();
        else query = client.from(table).select(url.searchParams.get('select') || '*');
        for (const [key, value] of url.searchParams) if (value.startsWith('eq.')) query = query.eq(key, value.slice(3));
        if (url.searchParams.has('order')) query = query.order(url.searchParams.get('order')!.split('.')[0]);
        result = await query;
      }
      if (result.error) { res.writeHead(400).end(JSON.stringify({code: result.error.code})); return; }
      res.end(JSON.stringify(result.data));
    }
    void auth;
  } catch { res.writeHead(500).end('{"error":"Test provider failure"}'); }
});
provider.listen(3101, '127.0.0.1');
await once(provider, 'listening');
const php = spawn('php', ['artisan', 'serve', '--host=127.0.0.1', '--port=3100', '--no-reload'], {
  stdio: 'inherit',
  env: {...process.env, APP_ENV: 'testing', APP_KEY: `base64:${randomBytes(32).toString('base64')}`, APP_URL: 'http://127.0.0.1:3100', APP_ORIGIN: 'http://127.0.0.1:3100', APP_DEBUG: 'false', SUPABASE_URL: 'http://127.0.0.1:3101', SUPABASE_PUBLISHABLE_KEY: 'test-public', SUPABASE_SECRET_KEY: 'test-secret', SESSION_DRIVER: 'file', SESSION_SECURE_COOKIE: 'false', CACHE_STORE: 'file'},
});
async function close() { php.kill('SIGTERM'); provider.close(); await db.close(); }
process.once('SIGINT', () => { void close(); });
process.once('SIGTERM', () => { void close(); });
php.once('exit', () => { provider.close(); void db.close(); });
