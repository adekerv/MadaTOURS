import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { translate } from '../../resources/js/i18n/core';
import { stubMap } from './support/map';

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
  await stubMap(page);
});
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}

test('expanded catalogue paginates, filters by town and experience, and translates on a small phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/#explore');
  const sidebar = page.getByRole('complementary', { name: 'Places and filters' });
  await expect(sidebar.getByRole('article')).toHaveCount(30);
  await sidebar.getByText('Distance and sorting', { exact: false }).click();
  await expect(sidebar.getByRole('slider', { name: 'Search radius' })).toBeVisible();
  await sidebar.getByText('Distance and sorting', { exact: false }).click();
  await sidebar.getByRole('button', { name: /Show more places/ }).click();
  await expect(sidebar.getByRole('article')).toHaveCount(60);
  await sidebar.getByLabel('Town', { exact: true }).selectOption('Schœlcher');
  await sidebar.getByLabel('Experience', { exact: true }).selectOption('food');
  await expect(
    sidebar.getByRole('button', { name: 'Details for Le Cèdre', exact: true }),
  ).toBeVisible();
  await sidebar.getByRole('searchbox', { name: 'Filter places' }).fill('lebanese');
  await expect(sidebar.getByRole('article')).toHaveCount(1);
  await sidebar.getByRole('button', { name: 'Details for Le Cèdre', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Lebanese');
  // Sources are compact: one line until opened.
  await page.getByRole('dialog').getByText('Sources and updates').click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('link', { name: 'Terres du Centre Martinique', exact: true }),
  ).toHaveAttribute('href', /terresducentremartinique.fr/);
  await page.keyboard.press('Escape');
  await sidebar.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(sidebar.getByRole('article')).toHaveCount(30);
  await expect(sidebar.getByLabel('Town', { exact: true })).toHaveValue('');
  await expect(sidebar.getByLabel('Experience', { exact: true })).toHaveValue('');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('fr');
  await page.getByLabel('Expérience', { exact: true }).selectOption('beaches');
  await page.getByRole('searchbox', { name: 'Filtrer les lieux' }).fill('anse noire');
  await expect(
    page.getByRole('button', { name: 'Détails de Anse Noire', exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `test-results/${test.info().project.name}-catalogue-fr.png` });
});

test('home, list, map, and details fit phone, tablet, landscape, and desktop viewports', async ({
  page,
}) => {
  test.setTimeout(60000);
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
    await page.getByRole('searchbox', { name: 'Filter places' }).fill('Jardin de Balata');
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
    await expect(page.locator('.explore-map .leaflet-container')).toBeVisible();
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
  await expect(
    page.getByRole('listbox', { name: 'Matching places' }).getByRole('option').first(),
  ).toContainText('Montagne Pelée');
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
  await page.getByRole('button', { name: 'Create an account', exact: true }).first().click();
  await page.getByLabel('Your name', { exact: true }).fill('Camille');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Browser test password 42');
  await page.screenshot({ path: `test-results/${test.info().project.name}-signup.png` });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  // Signup hands over the recovery codes once; the window stays until they are saved.
  await expect(page.getByRole('dialog').locator('[data-recovery-code]')).toHaveCount(8);
  await page.getByLabel('I have saved these codes').check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByText('Thanks for signing up! Welcome, Camille.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Welcome, Camille.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Browser test password 42');
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Welcome, Camille.', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Explore the island' }).click();
  await page.getByRole('searchbox', { name: 'Filter places' }).fill('Jardin de Balata');
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
  await expect(page.getByRole('heading', { name: 'Account settings', level: 1 })).toBeVisible();
  await page.getByLabel(`Type ${email} to confirm`, { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Browser test password 42');
  await page.getByRole('button', { name: 'Permanently delete my account' }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByText('Your account and its data have been deleted.')).toBeVisible();
});

test('admin-created places immediately appear in home search and can be deleted', async ({
  page,
}) => {
  const email = `admin-ui-${Date.now()}@example.test`;
  await page.request.post('/api/auth/register', {
    headers: { 'X-MadaTours-Client': '1' },
    data: { name: 'Admin', email, password: 'Admin browser password 42' },
  });
  await page.request.post('http://127.0.0.1:3101/__test/admin', {
    headers: { 'X-Test-Token': process.env.MADATOURS_E2E_TOKEN! },
    data: { email },
  });
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
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Search places' }).click();
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
    data: { password: 'Admin browser password 42', confirmation: email },
  });
});

test('home, exploration, and authentication have no serious accessibility violations', async ({
  page,
}) => {
  await page.goto('/');
  const scan = async () => {
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
    );
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
  // At island zoom the pins are grouped; every group must sit inside the visible map.
  await expect(page.locator('.mt-cluster').first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const frame = document.querySelector('.leaflet-container')!.getBoundingClientRect();
        return [...document.querySelectorAll('.mt-cluster')].every((cluster) => {
          const box = cluster.getBoundingClientRect();
          return (
            box.left >= frame.left &&
            box.right <= frame.right &&
            box.top >= frame.top &&
            box.bottom <= frame.bottom
          );
        });
      }),
    )
    .toBe(true);
  const header = await page.locator('.explore-header').boundingBox();
  expect(header!.y).toBeGreaterThanOrEqual(0);
});

