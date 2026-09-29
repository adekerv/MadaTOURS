import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
config({ path: ['.env', '.env.local'], quiet: true });

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    "npm run auth:configure -- [--smtp] [--apply]\nPreview or apply the project's confirmation/recovery code templates and website URL. --smtp also configures SMTP from SUPABASE_SMTP_* in .env.local. Requires a Supabase management access token; never use the app secret key here.",
  );
  process.exit(0);
}
if (args.some((arg) => !['--apply', '--smtp'].includes(arg)))
  throw new Error('Unknown argument. Use --help.');
type Settings = Record<string, string | number>;
let smtp: Settings | undefined;
if (args.includes('--smtp')) {
  const parsed = z
    .object({
      smtp_host: z
        .string()
        .trim()
        .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i),
      smtp_port: z.coerce.number().int().min(1).max(65535),
      smtp_user: z
        .string()
        .trim()
        .min(1)
        .regex(/^[^\r\n]+$/),
      smtp_pass: z
        .string()
        .min(1)
        .regex(/^[^\r\n]+$/),
      smtp_admin_email: z.email(),
      smtp_sender_name: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .regex(/^[^\r\n]+$/),
    })
    .safeParse({
      smtp_host: process.env.SUPABASE_SMTP_HOST,
      smtp_port: process.env.SUPABASE_SMTP_PORT,
      smtp_user: process.env.SUPABASE_SMTP_USER,
      smtp_pass: process.env.SUPABASE_SMTP_PASS,
      smtp_admin_email: process.env.SUPABASE_SMTP_FROM_EMAIL?.trim(),
      smtp_sender_name: process.env.SUPABASE_SMTP_SENDER_NAME,
    });
  if (!parsed.success)
    throw new Error(
      `Complete the SUPABASE_SMTP_* fields in .env.local. Invalid settings: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}. No changes were made.`,
    );
  smtp = parsed.data;
}
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
  mailer_subjects_magic_link: 'MadaTours — Votre code de vérification / Your verification code',
  mailer_templates_magic_link_content: confirmation,
  mailer_subjects_recovery: 'MadaTours — Votre code de récupération / Your recovery code',
  mailer_templates_recovery_content: recovery,
};
const endpoint = `https://api.supabase.com/v1/projects/${match[1]}/config/auth`;
async function request(method = 'GET', body?: Settings) {
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    if (
      response.status === 400 &&
      typeof error?.message === 'string' &&
      error.message.includes('Email template modification is not available')
    )
      throw new Error(
        'Supabase blocks custom email templates on Free projects using its default sender. Configure a custom SMTP provider, then rerun this command. Your management token is valid; no plan upgrade is required if you use custom SMTP.',
      );
    throw new Error(
      `Supabase settings request failed (HTTP ${response.status}). ${response.status === 401 || response.status === 403 ? "Check the management token's project permissions." : 'Check the Auth configuration requirements.'} No credentials or provider response were logged.`,
    );
  }
  return (await response.json()) as Record<string, unknown>;
}
let current = await request();
if (smtp) {
  console.log(
    'SMTP configuration requested (credentials hidden; sender must already be verified with your provider).',
  );
  if (args.includes('--apply')) {
    await request('PATCH', smtp);
    current = await request();
    // The API may mask passwords and serialize the port as a string.
    if (
      Object.entries(smtp).some(
        ([key, value]) => key !== 'smtp_pass' && String(current[key]) !== String(value),
      )
    )
      throw new Error(
        'SMTP settings verification failed. SMTP may have changed; inspect Supabase settings before retrying. Email templates have not been changed.',
      );
    console.log(
      'SMTP settings saved and read back. Provider credentials and actual email delivery still need a real-inbox test.',
    );
  }
}
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
