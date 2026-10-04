import { test, expect, type Page } from '@playwright/test';
import { translate } from '../../resources/js/i18n/core';
import { randomUUID } from 'node:crypto';

const base = 'http://127.0.0.1:3100';
// A one-pixel PNG: the app turns it into a clean JPEG on the device before it uploads.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const stub = async (page: Page) => {
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        current: {
          temperature_2m: 28,
          relative_humidity_2m: 75,
          weather_code: 2,
          time: '2026-10-03T12:00',
        },
      },
    }),
  );
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
};
test.beforeEach(async ({ page }) => stub(page));
async function register(page: Page, name: string) {
  const response = await page.request.post('/api/auth/register', {
    headers: { 'X-MadaTours-Client': '1' },
    data: {
      name,
      email: `${randomUUID()}@example.test`,
      password: 'a long test password',
      language: 'en',
    },
  });
  expect(response.status()).toBe(201);
}

for (const [language, width] of [
  ['en', 360],
  ['fr', 1440],
] as const)
  test(`review text is public but its photos are for signed-in people only ${language} ${width}`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(90000);
    const t = (key: string, params?: Record<string, string>) => translate(language, key, params);
    const author = `Camille ${randomUUID().slice(0, 8)}`;
    const text = `A lovely afternoon with a view to share. ${randomUUID().slice(0, 8)}`;
    const place = `/?lang=${language}#explore?filter=activity&radius=50&place=6`;
    const openCommunity = async (target: Page) => {
      await target.goto(place);
      await target.getByRole('button', { name: t('View details'), exact: true }).click();
      const dialog = target.getByRole('dialog');
      await expect(
        dialog.getByRole('heading', { name: t('MadaTours community'), exact: true }),
      ).toBeVisible();
      return dialog;
    };
    // Thumbnails load lazily, so bring each one into view before checking that it arrived.
    const loaded = async (img: ReturnType<Page['locator']>) => {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          img.evaluate(
            (e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0,
          ),
        )
        .toBe(true);
    };

    // The author writes a review with a photo and sees both.
    await page.setViewportSize({ width, height: 900 });
    await register(page, author);
    const dialog = await openCommunity(page);
    await dialog.getByRole('textbox', { name: t('Your review'), exact: true }).fill(text);
    await dialog
      .locator('input[type=file]')
      .setInputFiles({ name: 'view.png', mimeType: 'image/png', buffer: png });
    await dialog.getByRole('button', { name: t('Publish or update review') }).click();
    await expect(
      dialog.getByText(t('Your review and photos are live. You can edit them here at any time.')),
    ).toBeVisible();
    const mine = dialog.locator('article').filter({ hasText: text });
    await expect(mine).toBeVisible();
    const photo = mine.getByRole('img', { name: t('Photo shared by {name}', { name: author }) });
    await expect(photo).toBeVisible();
    await loaded(photo);

    // A guest reads the review text and is shown nothing about photos: no image, frame, count or hint.
    const guest = await browser.newContext({
      baseURL: base,
      viewport: { width, height: 900 },
      locale: 'en-GB',
      serviceWorkers: 'block',
    });
    try {
      const guestPage = await guest.newPage();
      await stub(guestPage);
      const guestView = await openCommunity(guestPage);
      const seen = guestView.locator('article').filter({ hasText: text });
      await expect(seen).toBeVisible();
      await expect(seen.locator('img')).toHaveCount(0);
      await expect(seen.locator('a[href*="storage"], a[target=_blank]')).toHaveCount(0);
      await expect(seen).not.toContainText(/photo/i);
      await expect(guestView.locator('input[type=file]')).toHaveCount(0);
      expect(await guestView.locator('img[src*="storage"], img[src*="token="]').count()).toBe(0);
      // The API holds the same line, for a guest asking directly.
      const feed = await guest.request.get('/api/places/6/community');
      expect(feed.status()).toBe(200);
      expect(await feed.text()).not.toMatch(/photo|\.jpg|token=|storage/i);
      expect((await guest.request.get('/api/places/6/review-photos')).status()).toBe(401);
      expect(
        (
          await guest.request.delete(`/api/review-photos/${randomUUID()}`, {
            headers: { 'X-MadaTours-Client': '1' },
          })
        ).status(),
      ).toBe(401);

      // The same visitor signs in and now sees the photo.
      await register(guestPage, `Bob ${randomUUID().slice(0, 8)}`);
      const signedIn = await openCommunity(guestPage);
      const theirView = signedIn.locator('article').filter({ hasText: text });
      const shown = theirView.getByRole('img', {
        name: t('Photo shared by {name}', { name: author }),
      });
      await expect(shown).toBeVisible();
      await loaded(shown);
      // Other people can read it but not remove it.
      await expect(theirView.getByRole('button', { name: t('Remove photo') })).toHaveCount(0);
    } finally {
      await guest.close();
    }

    // The author can take their photo down again.
    await mine.getByRole('button', { name: t('Remove photo') }).click();
    await expect(dialog.getByText(t('Photo removed.'))).toBeVisible();
    await expect(mine.locator('img')).toHaveCount(0);
  });
