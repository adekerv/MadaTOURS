import { test, expect, type Locator, type Page } from '@playwright/test';
import { stubMap } from './support/map';

const provider = 'http://127.0.0.1:3101';
const testHeaders = () => ({ 'X-Test-Token': process.env.MADATOURS_E2E_TOKEN! });
const client = { 'X-MadaTours-Client': '1' };
const password = 'Tours browser password 42';

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
test.afterEach(async ({ page }) => {
  await page.request.post(`${provider}/__test/ors`, {
    headers: testHeaders(),
    data: { mode: 'ok', reset: true },
  });
});

/** Registers an administrator in this browser context and returns the address, so the account can be removed. */
async function signInAsAdmin(page: Page) {
  const email = `tours-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  const signup = await page.request.post('/api/auth/register', {
    headers: client,
    data: { name: 'Tour admin', email, password },
  });
  expect(signup.ok()).toBe(true);
  await page.request.post(`${provider}/__test/admin`, { headers: testHeaders(), data: { email } });
  return email;
}
/** Deletes every tour and the account, so other specs never see this spec's data on the homepage. */
async function cleanUp(page: Page, email: string) {
  const tours = await page.request.get('/api/moderation/tours');
  if (tours.ok())
    for (const tour of (await tours.json()) as { id: number }[])
      await page.request.delete(`/api/tours/${tour.id}`, { headers: client });
  await page.request.delete('/api/account', {
    headers: client,
    data: { password, confirmation: email },
  });
}
async function createTourByApi(page: Page, name: string) {
  const places = (await (await page.request.get('/api/places')).json()) as {
    id: number;
    lat: number;
    lng: number;
  }[];
  // Two stops far enough apart for the road to be obvious on the map.
  const [a, b] = [...places]
    .sort((x, y) => x.lat - y.lat)
    .filter((_, i, all) => i === 0 || i === all.length - 1);
  const response = await page.request.post('/api/tours', {
    headers: client,
    data: {
      name,
      description: 'Across the whole island, one stop at a time.',
      published: true,
      stops: [
        { placeId: a.id, minutes: 60 },
        { placeId: b.id, minutes: 45 },
      ],
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number; routeSource: string };
}
async function openTour(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Island tours' }).scrollIntoViewIfNeeded();
  // The list settles as the page finishes loading; if a tap lands too early the dialog does not open, so tap again.
  await expect(async () => {
    if (!(await page.getByRole('dialog').isVisible()))
      await page.getByRole('button', { name: new RegExp(name) }).click({ timeout: 3000 });
    await expect(page.getByRole('dialog').locator('.route-pin')).toHaveCount(2, { timeout: 3000 });
  }).toPass({ timeout: 20000 });
}
/** The map credit wraps to two lines on a narrow phone; it must never sit on top of a pin. */
const creditCoversNoPin = (dialog: Locator) =>
  dialog.evaluate((node) => {
    const credit = node.querySelector('.leaflet-control-attribution')!.getBoundingClientRect();
    return [...node.querySelectorAll('.route-pin')].every((pin) => {
      const box = pin.getBoundingClientRect();
      return (
        box.right <= credit.left ||
        box.left >= credit.right ||
        box.bottom <= credit.top ||
        box.top >= credit.bottom
      );
    });
  });
const fillTour = async (page: Page, name: string) => {
  await page
    .getByRole('dialog')
    .locator('summary', { hasText: /^\s*Tours\s*$/ })
    .click();
  // A place visitors cannot go to is not offered, as in the day planner.
  await expect(
    page.getByLabel('Add a stop').locator('option', { hasText: 'Cascade Didier' }),
  ).toHaveCount(0);
  await page.getByLabel('Tour name', { exact: true }).fill(name);
  await page
    .getByLabel('Tour description', { exact: true })
    .fill('Two beautiful stops with the road between them.');
  for (let stop = 0; stop < 2; stop++) {
    await page.getByLabel('Add a stop').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Add stop', exact: true }).click();
  }
  await page.getByLabel('Publish this tour on the homepage').check();
};

test('an administrator saves a tour and visitors see its stored road route', async ({ page }) => {
  test.setTimeout(60000);
  const email = await signInAsAdmin(page);
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Manage places', exact: true }).click();
    await fillTour(page, 'Road trip');
    await page.getByRole('button', { name: 'Add tour', exact: true }).click();
    await expect(page.getByText(/Tour saved\. The road route is [\d.]+ km long\./)).toBeVisible();
    await expect(page.getByText('Road route: 3.0 km')).toBeVisible();
    await page.getByRole('button', { name: 'Close Manage places' }).click();

    // Reading the tour never asks for a route again: one request was made, when it was saved.
    const asked = await (
      await page.request.get(`${provider}/__test/ors`, { headers: testHeaders() })
    ).json();
    expect(asked.requests).toHaveLength(1);

    await openTour(page, 'Road trip');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('3.0 km by road')).toBeVisible();
    await expect(
      dialog.getByText('The line follows the road between the stops.', { exact: false }),
    ).toBeVisible();
    await expect(dialog.locator('.route-line-road')).toHaveCount(1);
    await expect.poll(() => dialog.locator('.route-arrow').count()).toBeGreaterThan(0);
    await expect.poll(() => creditCoversNoPin(dialog)).toBe(true);
    // The drawn line really bends: it has a vertex between the two stops, which a straight line never has.
    const vertices = await dialog
      .locator('.route-line-road')
      .evaluate((path) => (path.getAttribute('d')!.match(/[ML]/g) ?? []).length);
    expect(vertices).toBeGreaterThanOrEqual(3);
    await expect(dialog.locator('.leaflet-container canvas.maplibregl-canvas')).toBeVisible();
    await dialog.screenshot({ path: test.info().outputPath('road-route.png') });
    expect((await asked.requests[0].coordinates).length).toBe(2);
  } finally {
    await cleanUp(page, email);
  }
});

test('a routing outage never blocks saving, and visitors then see straight lines', async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = await signInAsAdmin(page);
  try {
    await page.request.post(`${provider}/__test/ors`, {
      headers: testHeaders(),
      data: { mode: 'fail', reset: true },
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Manage places', exact: true }).click();
    await fillTour(page, 'Outage trip');
    await page.getByRole('button', { name: 'Add tour', exact: true }).click();
    await expect(page.getByText(/Tour saved, but no road route could be worked out/)).toBeVisible();
    await expect(page.getByText('Straight lines only')).toBeVisible();
    await page.getByRole('button', { name: 'Close Manage places' }).click();

    await openTour(page, 'Outage trip');
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.route-line-road')).toHaveCount(0);
    await expect(dialog.locator('.route-line')).toHaveCount(1);
    await expect(
      dialog.getByText('Stops are joined by straight lines', { exact: false }),
    ).toBeVisible();
    await expect(dialog.getByText('km by road')).toHaveCount(0);
    await page.getByRole('button', { name: 'Close Outage trip' }).click();

    // Once routing works again, the administrator can fill the road in without editing the tour.
    await page.request.post(`${provider}/__test/ors`, {
      headers: testHeaders(),
      data: { mode: 'ok' },
    });
    await page.getByRole('button', { name: 'Manage places', exact: true }).click();
    await page
      .getByRole('dialog')
      .locator('summary', { hasText: /^\s*Tours\s*$/ })
      .click();
    await page.getByRole('button', { name: 'Recalculate route for Outage trip' }).click();
    await expect(page.getByText('Road route updated.')).toBeVisible();
    await expect(page.getByText('Road route: 3.0 km')).toBeVisible();
  } finally {
    await cleanUp(page, email);
  }
});

test('tours stay on the homepage when the network fails after they were loaded', async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = await signInAsAdmin(page);
  try {
    await createTourByApi(page, 'Offline trip');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Island tours' })).toBeVisible();
    // The tours request now fails, as it would on a plane or a bad connection; the saved list is shown instead.
    await page.route('**/api/tours', (route) => route.abort());
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Island tours' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Offline trip/ })).toBeVisible();
  } finally {
    await page.unroute('**/api/tours');
    await cleanUp(page, email);
  }
});

test('a tour opened before the catalogue arrives waits for it instead of calling its stops unlisted', async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = await signInAsAdmin(page);
  try {
    await createTourByApi(page, 'Early trip');
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Early trip/ })).toBeVisible();
    // Next visit the tour list is on the device already, but the catalogue is not (cleared, or never saved) and slow.
    // The first visit saves the catalogue when it arrives, which can be after the tour card shows; wait for that,
    // then clear it, or it would be written back after the clearing.
    await page.waitForFunction(() => localStorage.getItem('madatours:catalogue:v1') !== null);
    await page.evaluate(() => localStorage.removeItem('madatours:catalogue:v1'));
    await page.route('**/api/places', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.reload();
    await page.getByRole('button', { name: /Early trip/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Loading places…')).toBeVisible();
    await expect(dialog.getByText('This place is no longer listed')).toHaveCount(0);
    await expect(dialog.locator('.route-pin')).toHaveCount(2);
    await expect(dialog.getByText('This place is no longer listed')).toHaveCount(0);
  } finally {
    await page.unroute('**/api/places');
    await cleanUp(page, email);
  }
});

test.describe('tablet', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Touch gestures are sent through the Chrome protocol.',
  );
  test.use({
    viewport: { width: 1000, height: 640 },
    contextOptions: { screen: { width: 1000, height: 640 } },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  test('two fingers move and zoom the route map while one finger scrolls the page', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const email = await signInAsAdmin(page);
    try {
      await createTourByApi(page, 'Tablet trip');
      await openTour(page, 'Tablet trip');
      const dialog = page.getByRole('dialog');
      const map = dialog.locator('.trip-map');
      // Buttons are the alternative to gestures, and only tablets and desktops get them.
      await expect(dialog.locator('.leaflet-control-zoom')).toBeVisible();
      // The tablet map is wide enough for the whole credit, so there is no button.
      await expect(dialog.locator('.leaflet-control-attribution')).toBeVisible();
      await expect(dialog.locator('.map-credit-toggle')).toBeHidden();
      await expect(map).toHaveClass(/leaflet-touch-zoom/);
      await expect(map).not.toHaveClass(/leaflet-touch-drag/);
      await expect(dialog.locator('.route-line-road')).toHaveCount(1);
      await map.scrollIntoViewIfNeeded();

      const session = await page.context().newCDPSession(page);
      const box = async () => (await map.boundingBox())!;
      const pins = () =>
        dialog.locator('.route-pin').evaluateAll((nodes) =>
          nodes.map((node) => {
            const r = node.getBoundingClientRect();
            return [r.x + r.width / 2, r.y + r.height / 2];
          }),
        );
      const settle = () => page.waitForTimeout(400);
      const scrollTop = () => dialog.evaluate((node) => node.scrollTop);
      await expect
        .poll(async () => dialog.evaluate((node) => node.scrollHeight > node.clientHeight))
        .toBe(true);
      await dialog.evaluate((node) => (node.scrollTop = 0));

      // One finger over the map scrolls the dialog and leaves the map where it was.
      const area = await box();
      const centre = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
      const before = await pins();
      const startScroll = await scrollTop();
      await session.send('Input.synthesizeScrollGesture', {
        x: centre.x,
        y: centre.y,
        yDistance: -120,
        gestureSourceType: 'touch',
        speed: 400,
      });
      await settle();
      expect(await scrollTop()).toBeGreaterThan(startScroll);
      const scrolled = (await scrollTop()) - startScroll;
      const afterScroll = await pins();
      // Pins moved up the screen only by as much as the page scrolled: the map itself did not pan.
      expect(afterScroll[0][0]).toBeCloseTo(before[0][0], 0);
      expect(before[0][1] - afterScroll[0][1]).toBeCloseTo(scrolled, 0);
      await expect(dialog.getByText('Use two fingers to move the map')).toBeVisible();

      // Two fingers moving together pan the map under them.
      await dialog.evaluate((node) => (node.scrollTop = 0));
      await settle();
      const fresh = await box();
      const middle = { x: fresh.x + fresh.width / 2, y: fresh.y + fresh.height / 2 };
      const gap = 60;
      const touch = (
        type: 'touchStart' | 'touchMove' | 'touchEnd',
        dx: number,
        dy: number,
        spread = gap,
      ) =>
        session.send('Input.dispatchTouchEvent', {
          type,
          touchPoints:
            type === 'touchEnd'
              ? []
              : [
                  { x: middle.x - spread + dx, y: middle.y + dy, id: 1 },
                  { x: middle.x + spread + dx, y: middle.y + dy, id: 2 },
                ],
        });
      const start = await pins();
      await touch('touchStart', 0, 0);
      for (let step = 1; step <= 8; step++) await touch('touchMove', step * 6, step * 4);
      await touch('touchEnd', 0, 0);
      await settle();
      const panned = await pins();
      expect(panned[0][0] - start[0][0]).toBeGreaterThan(30);
      expect(panned[0][1] - start[0][1]).toBeGreaterThan(20);
      // Both pins moved together: the map panned, it did not stretch.
      expect(Math.hypot(panned[1][0] - panned[0][0], panned[1][1] - panned[0][1])).toBeCloseTo(
        Math.hypot(start[1][0] - start[0][0], start[1][1] - start[0][1]),
        0,
      );

      // Spreading two fingers apart zooms in: the pins end up further apart.
      const gapBefore = Math.hypot(panned[1][0] - panned[0][0], panned[1][1] - panned[0][1]);
      await touch('touchStart', 0, 0, 40);
      for (let step = 1; step <= 8; step++) await touch('touchMove', 0, 0, 40 + step * 12);
      await touch('touchEnd', 0, 0);
      await settle();
      const zoomed = await pins();
      expect(Math.hypot(zoomed[1][0] - zoomed[0][0], zoomed[1][1] - zoomed[0][1])).toBeGreaterThan(
        gapBefore * 1.3,
      );
      await dialog.screenshot({ path: test.info().outputPath('tablet-map.png') });
    } finally {
      await cleanUp(page, email);
    }
  });
});

test.describe('phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    contextOptions: { screen: { width: 390, height: 844 } },
    hasTouch: true,
    isMobile: true,
  });

  test('phones keep a still map so the page keeps scrolling', async ({ page }) => {
    test.setTimeout(60000);
    const email = await signInAsAdmin(page);
    try {
      await createTourByApi(page, 'Phone trip');
      await openTour(page, 'Phone trip');
      const dialog = page.getByRole('dialog');
      await expect(dialog.locator('.route-line-road')).toHaveCount(1);
      // The credit sits behind a button on a phone, so it never covers the route; one tap opens it.
      const credit = dialog.locator('.leaflet-control-attribution');
      await expect(dialog.getByRole('button', { name: 'Map credits' })).toBeVisible();
      await expect(credit).toBeHidden();
      await dialog.getByRole('button', { name: 'Map credits' }).click();
      await expect(credit).toContainText('OpenStreetMap');
      await dialog.getByRole('button', { name: 'Map credits' }).click();
      const map = dialog.locator('.trip-map');
      await expect(map).not.toHaveClass(/leaflet-touch-zoom/);
      await expect(map).not.toHaveClass(/leaflet-touch-drag/);
      await expect(dialog.locator('.leaflet-control-zoom')).toHaveCount(0);
      await expect.poll(() => creditCoversNoPin(dialog)).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await dialog.screenshot({ path: test.info().outputPath('phone-map.png') });
    } finally {
      await cleanUp(page, email);
    }
  });
});
