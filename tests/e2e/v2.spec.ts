import { test, expect, type Page } from '@playwright/test';
import { translate, type Language } from '../../resources/js/i18n/core';
import { randomUUID } from 'node:crypto';

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        current: {
          temperature_2m: 28,
          relative_humidity_2m: 75,
          weather_code: 2,
          time: '2026-09-29T12:00',
        },
      },
    }),
  );
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
});
async function register(page: Page) {
  const name = `Camille ${randomUUID().slice(0, 8)}`;
  const email = `${randomUUID()}@example.test`;
  const response = await page.request.post('/api/auth/register', {
    headers: { 'X-MadaTours-Client': '1' },
    data: { name, email, password: 'a long test password', language: 'en' },
  });
  expect(response.status()).toBe(201);
  return { name, email };
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  const modal = page.getByRole('dialog');
  if (await modal.count())
    expect(await modal.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
}
for (const language of ['en', 'fr'] as const)
  for (const width of [360, 390, 1440]) {
    test(`v2 dark pages, reviews, verification and trip suggestions ${language} ${width}`, async ({
      page,
      context,
    }) => {
      test.setTimeout(45000);
      const t = (s: string) => translate(language, s);
      const user = await register(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?lang=${language}`);
      await page.getByRole('combobox', { name: t('Appearance'), exact: true }).selectOption('dark');
      await page.reload();
      await expect(page.locator('html')).toHaveClass(/dark/);
      for (const route of ['about', 'contact', 'privacy', 'terms', 'delete-account']) {
        await page.goto(`/?lang=${language}#${route}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await fits(page);
      }
      await page.goto(`/?lang=${language}#explore?filter=activity&radius=50&place=6`);
      await page.getByRole('button', {name:t('View details'),exact:true}).click();
      const dialog = page.getByRole('dialog');
      await expect(
        dialog.getByRole('heading', { name: t('MadaTours community'), exact: true }),
      ).toBeVisible();
      await dialog
        .getByRole('textbox', {name: t('Your review'), exact: true })
        .fill('A lovely afternoon here, with beautiful views.');
      await dialog.getByRole('combobox', { name: t('Your rating'), exact: true }).selectOption('4');
      await dialog.getByRole('button', { name: t('Publish or update review') }).click();
      await expect(
        dialog.getByText('A lovely afternoon here, with beautiful views.', { exact: true }),
      ).toBeVisible();
      await dialog.getByRole('button', { name: t("I've been here"), exact: true }).click();
      await expect(
        dialog.getByText(translate(language, 'Visited {count} times this year', { count: 1 })),
      ).toBeVisible();
      await dialog
        .getByRole('textbox', {name: t('Your review'), exact: true })
        .fill('Updated review after another pleasant visit.');
      await dialog.getByRole('button', { name: t('Publish or update review') }).click();
      await expect(
        dialog.getByText('Updated review after another pleasant visit.', { exact: true }),
      ).toBeVisible();
      await fits(page);
      await page.screenshot({
        path: `test-results/v2-${test.info().project.name}-${language}-${width}-review-dark.png`,
      });
      await page.keyboard.press('Escape');
      await page.goto(`/?lang=${language}`);
      await page.getByRole('button', { name: t('Community and meet-ups'), exact: true }).click();
      await page.getByRole('button', { name: t('Meet-ups'), exact: true }).click();
      await page.getByRole('button', { name: t('Send verification code'), exact: true }).click();
      await page.getByLabel(t('Verification code'), { exact: true }).fill('123456');
      await page.getByRole('button', { name: t('Verify email'), exact: true }).click();
      await expect(page.getByText(t('Email verified'), { exact: true })).toBeVisible();
      await fits(page);
      await page.keyboard.press('Escape');
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 14.61, longitude: -61.07 });
      await page.getByRole('button', { name: t('Suggest a trip route'), exact: true }).click();
      await page.getByRole('button', { name: t('Use my location and suggest a route') }).click();
      await expect(page.getByRole('button', { name: t('Save to my day planner') })).toBeVisible();
      await fits(page);
      await page.getByRole('button', { name: t('Save to my day planner') }).click();
      await expect(page.getByRole('dialog')).toContainText(t('My suggested day trip'));
      await page.keyboard.press('Escape');
      await page.goto(`/?lang=${language}`);
      await expect(
        page.getByText(translate(language, 'Welcome, {name}.', { name: user.name }), {
          exact: true,
        }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/v2-${test.info().project.name}-${language}-${width}-home-dark.png`,
        fullPage: true,
      });
      await page
        .getByRole('combobox', { name: t('Appearance'), exact: true })
        .selectOption('light');
      await expect(page.locator('html')).not.toHaveClass(/dark/);
    });
  }

for (const language of ['en', 'fr'] as Language[])
  test(`v2 photo submission, private queue and bilingual publication ${language}`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    const t = (s: string) => translate(language, s);
    const user = await register(page);
    const name = `Community coast ${randomUUID().slice(0, 6)}`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?lang=${language}`);
    await page.getByRole('combobox', { name: t('Appearance'), exact: true }).selectOption('dark');
    await page.getByRole('button', { name: t('Suggest a place'), exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(t('Place name'), { exact: true }).fill(name);
    await dialog.getByRole('combobox', { name: t('Type'), exact: true }).selectOption('cultural');
    await dialog
      .getByLabel(t('Address'), { exact: true })
      .fill('Rue du front de mer, Saint-Pierre');
    await dialog.getByLabel(t('Latitude'), { exact: true }).fill('14.74');
    await dialog.getByLabel(t('Longitude'), { exact: true }).fill('-61.17');
    await dialog
      .getByLabel(t('Describe the place (at least 40 characters)'), { exact: true })
      .fill('A community cultural place by the sea, with a small exhibition and a shaded terrace.');
    await dialog
      .getByLabel(t('Upload your photo'), { exact: true })
      .setInputFiles('public/assets/placeholders/culture.jpg');
    await expect(dialog.getByAltText(t('Your submission photo preview'))).toBeVisible();
    await dialog
      .getByLabel(
        t(
          'I took this photo or have permission to publish it, and agree to the contribution terms.',
        ),
      )
      .check();
    await fits(page);
    await dialog.getByRole('button', { name: t('Submit for review'), exact: true }).click();
    await expect(
      dialog.getByText(t('Submission sent. You will see the moderation decision here.'), {
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog.getByText(t('Under review'), { exact: true })).toBeVisible();
    const catalogue = await (await page.request.get('/api/places')).json();
    expect(catalogue.some((p: { name: string }) => p.name === name)).toBe(false);
    await page.request.post('http://127.0.0.1:3101/__test/admin', {
      headers: { 'X-Test-Token': process.env.MADATOURS_E2E_TOKEN! },
      data: { email: user.email },
    });
    await page.goto(`/?lang=${language}`);
    await page.getByRole('button', { name: t('Manage places'), exact: true }).click();
    await page.getByText(t('Place submissions'), { exact: true }).first().click();
    const article = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(article.locator('img')).toBeVisible();
    await article.getByRole('button', { name: t('Review submission') }).click();
    await page
      .getByRole('textbox', {name: t('English description'), exact: true })
      .fill('A community cultural place by the sea, with a small exhibition and a shaded terrace.');
    await page
      .getByRole('textbox', {name: t('French description'), exact: true })
      .fill(
        'Un lieu culturel communautaire au bord de la mer, avec une petite exposition et une terrasse ombragée.',
      );
    await page.getByRole('button', { name: t('Approve and publish'), exact: true }).click();
    await expect(article).toHaveCount(0);
    const published = (await (await page.request.get('/api/places')).json()).find(
      (p: { name: string }) => p.name === name,
    );
    expect(published.descriptionFr).toContain('culturel');
    const photo = await page.request.get(published.image);
    expect(photo.ok()).toBe(true);
    expect(photo.headers()['content-type']).toContain('image/jpeg');
    await page.keyboard.press('Escape');
    await page.goto(`/?lang=${language}#explore?filter=activity&radius=100&place=${published.id}`);
    await page.getByRole('button', {name:t('View details'),exact:true}).click();
    await expect(page.getByRole('dialog')).toContainText(name);
    await fits(page);
    await page.screenshot({
      path: `test-results/v2-${test.info().project.name}-${language}-submission-published.png`,
    });
  });
