// Test-only Supabase contract double. SQL runs in PostgreSQL/PGlite with real RLS.
// The double does not replace live Supabase Auth or email-delivery verification.
import { randomUUID } from 'node:crypto';
import type { SupabaseClient, AuthError } from '@supabase/supabase-js';
import type { Request, Response } from 'express';
import type { PGlite } from '@electric-sql/pglite';
import type { Clients } from '../../server/supabase';
type Account = {
  id: string;
  email: string;
  password: string;
  confirmed: boolean;
  verify?: string;
  recovery?: string;
};
type Row = Record<string, unknown>;
const authError = (code: string, status = 400) =>
  ({ name: 'AuthApiError', code, status, message: code }) as AuthError;
export function testClients(db: PGlite) {
  const accounts = new Map<string, Account>();
  const sessions = new Map<string, string>();
  let queue: Promise<unknown> = Promise.resolve();
  const locked = <T>(run: () => Promise<T>) => {
    const next = queue.then(run, run);
    queue = next.catch(() => {});
    return next;
  };
  const sql = <T>(statement: string, values: unknown[] = [], userId?: string, admin = false) =>
    locked(async () => {
      await db.exec('BEGIN');
      try {
        await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [userId ?? '']);
        await db.exec(
          `SET LOCAL ROLE ${admin ? 'service_role' : userId ? 'authenticated' : 'anon'}`,
        );
        const result = await db.query<T>(statement, values);
        await db.exec('COMMIT');
        return result.rows;
      } catch (e) {
        await db.exec('ROLLBACK');
        throw e;
      }
    });
  const build = (req?: Request, res?: Response, admin = false): SupabaseClient => {
    let session =
      req?.headers.cookie
        ?.split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith('madatours-auth='))
        ?.slice(15) ?? '';
    const account = () => accounts.get(sessions.get(session) ?? '');
    const signIn = (user: Account) => {
      session = randomUUID();
      sessions.set(session, user.id);
      res?.setHeader('Set-Cookie', `madatours-auth=${session}; Path=/api; HttpOnly; SameSite=Lax`);
      return { user: { id: user.id, email: user.email }, session: { access_token: 'test-only' } };
    };
    const success = (data: unknown = {}) => Promise.resolve({ data, error: null });
    const failure = (code: string) =>
      Promise.resolve({ data: { user: null, session: null }, error: authError(code) });
    return {
      auth: {
        getUser: () =>
          account()
            ? success({ user: { id: account()!.id, email: account()!.email } })
            : failure('session_not_found'),
        signUp: async ({ email, password }: { email: string; password: string }) => {
          if ([...accounts.values()].some((a) => a.email === email))
            return success({ user: null, session: null });
          const user: Account = {
            id: randomUUID(),
            email,
            password,
            confirmed: false,
            verify: '123456',
          };
          await locked(() =>
            db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [user.id, email]),
          );
          accounts.set(user.id, user);
          return success({ user: { id: user.id, email }, session: null });
        },
        signInWithPassword: ({ email, password }: { email: string; password: string }) => {
          const user = [...accounts.values()].find(
            (a) => a.email === email && a.password === password,
          );
          if (!user) return failure('invalid_credentials');
          if (!user.confirmed) return failure('email_not_confirmed');
          return success(signIn(user));
        },
        verifyOtp: ({ email, token, type }: { email: string; token: string; type: string }) => {
          const user = [...accounts.values()].find((a) => a.email === email);
          const field = type === 'recovery' ? 'recovery' : 'verify';
          if (!user || user[field] !== token) return failure('otp_expired');
          delete user[field];
          user.confirmed = true;
          return success(signIn(user));
        },
        resend: ({ email }: { email: string }) => {
          const user = [...accounts.values()].find((a) => a.email === email);
          if (user) user.verify = '123456';
          return success();
        },
        resetPasswordForEmail: (email: string) => {
          const user = [...accounts.values()].find((a) => a.email === email);
          if (user) user.recovery = '654321';
          return success();
        },
        updateUser: ({ password }: { password: string }) => {
          const user = account();
          if (!user) return failure('session_not_found');
          user.password = password;
          return success({ user: { id: user.id, email: user.email } });
        },
        signOut: ({ scope }: { scope: string }) => {
          const id = account()?.id;
          if (scope === 'global')
            for (const [token, userId] of sessions) if (userId === id) sessions.delete(token);
          sessions.delete(session);
          res?.setHeader('Set-Cookie', 'madatours-auth=; Path=/api; HttpOnly; Max-Age=0');
          return success();
        },
        admin: {
          deleteUser: async (id: string) => {
            if (!admin) return failure('not_admin');
            await locked(() => db.query('DELETE FROM auth.users WHERE id=$1', [id]));
            accounts.delete(id);
            for (const [token, userId] of sessions) if (userId === id) sessions.delete(token);
            return success();
          },
        },
      },
      rpc: async (name: string, args: { identifier: string; ceiling: number }) => {
        if (name !== 'mt_check_rate_limit') throw new Error('Unexpected RPC');
        try {
          return {
            data: (
              await sql<{ allowed: boolean }>(
                'SELECT public.mt_check_rate_limit($1,$2) AS allowed',
                [args.identifier, args.ceiling],
                undefined,
                admin,
              )
            )[0].allowed,
            error: null,
          };
        } catch (error) {
          return { data: null, error };
        }
      },
      from: (table: string) => {
        if (!['mt_profiles', 'mt_metadata', 'mt_places', 'mt_saved_places'].includes(table))
          throw new Error('Unexpected table');
        let op = 'select',
          columns = '*',
          body: Row | undefined,
          one = false,
          ordering = '',
          ignore = false;
        const filters: [string, unknown][] = [];
        const id = (value: string) => {
          if (!/^[a-z_]+$/.test(value)) throw new Error('Invalid identifier');
          return `"${value}"`;
        };
        const query = {
          select: (value = '*') => {
            columns = value;
            return query;
          },
          eq: (column: string, value: unknown) => {
            filters.push([column, value]);
            return query;
          },
          order: (column: string) => {
            ordering = id(column);
            return query;
          },
          single: () => {
            one = true;
            return query;
          },
          insert: (value: Row) => {
            op = 'insert';
            body = value;
            return query;
          },
          upsert: (value: Row) => {
            op = 'insert';
            body = value;
            ignore = true;
            return query;
          },
          delete: () => {
            op = 'delete';
            return query;
          },
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
            const run = async () => {
              const args: unknown[] = [];
              const where = filters
                .map(([col, value]) => {
                  args.push(value);
                  return `${id(col)}=$${args.length}`;
                })
                .join(' AND ');
              let statement = '';
              if (op === 'insert') {
                const entries = Object.entries(body ?? {}).filter(([, v]) => v !== undefined);
                args.length = 0;
                for (const [, v] of entries)
                  args.push(
                    Array.isArray(v) || (v && typeof v === 'object') ? JSON.stringify(v) : v,
                  );
                statement = `INSERT INTO public.${table} (${entries.map(([k]) => id(k)).join(',')}) VALUES (${args.map((_, i) => `$${i + 1}`).join(',')}) ${ignore ? 'ON CONFLICT DO NOTHING' : ''} RETURNING *`;
              } else if (op === 'delete')
                statement = `DELETE FROM public.${table}${where ? ' WHERE ' + where : ''} RETURNING *`;
              else if (columns === 'place:mt_places(*)')
                statement = `SELECT to_jsonb(p.*) AS place FROM public.mt_saved_places s JOIN public.mt_places p ON p.id=s.place_id WHERE ${where.split('"user_id"').join('s."user_id"').split('"kind"').join('s."kind"')} ORDER BY s.created_at`;
              else
                statement = `SELECT ${columns === '*' ? '*' : columns.split(',').map(id).join(',')} FROM public.${table}${where ? ' WHERE ' + where : ''}${ordering ? ' ORDER BY ' + ordering : ''}`;
              try {
                const rows = await sql<Row>(statement, args, account()?.id, admin);
                return {
                  data: one ? (rows[0] ?? null) : rows,
                  error: one && !rows.length ? { code: 'PGRST116' } : null,
                };
              } catch (error) {
                return { data: null, error };
              }
            };
            return run().then(resolve, reject);
          },
        };
        return query;
      },
    } as unknown as SupabaseClient;
  };
  const clients: Clients = {
    client: (req, res) => build(req, res),
    admin: () => build(undefined, undefined, true),
  };
  return {
    clients,
    sql,
    accounts,
    sessions,
    grantAdmin: async (email: string) => {
      const user = [...accounts.values()].find((a) => a.email === email);
      if (!user) throw new Error('No test account');
      await locked(() =>
        db.query("UPDATE public.mt_profiles SET role='admin' WHERE id=$1", [user.id]),
      );
    },
  };
}
