import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
config({ path: ['.env.local', '.env'], quiet: true });

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    "npm run auth:configure -- [--apply]\nPreview or apply the project's confirmation/recovery code templates and website URL. Requires a Supabase management access token; never use the app secret key here.",
  );
  process.exit(0);
}
if (args.some((arg) => arg !== '--apply')) throw new Error('Unknown argument. Use --help.');
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error(
    'Add SUPABASE_ACCESS_TOKEN to .env.local using a personal access token from https://supabase.com/dashboard/account/tokens. Do not paste it in chat. App API keys cannot edit Auth configuration.',
  );
  process.exit(1);
}
const host = new URL(process.env.SUPABASE_URL || '').hostname;
const match = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
if (!match) throw new Error('SUPABASE_URL must identify your hosted Supabase project.');
const origin = new URL(process.env.APP_ORIGIN?.trim() || '');
if (
  origin.protocol !== 'https:' ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw new Error('APP_ORIGIN must be the public HTTPS website origin.');
const confirmation = await readFile('supabase/templates/confirm-signup.html', 'utf8');
const recovery = await readFile('supabase/templates/reset-password.html', 'utf8');
for (const template of [confirmation, recovery]) {
  if (!template.includes('{{ .Token }}') || /ConfirmationURL|TokenHash/.test(template))
    throw new Error('Templates must contain the numeric .Token, not a confirmation link or hash.');
}
const desired: Record<string, string> = {
  site_url: origin.origin,
  mailer_subjects_confirmation: 'MadaTours — Votre code de vérification / Your verification code',
  mailer_templates_confirmation_content: confirmation,
  mailer_subjects_recovery: 'MadaTours — Votre code de récupération / Your recovery code',
  mailer_templates_recovery_content: recovery,
};
const endpoint = `https://api.supabase.com/v1/projects/${match[1]}/config/auth`;
async function request(method = 'GET', body?: Record<string, string>) {
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(
      `Supabase settings request failed (HTTP ${response.status}). Check the management token's project permissions. No credentials or provider response were logged.`,
    );
  return (await response.json()) as Record<string, unknown>;
}
const current = await request();
const changes = Object.fromEntries(
  Object.entries(desired).filter(([key, value]) => current[key] !== value),
);
console.log(`Project: ${match[1]}; public website: ${origin.origin}`);
console.log(`Pending settings: ${Object.keys(changes).join(', ') || 'none'}`);
console.log(
  `Email confirmation: ${current.mailer_autoconfirm === false ? 'enabled' : 'disabled'}; custom SMTP: ${current.smtp_host ? 'configured (delivery not tested)' : 'not configured; built-in sender restrictions apply'}.`,
);
if (args.includes('--apply') && Object.keys(changes).length) {
  await mkdir('.data/auth-settings', { recursive: true });
  // Back up only the public URL and templates, never SMTP credentials.
  await writeFile(
    `.data/auth-settings/${match[1]}-${Date.now()}-before.json`,
    JSON.stringify(
      Object.fromEntries(Object.keys(changes).map((key) => [key, current[key]])),
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
  await request('PATCH', changes);
  const after = await request();
  if (Object.entries(desired).some(([key, value]) => after[key] !== value))
    throw new Error('Settings verification failed. Inspect Auth email settings before retrying.');
  console.log(
    'Verified live confirmation and recovery templates use numeric codes. Existing emails are unchanged; request a fresh code in the app.',
  );
} else if (!args.includes('--apply')) {
  console.log('Preview only. Run with --apply to save these settings.');
} else {
  console.log('Live settings already match the numeric-code templates.');
}
