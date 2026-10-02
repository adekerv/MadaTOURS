import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { testDatabase } from './database';
import { testClients } from './clients';
import { createProvider } from './provider';

export async function startLaravel(port = 0, providerPort = 0) {
  const db = await testDatabase();
  const fixture = testClients(db);
  const provider = createProvider(fixture).listen(providerPort, '127.0.0.1');
  await once(provider, 'listening');
  const address = provider.address();
  if (!address || typeof address === 'string') throw new Error('Missing provider port');
  if (!port) {
    const probe = createServer().listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const available = probe.address();
    if (!available || typeof available === 'string') throw new Error('Missing HTTP port');
    port = available.port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
  }
  const storage = await mkdtemp(path.join(tmpdir(), 'madatours-test-'));
  for (const directory of ['sessions', 'cache', 'views'])
    await mkdir(path.join(storage, directory));
  const origin = `http://127.0.0.1:${port}`;
  const php = spawn(
    'php',
    [
      '-S',
      `127.0.0.1:${port}`,
      '../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php',
    ],
    {
      cwd: path.resolve('public'),
      stdio: ['ignore', 'ignore', 'pipe'],
      env: {
        ...process.env,
        APP_ENV: 'testing',
        APP_DEBUG: 'false',
        MAIL_MAILER: 'array',
        APP_KEY: `base64:${randomBytes(32).toString('base64')}`,
        APP_URL: origin,
        APP_ORIGIN: origin,
        APP_CONFIG_CACHE: path.join(storage, 'config.php'),
        APP_ROUTES_CACHE: path.join(storage, 'routes.php'),
        SUPABASE_URL: `http://127.0.0.1:${address.port}`,
        SUPABASE_PUBLISHABLE_KEY: 'test-public',
        SUPABASE_SECRET_KEY: 'test-secret',
        // E2E_SESSION_DRIVER=cookie reproduces the Vercel configuration (api/index.php).
        SESSION_DRIVER: process.env.E2E_SESSION_DRIVER === 'cookie' ? 'cookie' : 'file',
        SESSION_ENCRYPT: process.env.E2E_SESSION_DRIVER === 'cookie' ? 'false' : 'true',
        SESSION_SECURE_COOKIE: 'false',
        SESSION_SAME_SITE: 'lax',
        SESSION_FILES: path.join(storage, 'sessions'),
        CACHE_STORE: 'file',
        CACHE_PATH: path.join(storage, 'cache'),
        VIEW_COMPILED_PATH: path.join(storage, 'views'),
      },
    },
  );
  let errors = '';
  php.stderr.on('data', (chunk: Buffer) => {
    errors = (errors + chunk.toString()).slice(-4000);
  });
  const exited = once(php, 'exit');
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    php.kill('SIGTERM');
    await exited;
    provider.closeAllConnections();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
    await db.close();
    await rm(storage, { recursive: true, force: true });
  };
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (php.exitCode !== null) throw new Error(`Laravel exited: ${errors}`);
      try {
        if ((await fetch(`${origin}/up`, { signal: AbortSignal.timeout(1000) })).ok)
          return { origin, fixture, db, close };
      } catch {
        /* Wait for PHP to bind its socket. */
      }
      await delay(100);
    }
    throw new Error(`Laravel failed to start: ${errors}`);
  } catch (error) {
    await close();
    throw error;
  }
}
