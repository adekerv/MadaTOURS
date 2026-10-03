import { test, expect, type Page } from '@playwright/test';
import { translate } from '../../resources/js/i18n/core';

async function fitsAndTargets(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  const undersized = await page
    .locator(
      'button:not(:disabled),a[href],select,input:not([type=hidden]),textarea,summary,[role=button]',
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.width < 43.5 || rect.height < 43.5);
        })
        .map((element) => ({
          text: element.textContent?.trim().slice(0, 60) || element.getAttribute('aria-label'),
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        })),
    );
  expect(undersized).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        current: {
          temperature_2m: 28,
          relative_humidity_2m: 75,
          weather_code: 2,
          time: '2026-09-28T12:00',
        },
      },
    }),
  );
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
});
for (const language of ['en', 'fr'] as const)
  for (const width of [360, 390, 1440]) {
    test(`new discovery, planner and information flows fit ${language} at ${width}px`, async ({
      page,
    }) => {
      const t = (text: string) => translate(language, text);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?lang=${language}`);
      await expect(
        page.getByRole('heading', { name: t('Places to discover'), exact: true }),
      ).toBeVisible();
      await expect(page.locator('main img').first()).toBeVisible();
      await fitsAndTargets(page);
      await page.screenshot({
        animations: 'disabled',
        path: `test-results/ux-${test.info().project.name}-${language}-${width}-home.png`,
        fullPage: true,
      });
      await page.getByRole('button', { name: t('Dismiss introduction') }).click();
      await page.reload();
      await expect(page.getByRole('button', { name: t('Dismiss introduction') })).toHaveCount(0);
      await page.getByRole('button', { name: t('Plan a day'), exact: true }).click();
      await expect(page.getByRole('button', { name: t('New day trip'), exact: true })).toHaveCount(
        1,
      );
      await page.getByRole('button', { name: t('New day trip'), exact: true }).click();
      for (const id of ['3', '6', '2'])
        await page.getByLabel(t('Add a stop'), { exact: true }).selectOption(id);
      await page.getByRole('button', { name: t('Optimize route order') }).click();
      await expect(page.getByRole('dialog')).toContainText(
        language === 'en' ? 'Estimated total:' : 'Durée totale estimée',
      );
      await expect(page.getByRole('button', { name: t('New day trip'), exact: true })).toHaveCount(
        1,
      );
      expect(
        await page.getByRole('dialog').evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      ).toBe(true);
      await fitsAndTargets(page);
      await page.screenshot({
        animations: 'disabled',
        path: `test-results/ux-${test.info().project.name}-${language}-${width}-planner.png`,
      });
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: t('About'), exact: true }).click();
      await page.getByLabel(t('Place name'), { exact: true }).fill('Jardin test');
      await page.getByLabel(t('Town'), { exact: true }).fill('Saint-Pierre');
      await page.getByLabel(t('Source link'), { exact: true }).fill('https://example.com/place');
      await page
        .getByLabel(t('Your suggestion'), { exact: true })
        .fill('Une suggestion à vérifier.');
      await page.getByRole('button', { name: t('Prepare email suggestion') }).click();
      await expect(page.getByRole('link', { name: t('Open email draft') })).toHaveAttribute(
        'href',
        /^mailto:adejkervin@protonmail.com\?subject=/,
      );
      await fitsAndTargets(page);
      await page.screenshot({
        animations: 'disabled',
        path: `test-results/ux-${test.info().project.name}-${language}-${width}-about.png`,
        fullPage: true,
      });
      await page.goto(`/?lang=${language}#explore?filter=restaurant&radius=100&q=Quinoa`);
      await page
        .getByRole('button', {
          name: translate(language, 'Details for {name}', { name: 'Quinoa Beach' }),
          exact: true,
        })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(
        dialog.getByText(t('Check with the venue for current hours'), { exact: true }),
      ).toBeVisible();
      await expect(dialog.getByRole('link', { name: t('Directions') })).toHaveAttribute(
        'href',
        /google.com\/maps/,
      );
      // One rating prompt and no empty headings on a place nobody has reviewed yet.
      await expect(
        dialog.getByText(
          t('No reviews or comments yet. Be the first to share how your visit went.'),
        ),
      ).toBeVisible();
      await expect(dialog.getByRole('button', { name: t('Sign in'), exact: true })).toHaveCount(1);
      await expect(dialog.getByRole('heading', { name: t('Comments') })).toHaveCount(0);
      await page.screenshot({
        animations: 'disabled',
        path: `test-results/ux-${test.info().project.name}-${language}-${width}-details.png`,
      });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await fitsAndTargets(page);
    });
  }

test('recent search, empty-state suggestions, location consent and cached catalogue recovery work', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (success: (position: unknown) => void) =>
          success({ coords: { latitude: 14.602, longitude: -61.069 } }),
      },
    });
  });
  await page.goto('/');
  const search = page.getByRole('combobox', { name: 'Search places' });
  await search.fill('Balata');
  await expect(page.getByRole('option', { name: /Jardin de Balata/ })).toBeVisible();
  await search.press('ArrowDown');
  await search.press('Enter');
  await page.getByRole('button', { name: 'Back to home' }).click();
  await page.getByRole('combobox', { name: 'Search places' }).focus();
  await expect(page.getByText('Recent searches', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear history' }).click();
  await page.getByRole('combobox', { name: 'Search places' }).fill('zzzznonexistent');
  await expect(page.getByRole('button', { name: 'Sainte-Anne', exact: true })).toBeVisible();
  await page.goto('/#explore');
  await page.getByRole('button', { name: 'Places near me', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await expect(page.getByText('Sorted by distance from your location')).toBeVisible();
  const searchbox = page.getByRole('searchbox', { name: 'Filter places' });
  await searchbox.fill('Balata');
  await searchbox.press('Enter');
  await expect(page).toHaveURL(/q=Balata/);
  await page.route('**/api/places', (route) => route.abort());
  await page.reload();
  await expect(
    page.getByText('Connection unavailable. Showing the last loaded guide.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Details for Jardin de Balata', exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/places');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByText('Connection unavailable. Showing the last loaded guide.'),
  ).toHaveCount(0);
});
