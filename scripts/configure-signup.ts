import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
config({ path: ['.env', '.env.local'], quiet: true });

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'npm run auth:signup -- [--apply]\nPreview or disable email confirmation for new signups. Does not change SMS, email templates, SMTP, or existing accounts.',
  );
  process.exit(0);
}
if (args.some((arg) => arg !== '--apply')) throw new Error('Unknown argument. Use --help.');
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const project = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(
  process.env.SUPABASE_URL?.trim() || '',
)?.[1];
if (!token || !project)
  throw new Error(
    'Configure SUPABASE_URL and a Supabase management access token in the private environment file.',
  );
const endpoint = `https://api.supabase.com/v1/projects/${project}/config/auth`;
async function request(method = 'GET', body?: Record<string, boolean>) {
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(
      `Auth settings request failed (HTTP ${response.status}). No provider details or credentials were logged.`,
    );
  return (await response.json()) as Record<string, unknown>;
}
const current = await request();
if (current.external_email_enabled !== true)
  throw new Error(
    'Email sign-in is disabled. Enable the email provider before changing signup confirmation.',
  );
console.log(
  `Email confirmation for new signups: ${current.mailer_autoconfirm === true ? 'off' : 'on'}.`,
);
if (!args.includes('--apply')) {
  console.log(
    'Preview only. Run with --apply to allow immediate email-and-password signup. Welcome emails require Laravel SMTP configuration separately.',
  );
} else if (current.mailer_autoconfirm === true) {
  console.log('Immediate email signup is already enabled.');
} else {
  await mkdir('.data/auth-settings', { recursive: true, mode: 0o700 });
  await writeFile(
    `.data/auth-settings/signup-${Date.now()}-before.json`,
    JSON.stringify({ mailer_autoconfirm: current.mailer_autoconfirm }) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  await request('PATCH', { mailer_autoconfirm: true });
  const after = await request();
  if (after.mailer_autoconfirm !== true)
    throw new Error(
      'Auth settings did not match after saving. Inspect the hosted setting before retrying.',
    );
  console.log(
    'Verified: new email signups no longer require email confirmation. Phone settings were unchanged.',
  );
}
