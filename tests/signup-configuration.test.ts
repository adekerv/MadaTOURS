import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
const script = new URL('../scripts/configure-signup.ts', import.meta.url).pathname;
for (const apply of [false, true]) {
  test(`signup configuration ${apply ? 'applies and verifies only email autoconfirm' : 'preview never changes settings'}`, async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'madatours-signup-config-'));
    try {
      const mock = `let state = {external_email_enabled:true,mailer_autoconfirm:false,external_phone_enabled:false};
        globalThis.fetch = async (url, options) => {
          if (url !== 'https://api.supabase.com/v1/projects/testproject/config/auth') throw new Error('Unexpected endpoint');
          console.log('REQUEST:'+options.method);
          if (options.method === 'PATCH') {
            const body=JSON.parse(options.body);
            if(JSON.stringify(body)!=='{"mailer_autoconfirm":true}') throw new Error('Unexpected setting');
            state={...state,...body};
          }
          return new Response(JSON.stringify(state));
        };`;
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          import.meta.resolve('tsx'),
          '--import',
          `data:text/javascript,${encodeURIComponent(mock)}`,
          script,
          ...(apply ? ['--apply'] : []),
        ],
        {
          cwd,
          encoding: 'utf8',
          env: {
            PATH: process.env.PATH,
            SUPABASE_ACCESS_TOKEN: 'private-test-token',
            SUPABASE_URL: 'https://testproject.supabase.co',
          },
        },
      );
      const output = result.stdout + result.stderr;
      assert.equal(result.status, 0, output);
      assert.ok(!output.includes('private-test-token'));
      assert.deepEqual(
        output.match(/REQUEST:\w+/g),
        apply ? ['REQUEST:GET', 'REQUEST:PATCH', 'REQUEST:GET'] : ['REQUEST:GET'],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
}
