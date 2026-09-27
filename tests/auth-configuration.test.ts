import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = fileURLToPath(new URL('../scripts/configure-auth-email.ts', import.meta.url));
const secret = 'test-smtp-secret-do-not-log';

async function run(args: string[], mode = 'success', missingPassword = false) {
  const cwd = await mkdtemp(join(tmpdir(), 'madatours-auth-config-'));
  try {
    await mkdir(join(cwd, 'supabase/templates'), { recursive: true });
    for (const name of ['confirm-signup', 'reset-password'])
      await writeFile(join(cwd, `supabase/templates/${name}.html`), '<p>{{ .Token }}</p>');
    // Block all real network calls and emulate the Management API's masked password.
    const mock = `
      let state = { mailer_autoconfirm: false };
      globalThis.fetch = async (url, options) => {
        if (url !== 'https://api.supabase.com/v1/projects/testproject/config/auth') throw new Error('Unexpected endpoint');
        console.log('REQUEST:' + options.method);
        if (options.method === 'PATCH') {
          const body = JSON.parse(options.body);
          console.log('FIELDS:' + Object.keys(body).sort().join(','));
          if ('smtp_pass' in body && body.smtp_pass !== ${JSON.stringify(secret)}) throw new Error('Wrong credential');
          if (${JSON.stringify(mode)} === 'blocked' && 'mailer_templates_confirmation_content' in body)
            return new Response(JSON.stringify({message:'Email template modification is not available; private provider detail'}), {status:400});
          state = {...state, ...body};
        }
        return new Response(JSON.stringify({...state, smtp_pass:'***', ...(state.smtp_port ? {smtp_port:String(state.smtp_port)} : {})}));
      };
    `;
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        import.meta.resolve('tsx'),
        '--import',
        `data:text/javascript,${encodeURIComponent(mock)}`,
        script,
        ...args,
      ],
      {
        cwd,
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          SUPABASE_ACCESS_TOKEN: 'test-management-token',
          SUPABASE_URL: 'https://testproject.supabase.co',
          APP_ORIGIN: 'https://mada-tours.vercel.app',
          SUPABASE_SMTP_HOST: 'smtp-relay.brevo.com',
          SUPABASE_SMTP_PORT: '587',
          SUPABASE_SMTP_USER: 'test-login',
          SUPABASE_SMTP_PASS: missingPassword ? '' : secret,
          SUPABASE_SMTP_FROM_EMAIL: 'sender@example.com',
          SUPABASE_SMTP_SENDER_NAME: 'MadaTours',
        },
      },
    );
    const output = result.stdout + result.stderr;
    assert.ok(!output.includes(secret));
    assert.ok(!output.includes('test-management-token'));
    assert.ok(!output.includes('private provider detail'));
    return { status: result.status, output };
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test('SMTP preview never changes hosted configuration', async () => {
  const result = await run(['--smtp']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Preview only/);
  assert.doesNotMatch(result.output, /REQUEST:PATCH/);
});

test('SMTP is applied and read back before the numeric email templates', async () => {
  const result = await run(['--smtp', '--apply']);
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(result.output.match(/REQUEST:\w+/g), [
    'REQUEST:GET',
    'REQUEST:PATCH',
    'REQUEST:GET',
    'REQUEST:PATCH',
    'REQUEST:GET',
  ]);
  const patches = result.output.split('\n').filter((line) => line.startsWith('FIELDS:'));
  assert.equal(
    patches[0],
    'FIELDS:smtp_admin_email,smtp_host,smtp_pass,smtp_port,smtp_sender_name,smtp_user',
  );
  assert.match(patches[1], /mailer_templates_confirmation_content/);
  assert.doesNotMatch(patches.join('\n'), /mailer_autoconfirm/);
  assert.match(result.output, /Verified live confirmation and recovery templates/);
});

test('missing SMTP credentials stop before any network request', async () => {
  const result = await run(['--smtp', '--apply'], 'success', true);
  assert.equal(result.status, 1);
  assert.match(result.output, /Invalid settings: smtp_pass/);
  assert.doesNotMatch(result.output, /REQUEST:/);
});

test('template-only configuration never submits local SMTP credentials', async () => {
  const result = await run(['--apply']);
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /FIELDS:.*smtp_/);
});

test('free-plan restriction returns actionable error without leaking provider details', async () => {
  const result = await run(['--apply'], 'blocked');
  assert.equal(result.status, 1);
  assert.match(result.output, /Configure a custom SMTP provider/);
});
