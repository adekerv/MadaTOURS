import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { testClients } from './clients';

export function createProvider(fixture: ReturnType<typeof testClients>) {
  const photos = new Map<string, Buffer>();
  const signed = new Map<string, { path: string; expires: number }>();
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, 'http://127.0.0.1');
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks);
      const body =
        chunks.length && !req.headers['content-type']?.startsWith('image/')
          ? JSON.parse(raw.toString())
          : {};
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname.startsWith('/storage/v1/')) {
        const route = url.pathname.slice('/storage/v1'.length);
        const isService = req.headers.apikey === 'test-secret';
        if (req.method === 'GET' && route.startsWith('/object/sign/mt-submissions/')) {
          const token = signed.get(url.searchParams.get('token') || '');
          const path = route.slice('/object/sign/mt-submissions/'.length);
          if (!token || token.path !== path || token.expires < Date.now() || !photos.has(path)) {
            res.writeHead(403).end('{}');
            return;
          }
          res.setHeader('Content-Type', 'image/jpeg');
          res.end(photos.get(path));
          return;
        }
        if (!isService) {
          res.writeHead(403).end('{}');
          return;
        }
        if (route === '/object/sign/mt-submissions' && req.method === 'POST') {
          res.end(
            JSON.stringify(
              body.paths.map((path: string) => {
                const token = randomUUID();
                signed.set(token, { path, expires: Date.now() + body.expiresIn * 1000 });
                return { path, signedURL: `/object/sign/mt-submissions/${path}?token=${token}` };
              }),
            ),
          );
          return;
        }
        if (route === '/object/mt-submissions' && req.method === 'DELETE') {
          for (const path of body.prefixes) photos.delete(path);
          res.end('[]');
          return;
        }
        const path = route.slice('/object/mt-submissions/'.length);
        if (!route.startsWith('/object/mt-submissions/')) {
          res.writeHead(404).end('{}');
          return;
        }
        if (req.method === 'POST') {
          photos.set(path, raw);
          res.end(JSON.stringify({ Key: path }));
          return;
        }
        if (req.method === 'GET' && photos.has(path)) {
          res.setHeader('Content-Type', 'image/jpeg');
          res.end(photos.get(path));
          return;
        }
        res.writeHead(404).end('{}');
        return;
      }
      if (url.pathname === '/__test/admin') {
        if (
          !process.env.MADATOURS_E2E_TOKEN ||
          req.headers['x-test-token'] !== process.env.MADATOURS_E2E_TOKEN
        ) {
          res.writeHead(403).end('{}');
          return;
        }
        await fixture.grantAdmin(String(body.email));
        res.end('{"success":true}');
        return;
      }
      const token = req.headers.authorization?.replace(/^Bearer /, '') || '';
      const client =
        req.headers.apikey === 'test-secret'
          ? fixture.clients.admin()
          : fixture.clients.client(token);
      let result;
      if (url.pathname.startsWith('/auth/v1/')) {
        const path = url.pathname.slice('/auth/v1/'.length);
        if (path === 'signup') result = await client.auth.signUp(body);
        else if (path === 'token')
          result =
            url.searchParams.get('grant_type') === 'refresh_token'
              ? await fixture.clients.client(body.refresh_token).auth.refreshSession()
              : await client.auth.signInWithPassword(body);
        else if (path === 'verify') result = await client.auth.verifyOtp(body);
        else if (path === 'otp') result = await client.auth.resend(body);
        else if (path === 'resend') result = await client.auth.resend(body);
        else if (path === 'recover') result = await client.auth.resetPasswordForEmail(body.email);
        else if (path === 'logout')
          result = await client.auth.signOut({
            scope: url.searchParams.get('scope') === 'global' ? 'global' : 'local',
          });
        else if (path === 'user')
          result =
            req.method === 'PUT' ? await client.auth.updateUser(body) : await client.auth.getUser();
        else if (path.startsWith('admin/users/'))
          result = await client.auth.admin.deleteUser(path.slice(12));
        else throw new Error('Unknown mock auth route');
        if (result.error) {
          res
            .writeHead(result.error.status || 400)
            .end(JSON.stringify({ error_code: result.error.code }));
          return;
        }
        const data = ('data' in result ? result.data : {}) as {
          user?: unknown;
          session?: Record<string, unknown>;
        };
        res.end(
          JSON.stringify(
            path === 'user'
              ? data.user
              : data.session
                ? { ...data.session, user: data.user }
                : data,
          ),
        );
      } else {
        const table = url.pathname.slice('/rest/v1/'.length);
        if (table.startsWith('rpc/')) result = await client.rpc(table.slice(4), body);
        else {
          let query;
          if (req.method === 'POST')
            query = url.searchParams.has('on_conflict')
              ? client.from(table).upsert(body, { ignoreDuplicates: true })
              : client.from(table).insert(body);
          else if (req.method === 'PATCH') query = client.from(table).update(body);
          else if (req.method === 'DELETE') query = client.from(table).delete();
          else query = client.from(table).select(url.searchParams.get('select') || '*');
          for (const [key, value] of url.searchParams) {
            if (value.startsWith('eq.')) query = query.eq(key, value.slice(3));
            else if (value.startsWith('like.'))
              query = query.like(key, value.slice(5).replaceAll('*', '%'));
          }
          for (const order of (url.searchParams.get('order') || '').split(',').filter(Boolean))
            query = query.order(order.split('.')[0], { ascending: order.split('.')[1] !== 'desc' });
          if (url.searchParams.has('limit')) {
            const offset = Number(url.searchParams.get('offset') || 0);
            query = query.range(offset, offset + Number(url.searchParams.get('limit')) - 1);
          }
          result = await query;
        }
        if (result.error) {
          res.writeHead(400).end(JSON.stringify({ code: result.error.code }));
          return;
        }
        res.end(JSON.stringify(result.data));
      }
    } catch {
      res.writeHead(500).end('{"error":"Test provider failure"}');
    }
  });
}
