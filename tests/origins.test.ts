import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { configuredOrigins } from '../server/origins';
import { createApp } from '../server/app';

test('origin configuration accepts exact deployment URLs and normalizes safe configuration', () => {
  const origins = configuredOrigins({
    VERCEL: '1',
    APP_ORIGIN: ' https://mada-tours.vercel.app/\n',
    ALLOWED_ORIGINS: 'capacitor://localhost,https://localhost, https://custom.example/ ',
    VERCEL_URL: 'mada-tours-build-team.vercel.app',
    VERCEL_BRANCH_URL: 'mada-tours-git-main-team.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'mada-tours.vercel.app',
  });
  assert.deepEqual(
    [...origins].sort(),
    [
      'capacitor://localhost',
      'https://localhost',
      'https://custom.example',
      'https://mada-tours.vercel.app',
      'https://mada-tours-build-team.vercel.app',
      'https://mada-tours-git-main-team.vercel.app',
    ].sort(),
  );
  for (const origin of [
    'null',
    'https://other.vercel.app',
    'https://mada-tours.vercel.app.attacker.example',
  ])
    assert.equal(origins.has(origin), false);
  assert.equal(configuredOrigins({ VERCEL_URL: 'untrusted.example' }).size, 0);
  assert.equal(
    configuredOrigins({
      ALLOWED_ORIGINS:
        'null,*,https://user:pass@bad.example,https://bad.example/path,https://bad.example/?q=1',
    }).size,
    0,
  );
});

test('login/signup accept trusted origins and preflight while rejecting unrelated origins and missing CSRF headers', async () => {
  const saved = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'production',
    VERCEL: '1',
    APP_ORIGIN: 'https://mada-tours.vercel.app/',
    ALLOWED_ORIGINS: 'capacitor://localhost,https://localhost',
    VERCEL_URL: 'mada-tours-build-team.vercel.app',
    VERCEL_BRANCH_URL: 'mada-tours-git-main-team.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'mada-tours.vercel.app',
  });
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const origin of configuredOrigins()) {
      for (const endpoint of ['login', 'register']) {
        const response = await fetch(`${base}/api/auth/${endpoint}`, {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'X-MadaTours-Client': '1',
          },
          body: '{}',
        });
        assert.equal(response.status, 400, `${endpoint} from ${origin} reaches input validation`);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      }
      const preflight = await fetch(`${base}/api/auth/login`, {
        method: 'OPTIONS',
        headers: { Origin: origin },
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), 'true');
    }
    for (const origin of ['null', 'https://attacker.example', 'https://unrelated.vercel.app']) {
      const denied = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: {
          Origin: origin,
          Host: 'attacker.example',
          'X-Forwarded-Host': 'attacker.example',
          'X-MadaTours-Client': '1',
        },
      });
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
    }
    assert.equal(
      (
        await fetch(`${base}/api/auth/login`, {
          method: 'POST',
          headers: { Origin: 'https://mada-tours.vercel.app' },
        })
      ).status,
      403,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
