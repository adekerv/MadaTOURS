import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ts from 'typescript';
test('compiled Vercel API loads in plain Node without a TypeScript loader or bundler', async () => {
  await mkdir('.data', { recursive: true });
  const output = await mkdtemp(path.resolve('.data/esm-runtime-'));
  try {
    for (const filename of [
      'api/index.ts',
      'server/app.ts',
      'server/origins.ts',
      'server/supabase.ts',
      'server/validation.ts',
      'src/lib/places-utils.ts',
      'src/lib/content.ts',
    ]) {
      const compiled = ts.transpileModule(await readFile(filename, 'utf8'), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          verbatimModuleSyntax: true,
        },
      });
      const target = path.join(output, filename.replace(/\.ts$/, '.js'));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, compiled.outputText);
    }
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const {default: app}=await import(${JSON.stringify(pathToFileURL(path.join(output, 'api/index.js')).href)});if(typeof app!=='function')throw new Error('Missing Express handler');console.log('API loaded');`,
      ],
      { env: { ...process.env, NODE_OPTIONS: '' } },
    );
    assert.equal(stdout.trim(), 'API loaded');
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
