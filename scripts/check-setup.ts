import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env.local', '.env'], quiet: true });
let failures = 0;
function result(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'MISSING'} ${name}${detail ? `: ${detail}` : ''}`);
  if (!ok) failures++;
}
const required = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY'] as const;
for (const key of required) result(key, !!process.env[key]?.trim());
const origin = process.env.APP_ORIGIN?.trim();
let validOrigin = false;
try {
  const url = new URL(origin ?? '');
  validOrigin = url.protocol === 'https:' && url.origin === origin && url.hostname !== 'vercel.com';
} catch {
  /* Missing or invalid. */
}
result(
  'APP_ORIGIN',
  validOrigin,
  'Use the public HTTPS website origin, with no path or trailing slash.',
);
const exposed = Object.keys(process.env).filter((key) =>
  /^(VITE_|NEXT_PUBLIC_).*(SECRET|PASSWORD|DATABASE|SERVICE_ROLE)/.test(key),
);
result('No secret variables exposed to browser builds', exposed.length === 0);
if (!required.every((key) => process.env[key]?.trim())) process.exit(1);
try {
  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(12000) }),
    },
  };
  const publicClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    options,
  );
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, options);
  const schema = await publicClient
    .from('mt_metadata')
    .select('value')
    .eq('key', 'schema_version')
    .single();
  result(
    'Database schema version 1',
    !schema.error && schema.data?.value === '1',
    schema.error
      ? `Provider code ${schema.error.code || 'unavailable'}; apply supabase/setup.sql.`
      : '',
  );
  const places = await publicClient.from('mt_places').select('id,published');
  result('Published catalogue readable', !places.error && !!places.data?.length);
  result(
    'Draft places hidden from guests',
    !places.error && !!places.data?.length && places.data.every((p) => p.published === true),
  );
  const accounts = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  result('Server-only key accepted by Auth', !accounts.error);
  for (const table of ['mt_profiles', 'mt_saved_places', 'mt_rate_limits']) {
    const read = await publicClient.from(table).select('*').limit(1);
    result(
      `${table} hidden from guests`,
      read.error?.code === '42501' || (!read.error && read.data?.length === 0),
    );
  }
  const settings = await fetch(`${process.env.SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY! },
    signal: AbortSignal.timeout(12000),
  });
  if (settings.ok) {
    const auth = await settings.json();
    result('Email signup enabled', auth.external?.email === true && auth.disable_signup !== true);
    result('Email confirmation enabled', auth.mailer_autoconfirm === false);
  } else result('Public Auth settings readable', false);
} catch {
  result(
    'Supabase network connection',
    false,
    'Check network access and the project URL. No credentials were logged.',
  );
}
console.log(
  'SMTP delivery, email templates, and the deployed Vercel flow still require an end-to-end check.',
);
process.exitCode = failures ? 1 : 0;
