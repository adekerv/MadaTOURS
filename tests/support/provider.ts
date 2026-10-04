import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { testClients } from './clients';

/** A stand-in for OpenRouteService: a road line that bends between the stops, so it can never pass for a straight one. */
function roadBetween(coordinates: [number, number][]) {
  const line: [number, number][] = [];
  coordinates.forEach((point, index) => {
    if (index) {
      const [fromLng, fromLat] = coordinates[index - 1];
      line.push([(fromLng + point[0]) / 2 + 0.02, (fromLat + point[1]) / 2 - 0.02]);
    }
    line.push(point);
  });
  return line;
}
export function createProvider(fixture: ReturnType<typeof testClients>) {
  const photos = new Map<string, Buffer>();
  // 'ok' answers with a road, 'fail' with a server error, 'garbage' with something that is not a route.
  const ors = { mode: 'ok', requests: [] as { authorization?: string; coordinates: unknown }[] };
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
      if (url.pathname.startsWith('/v2/directions/')) {
        ors.requests.push({
          authorization: req.headers.authorization,
          coordinates: body.coordinates,
        });
        if (req.headers.authorization !== 'test-ors-key') {
          res.writeHead(403).end('{"error":{"code":2010}}');
        } else if (ors.mode === 'fail') {
          res.writeHead(500).end('{"error":{"code":500}}');
        } else if (ors.mode === 'garbage') {
          res.end('{"features":[]}');
        } else {
          const line = roadBetween(body.coordinates);
          res.end(
            JSON.stringify({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { summary: { distance: 1000 * line.length + 0.4, duration: 600 } },
                  geometry: { type: 'LineString', coordinates: line },
                },
              ],
            }),
          );
        }
        return;
      }
      if (url.pathname === '/__test/ors') {
        if (
          !process.env.MADATOURS_E2E_TOKEN ||
          req.headers['x-test-token'] !== process.env.MADATOURS_E2E_TOKEN
        ) {
          res.writeHead(403).end('{}');
          return;
        }
        if (req.method === 'POST') {
          ors.mode = String(body.mode ?? 'ok');
          if (body.reset) ors.requests.length = 0;
        }
        res.end(JSON.stringify(ors));
        return;
      }
      if (url.pathname === '/__test/admin' || url.pathname === '/__test/verify') {
        if (
          !process.env.MADATOURS_E2E_TOKEN ||
          req.headers['x-test-token'] !== process.env.MADATOURS_E2E_TOKEN
        ) {
          res.writeHead(403).end('{}');
          return;
        }
        if (url.pathname === '/__test/admin') await fixture.grantAdmin(String(body.email));
        else await fixture.verifyEmail(String(body.email));
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
          result =
            req.method === 'PUT'
              ? await client.auth.admin.updateUserById(path.slice(12), body)
              : await client.auth.admin.deleteUser(path.slice(12));
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
            else if (value.startsWith('in.(') && value.endsWith(')'))
              query = query.in(key, value.slice(4, -1).split(','));
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
