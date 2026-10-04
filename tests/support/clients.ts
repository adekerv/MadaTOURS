// Test-only Supabase contract double. SQL runs in PostgreSQL/PGlite with real RLS.
// The double does not replace live Supabase Auth or email-delivery verification.
import { randomUUID } from 'node:crypto';
import type { SupabaseClient, AuthError } from '@supabase/supabase-js';
import type { PGlite } from '@electric-sql/pglite';
type Account = {
  id: string;
  email: string;
  password: string;
  confirmed: boolean;
  name: string;
  language?: string;
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
  const build = (token = '', admin = false): SupabaseClient => {
    let session = token;
    const account = () => accounts.get(sessions.get(session) ?? '');
    const signIn = (user: Account) => {
      session = randomUUID();
      sessions.set(session, user.id);
      return {
        user: { id: user.id, email: user.email, user_metadata: { display_name: user.name } },
        session: { access_token: session, refresh_token: session, expires_in: 3600 },
      };
    };
    const success = (data: unknown = {}) => Promise.resolve({ data, error: null });
    const failure = (code: string) =>
      Promise.resolve({ data: { user: null, session: null }, error: authError(code) });
    return {
      auth: {
        refreshSession: () =>
          account() ? success(signIn(account()!)) : failure('refresh_token_not_found'),
        getUser: () =>
          account()
            ? success({
                user: {
                  id: account()!.id,
                  email: account()!.email,
                  user_metadata: {
                    display_name: account()!.name,
                    language: account()!.language,
                  },
                },
              })
            : failure('session_not_found'),
        signUp: async ({
          email,
          password,
          data,
        }: {
          email: string;
          password: string;
          data?: { display_name?: string };
        }) => {
          if ([...accounts.values()].some((a) => a.email === email))
            return failure('user_already_exists');
          const user: Account = {
            id: randomUUID(),
            email,
            password,
            confirmed: true,
            name: data?.display_name || email.split('@')[0],
            verify: '123456',
          };
          await locked(() =>
            db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)', [
              user.id,
              email,
              JSON.stringify({ display_name: user.name }),
            ]),
          );
          accounts.set(user.id, user);
          return success(signIn(user));
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
        updateUser: async ({
          password,
          data,
        }: {
          password?: string;
          data?: { display_name?: string; language?: string };
        }) => {
          const user = account();
          if (!user) return failure('session_not_found');
          if (password !== undefined) user.password = password;
          if (data) {
            if (data.display_name !== undefined) user.name = data.display_name;
            if (data.language !== undefined) user.language = data.language;
            // Like Supabase, merge into user metadata; the display-name trigger then copies the name.
            await locked(() =>
              db.query(
                'UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || $2::jsonb WHERE id=$1',
                [user.id, JSON.stringify(data)],
              ),
            );
          }
          return success({
            user: { id: user.id, email: user.email, user_metadata: { display_name: user.name } },
          });
        },
        signOut: ({ scope }: { scope: string }) => {
          const id = account()?.id;
          if (scope === 'global')
            for (const [token, userId] of sessions) if (userId === id) sessions.delete(token);
          sessions.delete(session);
          return success();
        },
        admin: {
          updateUserById: async (
            id: string,
            { email, password }: { email?: string; password?: string },
          ) => {
            if (!admin) return failure('not_admin');
            const user = accounts.get(id);
            if (!user) return failure('user_not_found');
            if (password !== undefined) user.password = password;
            if (email) {
              if ([...accounts.values()].some((a) => a.id !== id && a.email === email))
                return failure('email_exists');
              user.email = email;
              await locked(() =>
                db.query('UPDATE auth.users SET email=$2 WHERE id=$1', [id, email]),
              );
            }
            return success({
              user: { id: user.id, email: user.email, user_metadata: { display_name: user.name } },
            });
          },
          deleteUser: async (id: string) => {
            if (!admin) return failure('not_admin');
            await locked(() => db.query('DELETE FROM auth.users WHERE id=$1', [id]));
            accounts.delete(id);
            for (const [token, userId] of sessions) if (userId === id) sessions.delete(token);
            return success();
          },
        },
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        const functions: Record<string, string[]> = {
          mt_check_rate_limit: ['identifier', 'ceiling'],
          mt_place_community: ['target_place', 'page_offset'],
          mt_place_review_photos: ['target_place', 'page_offset'],
          mt_replace_recovery_codes: ['target', 'hashes'],
          mt_recovery_candidates: ['account_email'],
          mt_consume_recovery_code: ['code_id'],
          mt_recovery_codes_left: ['target'],
          mt_revoke_user_sessions: ['target'],
          mt_community_write: ['action', 'payload'],
          mt_social_write: ['action', 'payload'],
          mt_social_dashboard: ['search_text', 'page_offset'],
          mt_expire_events: [],
          mt_submission_write: ['action', 'payload'],
          mt_apply_source_hours: ['target_place', 'periods', 'source_url'],
          mt_claim_google_request: ['daily_limit'],
          mt_queue_google_matches: [],
          mt_refresh_daily_picks: [],
        };
        const names = functions[name];
        if (!names) throw new Error('Unexpected RPC');
        try {
          return {
            data: (
              await sql<{ result: unknown }>(
                `SELECT public.${name}(${names.map((_, i) => '$' + (i + 1)).join(',')}) AS result`,
                names.map((k) => (typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k])),
                account()?.id,
                admin,
              )
            )[0].result,
            error: null,
          };
        } catch (error) {
          return { data: null, error };
        }
      },
      from: (table: string) => {
        if (
          ![
            'mt_profiles',
            'mt_metadata',
            'mt_places',
            'mt_saved_places',
            'mt_reviews',
            'mt_comments',
            'mt_comment_blocks',
            'mt_public_profiles',
            'mt_submissions',
            'mt_submission_photos',
            'mt_review_photos',
            'mt_recovery_codes',
            'mt_photo_deletions',
            'mt_notifications',
            'mt_source_settings',
            'mt_source_logs',
            'mt_google_matches',
            'mt_daily_picks',
          ].includes(table)
        )
          throw new Error('Unexpected table');
        let op = 'select',
          columns = '*',
          body: Row | undefined,
          one = false,
          ordering = '',
          offset = 0,
          limit: number | undefined,
          ignore = false;
        const filters: [string, unknown, string][] = [];
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
            filters.push([column, value, '=']);
            return query;
          },
          like: (column: string, value: unknown) => {
            filters.push([column, value, 'LIKE']);
            return query;
          },
          order: (column: string, options?: { ascending?: boolean }) => {
            ordering +=
              (ordering ? ',' : '') +
              id(column) +
              (options?.ascending === false ? ' DESC' : ' ASC');
            return query;
          },
          range: (from: number, to: number) => {
            offset = from;
            limit = to - from + 1;
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
          update: (value: Row) => {
            op = 'update';
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
                .map(([col, value, operator]) => {
                  args.push(value);
                  return `${id(col)} ${operator} $${args.length}`;
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
              } else if (op === 'update') {
                const assignments = Object.entries(body ?? {}).map(([k, v]) => {
                  args.push(v);
                  return `${id(k)}=$${args.length}`;
                });
                statement = `UPDATE public.${table} SET ${assignments.join(',')}${where ? ' WHERE ' + where : ''} RETURNING *`;
              } else if (op === 'delete')
                statement = `DELETE FROM public.${table}${where ? ' WHERE ' + where : ''} RETURNING *`;
              else if (columns === 'place_id,place:mt_places(*)')
                statement = `SELECT s.place_id, to_jsonb(p.*) AS place FROM public.mt_saved_places s LEFT JOIN public.mt_places p ON p.id=s.place_id WHERE ${where.split('"user_id"').join('s."user_id"').split('"kind"').join('s."kind"')} ORDER BY s.created_at,s.place_id`;
              else
                statement = `SELECT ${columns === '*' ? '*' : columns.split(',').map(id).join(',')} FROM public.${table}${where ? ' WHERE ' + where : ''}${ordering ? ' ORDER BY ' + ordering : ''}`;
              try {
                if (op === 'select' && limit !== undefined)
                  statement += ` LIMIT ${limit} OFFSET ${offset}`;
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
  const clients = {
    client: (token?: string) => build(token),
    admin: () => build('', true),
  };
  return {
    clients,
    sql,
    accounts,
    sessions,
    /** Stands in for Google confirming the address, the only way an account becomes verified without email. */
    verifyEmail: async (email: string) => {
      const user = [...accounts.values()].find((a) => a.email === email);
      if (!user) throw new Error('No test account');
      await locked(() =>
        db.query('UPDATE public.mt_profiles SET email_verified_at=now() WHERE id=$1', [user.id]),
      );
    },
    grantAdmin: async (email: string) => {
      const user = [...accounts.values()].find((a) => a.email === email);
      if (!user) throw new Error('No test account');
      await locked(() =>
        db.query("UPDATE public.mt_profiles SET role='admin' WHERE id=$1", [user.id]),
      );
    },
  };
}
