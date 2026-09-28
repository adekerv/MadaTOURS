import { createServer } from 'node:http';
import { testClients } from './clients';

export function createProvider(fixture: ReturnType<typeof testClients>) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, 'http://127.0.0.1');
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      res.setHeader('Content-Type', 'application/json');
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
          else if (req.method === 'DELETE') query = client.from(table).delete();
          else query = client.from(table).select(url.searchParams.get('select') || '*');
          for (const [key, value] of url.searchParams)
            if (value.startsWith('eq.')) query = query.eq(key, value.slice(3));
          for (const order of (url.searchParams.get('order') || '').split(',').filter(Boolean))
            query = query.order(order.split('.')[0]);
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
