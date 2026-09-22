import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DatabaseSync } from 'node:sqlite';

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        current: {
          temperature_2m: 28,
          relative_humidity_2m: 75,
          weather_code: 2,
          time: '2026-09-22T12:00',
        },
      },
    }),
  );
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
});
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}

test('home, list, map, and details fit phone, tablet, landscape, and desktop viewports', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [667, 375],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noOverflow(page);
    await page.getByRole('button', { name: 'Explore the island', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Discover places' })).toBeVisible();
    await noOverflow(page);
    await page.getByRole('button', { name: 'Details for Jardin de Balata', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    );
    const bounds = await dialog.boundingBox();
    expect(bounds!.height).toBeLessThanOrEqual(height);
    await dialog.getByRole('button', { name: 'Close Jardin de Balata' }).click();
    if (width < 768) await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: `test-results/${test.info().project.name}-${width}.png` });
  }
  expect(errors).toEqual([]);
});

test('search accepts unaccented names, keyboard selection, and browser back navigation', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('combobox', { name: 'Search places' });
  await input.fill('pelee');
  await expect(page.getByRole('option')).toContainText('Montagne Pelée');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page).toHaveURL(/place=5/);
  await page.getByRole('button', { name: 'View details' }).click();
  await expect(page.getByRole('dialog')).toContainText('Montagne Pelée');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('combobox', { name: 'Search places' })).toBeVisible();
});

test('denied location offers manual selection and never calls IP geolocation', async ({ page }) => {
  let calledIpService = false;
  page.on('request', (request) => {
    if (request.url().includes('ipapi')) calledIpService = true;
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_success: unknown, failure: (error: { code: number }) => void) =>
          failure({ code: 1 }),
      },
    });
  });
  await page.goto('/#explore');
  await page.getByRole('button', { name: 'Choose search location' }).click();
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not access your location');
  await page.getByRole('button', { name: 'Choose on the map' }).click();
  await page.locator('.leaflet-container').click({ position: { x: 100, y: 150 } });
  await expect(page.getByText('Tap a point on the map to search nearby.')).toHaveCount(0);
  expect(calledIpService).toBe(false);
});

test('weather failure and catalogue failure are explicit and exploration still works', async ({
  page,
}) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await page.route('**/api/places', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  );
  await page.goto('/');
  await expect(page.getByText('Weather is unavailable right now.')).toBeVisible();
  await expect(page.getByText(/29°C/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore the island' }).click();
  await expect(
    page.getByText('Connection unavailable. Showing the last loaded guide.'),
  ).toBeVisible();
  await expect(page.getByRole('article')).not.toHaveCount(0);
});

test('register, save, restore session, remove, and delete account from the UI', async ({
  page,
}) => {
  const email = `e2e-${Date.now()}-${test.info().project.name}@example.test`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Browser test password 42');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore the island' }).click();
  await page.getByRole('button', { name: 'Details for Jardin de Balata', exact: true }).click();
  await page.getByRole('button', { name: 'Save favorite', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved to favorites' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to revisit list' }).click();
  await expect(page.getByRole('button', { name: 'On your revisit list' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Jardin de Balata' }).click();
  await page.getByRole('button', { name: 'Back to home' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your favorites' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Jardin de Balata' }).first().click();
  await expect(page.getByRole('heading', { name: 'Your favorites' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Your account', exact: true }).click();
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await page.getByLabel('Password', { exact: true }).fill('Browser test password 42');
  await page.getByRole('button', { name: 'Permanently delete my account' }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('admin-created places immediately appear in home search and can be deleted', async ({
  page,
}) => {
  const email = `admin-ui-${Date.now()}@example.test`;
  await page.request.post('/api/auth/register', {
    headers: { 'X-MadaTours-Client': '1' },
    data: { email, password: 'Admin browser password 42' },
  });
  const db = new DatabaseSync(process.env.MADATOURS_E2E_DB!);
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
  db.close();
  await page.goto('/');
  await page.getByRole('button', { name: 'Manage places', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('UI Test Cove');
  await page.getByLabel('Town', { exact: true }).fill('Test Town');
  await page.getByLabel('Latitude', { exact: true }).fill('14.6');
  await page.getByLabel('Longitude', { exact: true }).fill('-61.0');
  await page.getByLabel('Description', { exact: true }).fill('Test-only catalogue entry.');
  await page.getByRole('button', { name: 'Add place', exact: true }).click();
  await expect(
    page.getByText('Place added. It is now available in search and on the map.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close Manage places' }).click();
  await page.getByRole('combobox', { name: 'Search places' }).fill('UI Test Cove');
  await expect(page.getByRole('option', { name: /UI Test Cove/ })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Manage places', exact: true }).click();
  await page.getByRole('button', { name: 'Delete UI Test Cove', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete UI Test Cove', exact: true })).toHaveCount(
    0,
  );
  await page.request.delete('/api/account', {
    headers: { 'X-MadaTours-Client': '1' },
    data: { password: 'Admin browser password 42' },
  });
});

test('home, exploration, and authentication have no serious accessibility violations', async ({
  page,
}) => {
  await page.goto('/');
  const scan = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
    ).toEqual([]);
  };
  await scan();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await scan();
  await page.getByRole('button', { name: 'Close Welcome to MadaTours' }).click();
  await page.getByRole('button', { name: 'Explore the island' }).click();
  await scan();
});

test('opening a previously hidden mobile map fits both north and south Martinique', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#explore');
  await expect(page.getByRole('heading', { name: 'Discover places' })).toBeVisible();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.locator('.leaflet-marker-icon[title="Montagne Pelée Hike"]')).toBeInViewport();
  await expect(page.locator('.leaflet-marker-icon[title="Plage des Salines"]')).toBeInViewport();
  const header = await page.locator('.explore-header').boundingBox();
  expect(header!.y).toBeGreaterThanOrEqual(0);
});
