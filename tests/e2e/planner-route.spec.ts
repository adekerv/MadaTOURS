import { test, expect, type Page } from '@playwright/test';
import { translate } from '../../resources/js/i18n/core';

test.beforeEach(async ({ page }) => {
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
});
const fits = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  expect(await page.getByRole('dialog').evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(
    true,
  );
};

for (const language of ['en', 'fr'] as const)
  for (const width of [360, 1440]) {
    test(`planner draws the route in order and shows when the trip starts ${language} ${width}`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      const t = (key: string, params?: Record<string, string>) => translate(language, key, params);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?lang=${language}`);
      await page.getByRole('button', { name: t('Plan a day'), exact: true }).click();
      await page.getByRole('button', { name: t('New day trip'), exact: true }).click();
      const dialog = page.getByRole('dialog');
      for (const id of ['3', '6', '2'])
        await dialog.getByLabel(t('Add a stop'), { exact: true }).selectOption(id);
      const names = async () =>
        (await dialog.locator('ol > li h3').allTextContents()).map((text) =>
          text.replace(/^\d+\.\s*/, ''),
        );
      const stops = await names();
      expect(stops).toHaveLength(3);
      const label = (order: string[]) =>
        t('Route map: {stops}', { stops: order.map((name, i) => `${i + 1}. ${name}`).join(', ') });
      let current = stops;
      const map = () => dialog.getByRole('img', { name: label(current), exact: true });

      // Numbered pins in order, a line and an arrow for each leg, and every pin inside the map.
      await expect(map()).toBeVisible();
      await expect(dialog.locator('.route-pin')).toHaveCount(3);
      await expect(dialog.locator('.route-pin-number')).toHaveText(['1', '2', '3']);
      await expect(dialog.locator('.route-line')).toHaveCount(2);
      // Arrows are drawn only on legs long enough to hold one, so a short leg may go without.
      await expect.poll(() => dialog.locator('.route-arrow').count()).toBeGreaterThanOrEqual(1);
      expect(await dialog.locator('.route-arrow').count()).toBeLessThanOrEqual(2);
      const inside = async () => {
        const frame = (await map().boundingBox())!;
        for (const pin of await dialog.locator('.route-pin').all()) {
          const box = (await pin.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(frame.x - 1);
          expect(box.y).toBeGreaterThanOrEqual(frame.y - 1);
          expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
          expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
        }
      };
      await inside();

      // No start yet: the map asks for one instead of guessing.
      await expect(
        dialog.getByText(t('Set a date and start time to show when your trip starts.')),
      ).toBeVisible();
      await expect(dialog.locator('.route-start-badge')).toHaveCount(0);

      // The start shows on the route and on the plan.
      await dialog.getByLabel(t('Date (optional)'), { exact: true }).fill('2026-10-04');
      await dialog.getByLabel(t('Start time (Martinique)'), { exact: true }).fill('09:00');
      const badge = dialog.locator('.route-start-badge');
      await expect(badge).toBeVisible();
      await expect(badge).toContainText('09:00');
      await expect(badge).toContainText(t('Starts: {when}', { when: '' }).trim());
      await expect(dialog.locator('.route-pin-start .route-pin-number')).toHaveText('1');
      await expect(
        dialog.getByText(t('Start {time}', { time: '09:00' }), { exact: true }),
      ).toBeVisible();
      await expect(dialog.getByText(/^(Arrive|Arrivée) \d\d:\d\d$/)).toHaveCount(2);
      await expect(dialog.getByText(/(Estimated finish|Fin estimée)/)).toBeVisible();
      await expect(
        dialog.getByText(t('Set a date and start time to show when your trip starts.')),
      ).toHaveCount(0);
      await inside();
      await fits(page);

      // Reordering redraws the route in the new order.
      const lateArrival = await dialog
        .getByText(/^(Arrive|Arrivée) \d\d:\d\d$/)
        .last()
        .textContent();
      await dialog.getByRole('button', { name: t('Move {name} up', { name: stops[2] }) }).click();
      const moved = [stops[0], stops[2], stops[1]];
      current = moved;
      await expect(map()).toBeVisible();
      await expect(dialog.locator('.route-pin-number')).toHaveText(['1', '2', '3']);
      await expect(
        dialog.getByText(t('Start {time}', { time: '09:00' }), { exact: true }),
      ).toBeVisible();
      expect(await names()).toEqual(moved);
      expect(
        await dialog
          .getByText(/^(Arrive|Arrivée) \d\d:\d\d$/)
          .last()
          .textContent(),
      ).not.toBe(lateArrival);
      await inside();
      await page.screenshot({
        animations: 'disabled',
        path: `test-results/planner-route-${test.info().project.name}-${language}-${width}.png`,
      });

      // The start time is saved with the trip on this device.
      await page.keyboard.press('Escape');
      await page.reload();
      await page.getByRole('button', { name: t('Plan a day'), exact: true }).click();
      await expect(dialog.getByLabel(t('Start time (Martinique)'), { exact: true })).toHaveValue(
        '09:00',
      );
      await expect(dialog.locator('.route-pin')).toHaveCount(3);
      await expect(dialog.getByRole('img', { name: label(moved), exact: true })).toBeVisible();
      await fits(page);
    });
  }