test('French preference survives reload and planner edits persist on the device', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Explorer l’île', exact: true })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: 'Planifier une journée', exact: true }).click();
  await page.getByRole('button', { name: 'Nouvelle journée', exact: true }).click();
  await page.getByLabel('Nom de la journée', { exact: true }).fill('Journée nature');
  await page.getByLabel('Ajouter une étape', { exact: true }).selectOption('3');
  await page.getByLabel('Ajouter une étape', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Monter Habitation Clément', exact: true }).click();
  await expect(page.getByRole('listitem').first()).toContainText('1. Habitation Clément');
  await page
    .getByRole('textbox', { name: 'Notes (facultatives)', exact: true })
    .fill('Prévoir un pique-nique');
  await noOverflow(page);
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Fermer Vos journées', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Planifier une journée', exact: true }).click();
  await expect(
    page.getByLabel('Choisir une journée', { exact: true }).locator('option:checked'),
  ).toHaveText('Journée nature');
  await expect(
    page.getByRole('textbox', { name: 'Notes (facultatives)', exact: true }),
  ).toHaveValue('Prévoir un pique-nique');
  await page.screenshot({ path: `test-results/${test.info().project.name}-planner-fr.png` });
  await expect(
    page.getByLabel('Ajouter une étape', { exact: true }).locator('option[value="7"]'),
  ).toHaveCount(0);
});

test('a forgotten password is reset with a recovery code, once, and the new password signs in', async ({
  page,
}) => {
  const email = `recovery-${Date.now()}@example.test`;
  const signup = await page.request.post('/api/auth/register', {
    headers: { 'X-MadaTours-Client': '1' },
    data: { name: 'Recovery user', email, password: 'Original password 42' },
  });
  const codes: string[] = (await signup.json()).recoveryCodes;
  expect(codes).toHaveLength(8);
  await page.request.post('/api/auth/logout', { headers: { 'X-MadaTours-Client': '1' } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
  // No email is promised anywhere on this screen.
  await expect(page.getByRole('dialog')).not.toContainText(/inbox|we sent|sent to your email/i);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Recovery code', { exact: true }).fill('ZZZZZ-ZZZZZ');
  await page.getByLabel('New password', { exact: true }).fill('Replacement password 42');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('The email or recovery code is not valid.');
  await page.getByLabel('Recovery code', { exact: true }).fill(codes[0].toLowerCase());
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Password updated. Sign in with your new password.')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('Replacement password 42');
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The same code does nothing a second time.
  await page.request.post('/api/auth/logout', { headers: { 'X-MadaTours-Client': '1' } });
  const again = await page.request.post('/api/auth/recover', {
    headers: { 'X-MadaTours-Client': '1' },
    data: { email, code: codes[0], password: 'Third password 4242' },
  });
  expect(again.status()).toBe(400);
});

test('dense pins cluster, and cards, pins and layers stay in sync', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#explore');
  await expect(page.getByRole('heading', { name: 'Discover places' })).toBeVisible();
  await expect(page.locator('.mt-cluster').first()).toBeVisible();
  // Hovering a card lights the pin, or the cluster hiding it.
  await page.locator('.place-results article').nth(1).hover();
  await expect(page.locator('.leaflet-marker-icon.is-hot')).toHaveCount(1);
  // Zooming into a cluster eventually reveals single pins; picking one selects its card.
  const pin = page.locator('.map-pill-container');
  for (let step = 0; step < 8 && !(await pin.count()); step += 1) {
    await page.locator('.mt-cluster').first().click();
    await page.waitForTimeout(700);
  }
  await pin.first().click({ force: true });
  await expect(page.locator('.map-pill-active')).toHaveCount(1);
  await expect(page.locator('.place-card.border-orange-600')).toHaveCount(1);
  // Map layers narrow the same results shown in the list.
  const all = page.getByText(/\d+ places found/);
  const before = Number((await all.innerText()).match(/\d+/)![0]);
  await page
    .getByRole('group', { name: 'Map layers' })
    .getByRole('button', { name: 'Food' })
    .click();
  await expect
    .poll(async () => Number((await all.innerText()).match(/\d+/)![0]))
    .toBeLessThan(before);
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeHidden();
});

test('compact screens open the filters as a bottom sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#explore');
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Filters' });
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box!.y + box!.height).toBeGreaterThan(843);
  await sheet.getByRole('button', { name: 'Activities' }).click();
  await sheet.getByRole('button', { name: /Show results/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: /^Filters/ })).toContainText('1');
});

test('the Explore location bar is a named region, so no content sits outside a landmark', async ({
  page,
}) => {
  await page.goto('/#explore');
  const region = page.getByRole('region', { name: 'Search area' });
  await expect(region).toBeVisible();
  await expect(region.getByRole('button', { name: 'Places near me' })).toBeVisible();
});

for (const language of ['en', 'fr'] as const)
  test(`the browser's form checks speak the app language (${language})`, async ({ page }) => {
    const t = (message: string) => translate(language, message);
    await page.goto(`/?lang=${language}`);
    await page
      .getByRole('button', { name: t('Sign in'), exact: true })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: t('New here? Create an account') }).click();
    await dialog.getByLabel(t('Your name')).fill('Camille');
    await dialog.locator('input[type=email]').fill('camille@example.test');
    const password = dialog.locator('input[autocomplete=new-password]');
    await password.fill('short');
    await dialog.getByRole('button', { name: t('Create account'), exact: true }).click();
    // The browser blocks the form and shows this message, in the app's language rather than the browser's.
    await expect
      .poll(() => password.evaluate((input: HTMLInputElement) => input.validationMessage))
      .toBe(
        translate(language, 'Use at least {min} characters (you have {count}).', {
          min: 12,
          count: 5,
        }),
      );
    // Editing the field clears the message, so the form can be sent once the password is long enough.
    await password.fill('a long enough password');
    expect(await password.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(true);
  });
