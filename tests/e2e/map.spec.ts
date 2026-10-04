import { test, expect, type Page } from '@playwright/test';
import { countColors, landColor, seaColor, stubMap } from './support/map';

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        current: {
          temperature_2m: 28,
          relative_humidity_2m: 75,
          weather_code: 2,
          time: '2026-10-04T12:00',
        },
      },
    }),
  );
  await stubMap(page);
});
const tripStops = [6, 3, 2, 8];
async function seedTrip(page: Page) {
  await page.addInitScript((stops) => {
    localStorage.setItem(
      'madatours:trips:v1',
      JSON.stringify({
        version: 1,
        trips: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Day trip 1',
            date: '2026-10-04',
            startTime: '09:00',
            notes: '',
            stops: stops.map((placeId) => ({ placeId, minutes: 60 })),
            updatedAt: '2026-10-04T10:00:00.000Z',
          },
        ],
      }),
    );
  }, tripStops);
}
/**
 * The map really drew: its style's colours are on screen, not an empty grey box. A wide map shows sea and land;
 * a close-up of one inland place may be land alone, so `both` can be turned off for it.
 */
async function expectDrawnMap(page: Page, map: ReturnType<Page['locator']>, both = true) {
  await expect(map.locator('canvas.maplibregl-canvas')).toBeVisible();
  await expect
    .poll(async () => {
      const [sea, land] = await countColors(page, await map.screenshot(), [seaColor, landColor]);
      return both ? sea > 200 && land > 200 : sea + land > 5000;
    })
    .toBe(true);
}

test('the route map draws the island and the route on top of it', async ({ page }) => {
  await seedTrip(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Plan a day', exact: true }).click();
  const map = page.locator('.trip-map');
  await expect(page.locator('.route-pin')).toHaveCount(4);
  await expectDrawnMap(page, map);
  await expect(map.locator('.route-line').first()).toBeVisible();
  // The attribution OpenFreeMap and OpenStreetMap ask for is on the map.
  await expect(map.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
  await map.screenshot({ path: `test-results/map-route-${test.info().project.name}.png` });
});

test('the place page map draws the island', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#explore?filter=activity&radius=50&place=6');
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  await expectDrawnMap(page, page.getByRole('dialog').locator('.detail-map'), false);
});

test('the explore map draws the island under the place pills', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#explore');
  const map = page.locator('.leaflet-container').first();
  await expect(page.locator('.mt-cluster').first()).toBeVisible();
  // The results panel tints part of the map, so only the colours that stay exact are counted.
  await expectDrawnMap(page, map, false);
  await page.screenshot({ path: `test-results/map-explore-${test.info().project.name}.png` });
});
