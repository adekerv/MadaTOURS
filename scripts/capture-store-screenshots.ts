import { chromium, webkit } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { translate, type Language } from '../resources/js/i18n/core';
// Run against a local build. These are accurate webview previews, not signed-device captures.
const origin = process.env.SCREENSHOT_ORIGIN || 'http://127.0.0.1:3100';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw new Error('Use a local preview server for release captures.');
for (const platform of [
  { name: 'iphone', width: 440, height: 956, scale: 3, engine: webkit },
  { name: 'ipad', width: 1032, height: 1376, scale: 2, engine: webkit },
  { name: 'android', width: 360, height: 640, scale: 3, engine: chromium },
]) {
  const browser = await platform.engine.launch();
  try {
    for (const language of ['en', 'fr'] as Language[]) {
      const context = await browser.newContext({
        viewport: { width: platform.width, height: platform.height },
        deviceScaleFactor: platform.scale,
        isMobile: true,
        hasTouch: true,
        locale: language === 'fr' ? 'fr-FR' : 'en-GB',
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem('madatours:onboarding:v1', 'dismissed'));
      const directory = `native-assets/store/screenshots/${platform.name}/${language}`;
      await mkdir(directory, { recursive: true });
      const t = (message: string) => translate(language, message);
      async function capture(name: string) {
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            Array.from(document.images)
              .filter((img) => {
                const rect = img.getBoundingClientRect();
                return rect.top < innerHeight && rect.bottom > 0;
              })
              .map((img) => img.decode().catch(() => {})),
          );
        });
        await page.screenshot({ path: `${directory}/${name}.png`, animations: 'disabled' });
      }
      await page.goto(`${origin}/?lang=${language}`);
      await page.getByRole('heading', { name: t('Places to discover'), exact: true }).waitFor();
      await page.locator('[aria-labelledby="island-picks"]').scrollIntoViewIfNeeded();
      await capture('01-discover');
      await page.goto(`${origin}/?lang=${language}#explore?filter=activity&radius=50&place=3`);
      await page.getByRole('button', { name: t('View details'), exact: true }).click();
      await page.getByRole('dialog').locator('img').waitFor();
      await capture('02-place-details');
      await page.goto(`${origin}/?lang=${language}`);
      await page.getByRole('button', { name: t('Plan a day'), exact: true }).click();
      await page.getByRole('button', { name: t('New day trip'), exact: true }).click();
      await page
        .getByLabel(t('Trip name'), { exact: true })
        .fill(language === 'fr' ? 'Jardins et saveurs' : 'Gardens & island flavors');
      for (const id of ['3', '2'])
        await page.getByLabel(t('Add a stop'), { exact: true }).selectOption(id);
      await page.getByRole('dialog').evaluate((element) => (element.scrollTop = 0));
      await capture('03-day-planner');
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
console.log(
  'Bilingual store-size webview previews saved. Capture signed devices before submission.',
);
