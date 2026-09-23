import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'allow' });
test('saved places remain readable after a complete offline reload', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Playwright service worker control is supported by Chromium.',
  );
  const email = `offline-${Date.now()}@example.test`;
  const headers = { 'X-MadaTours-Client': '1' };
  expect(
    (
      await page.request.post('/api/auth/register', {
        headers,
        data: { email, password: 'Offline browser password 42' },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post('/api/auth/verify', { headers, data: { email, token: '123456' } })
    ).ok(),
  ).toBe(true);
  expect((await page.request.post('/api/favorites', { headers, data: { placeId: 3 } })).ok()).toBe(
    true,
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your favorites' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open offline places', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Jardin de Balata');
  await expect(page.getByRole('dialog')).toContainText('Last saved:');
  await page.getByRole('button', { name: 'Remove offline copy' }).click();
  await expect(page.getByRole('dialog')).toContainText('No offline places yet.');
});
