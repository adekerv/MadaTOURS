import { test, expect, type Page } from '@playwright/test';
import { stubMap } from './support/map';
const rich = {
  address: 'Quartier le Coin, 97221 Le Carbet',
  phone: '+596 596 78 04 34',
  website: 'https://www.lepetibonum.com/',
  facebook: 'https://www.facebook.com/lepetibonum/',
  instagram: 'https://www.instagram.com/petibonum972/',
  hoursText: 'Lundi au Samedi : 11h30 – 15h30\nVendredi : 19h – 22h',
  priceRange: '16 €',
  kind: ['Restaurant de plage'],
  payment: ['Cartes bancaires', 'Espèces'],
  languages: ['Français', 'Anglais'],
  services: ['Point wifi'],
  from: { address: { url: 'https://www.martinique.org/fr/x', checkedAt: '2026-10-02' } },
};
/** Serves the real catalogue, but rewrites two places so the page can be checked against known facts. */
async function stubCatalogue(page: Page) {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await stubMap(page);
  await page.route('**/api/places', async (route) => {
    const response = await route.fetch();
    const places = (await response.json()) as Record<string, unknown>[];
    for (const place of places) {
      if (place.id === 1) {
        place.details = rich;
        // Real structured hours would take precedence over the text hours checked below.
        delete place.openingPeriods;
        delete place.hoursSource;
      }
      if (place.id === 2) {
        delete place.details;
        delete place.openingPeriods;
        delete place.hours;
        place.description = 'A plain place. Listed street: 1 Rue Test. Contact: +596 596 11 22 33.';
        place.listingStatus = 'needs_review';
      }
    }
    await route.fulfill({ response, json: places });
  });
}
async function open(page: Page, name: string, language = 'en') {
  await page.goto(`/?lang=${language}#explore?filter=all&radius=100&q=${encodeURIComponent(name)}`);
  const label = language === 'fr' ? `Détails de ${name}` : `Details for ${name}`;
  await page.getByRole('button', { name: label, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}
test('a place with source facts shows each one, with real contact details and nothing empty', async ({
  page,
}) => {
  await stubCatalogue(page);
  const dialog = await open(page, 'Le Petibonum');
  await expect(dialog.getByRole('link', { name: /Call\s*\+596 596 78 04 34/ })).toHaveAttribute(
    'href',
    'tel:+596596780434',
  );
  await expect(dialog.getByRole('link', { name: /^Website/ })).toHaveAttribute(
    'href',
    'https://www.lepetibonum.com/',
  );
  await expect(dialog.getByRole('link', { name: /^Directions/ })).toBeVisible();
  const info = dialog.getByRole('region', { name: 'Practical information' });
  await expect(info).toContainText('Quartier le Coin, 97221 Le Carbet');
  await expect(info).toContainText('Lundi au Samedi : 11h30 – 15h30');
  await expect(info).toContainText('As listed by the source.');
  await expect(info).toContainText('16 €');
  await expect(info).toContainText('Beach restaurant');
  await expect(info).toContainText('Bank cards, Cash');
  await expect(info).toContainText('French, English');
  await expect(info).toContainText('Wi-Fi');
  await expect(info.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
    'href',
    'https://www.facebook.com/lepetibonum/',
  );
  await expect(info.getByRole('link', { name: 'Instagram' })).toHaveAttribute(
    'href',
    'https://www.instagram.com/petibonum972/',
  );
  await expect(dialog.getByText('Check with the venue for current hours')).toHaveCount(0);
  await expect(dialog.getByText('Call the venue')).toHaveCount(0);
  // Every heading has content under it.
  await expect(dialog.getByRole('heading', { name: 'Place comments' })).toHaveCount(0);
  // Tags sit directly under the type and town, above the photo.
  const tags = dialog.getByRole('list', { name: 'Place tags' });
  const photo = dialog.locator('img').first();
  expect((await tags.boundingBox())!.y).toBeLessThan((await photo.boundingBox())!.y);
});
test('a place without contact facts offers no empty slots, falls back to older text, and notes unconfirmed details', async ({
  page,
}) => {
  await stubCatalogue(page);
  const dialog = await open(page, 'Habitation Clément');
  await expect(dialog.getByRole('link', { name: /^Website/ })).toHaveCount(0);
  const info = dialog.getByRole('region', { name: 'Practical information' });
  await expect(info).toContainText('1 Rue Test');
  await expect(info.getByRole('link', { name: '+596 596 11 22 33' })).toHaveAttribute(
    'href',
    'tel:+596596112233',
  );
  await expect(info).toContainText('Check with the venue for current hours');
  await expect(dialog.getByText('A plain place.', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Listed street')).toHaveCount(0);
  await expect(
    dialog.getByRole('note').filter({ hasText: "couldn't confirm recent details" }),
  ).toBeVisible();
});
test('the detail page reads in French and fits a small phone', async ({ page }) => {
  await stubCatalogue(page);
  await page.setViewportSize({ width: 360, height: 740 });
  const dialog = await open(page, 'Le Petibonum', 'fr');
  const info = dialog.getByRole('region', { name: 'Informations pratiques' });
  await expect(info).toContainText('Cartes bancaires, Espèces');
  await expect(info).toContainText('Restaurant de plage');
  await expect(info).toContainText('Tel que publié par la source.');
  await expect(dialog.getByRole('link', { name: /^Appeler le/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  const box = await dialog.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(360);
});
