import { createClient } from '@supabase/supabase-js';

/** Only for opt-in maintenance scripts; application requests go through Laravel. */
export function adminClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url?.startsWith('https://') || !key)
    throw new Error('Configure the server-only Supabase URL and secret key.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }),
    },
  });
}
