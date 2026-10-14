import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { stubMap } from './support/map';

const client = { 'X-MadaTours-Client': '1' };
const password = 'an admin spec password';

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await stubMap(page);
});

async function register(page: Page, name: string) {
  const email = `${name.toLowerCase()}-${randomUUID().slice(0, 8)}@example.test`;
  const response = await page.request.post('/api/auth/register', {
    headers: client,
    data: { name, email, password, password_confirmation: password, language: 'en' },
  });
  expect(response.status()).toBe(201);
  return email;
}
const removeAccount = (page: Page, email: string) =>
  page.request.delete('/api/account', { headers: client, data: { password, confirmation: email } });

/** No sideways scrolling, and every control big enough to tap (checkboxes are tapped through their label). */
async function fitsAndTargets(page: Page) {
  // On failure the message names what sticks out past the right edge.
  const overflowing = await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth + 1
      ? []
      : [...document.querySelectorAll('body *')]
          .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
          .slice(-5)
          .map((element) => `${element.tagName}.${element.getAttribute('class')}`.slice(0, 120)),
  );
  expect(overflowing).toEqual([]);
  const undersized = await page
    .locator(
      'button:not(:disabled),a[href],select,input:not([type=hidden]):not([type=checkbox]):not(.sr-only),textarea,summary',
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.width < 43.5 || rect.height < 43.5);
        })
        .map(
          (element) =>
            element.textContent?.trim().slice(0, 60) || element.getAttribute('aria-label'),
        ),
    );
  expect(undersized).toEqual([]);
}

test('sign-up from the navbar needs matching passwords and lands on My account', async ({
  page,
}) => {
  const email = `signup-${randomUUID().slice(0, 8)}@example.test`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Your name').fill('Navbar');
  await dialog.getByLabel('Email').fill(email);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByLabel('Confirm password', { exact: true }).fill(`${password}!`);
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  // Nothing is sent: the mismatch is named under the field and the button waits for a fix.
  await expect(dialog.getByText('The passwords do not match.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Create account', exact: true })).toBeDisabled();
  expect((await (await page.request.get('/api/auth/session')).json()).user).toBeNull();
  // Each field has its own eye button.
  await dialog.getByRole('button', { name: 'Show password' }).last().click();
  await expect(dialog.getByLabel('Confirm password', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await expect(dialog.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await dialog.getByLabel('Confirm password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await dialog.getByLabel('I have saved these codes').check();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page).toHaveURL(/#account$/);
  await expect(page.getByRole('heading', { name: 'My account', level: 1 })).toBeVisible();
  await removeAccount(page, email);
});

test('a signed-in person who is not an administrator cannot open the dashboard', async ({
  page,
}) => {
  const email = await register(page, 'Visitor');
  try {
    await page.goto('/#admin/users');
    await expect(
      page.getByRole('heading', { name: 'This page is for administrators' }),
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Admin sections' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);
    // The server refuses on its own, whatever the page shows.
    for (const path of [
      '/api/admin/overview',
      '/api/admin/users',
      '/api/admin/messages',
      '/api/admin/log',
    ])
      expect((await page.request.get(path)).status()).toBe(403);
    expect(
      (await page.request.post('/api/admin/site-settings', { headers: client, data: {} })).status(),
    ).toBe(403);
  } finally {
    await removeAccount(page, email);
  }
});

test('administrators move between every section, on a phone and a desktop', async ({ page }) => {
  test.setTimeout(120000);
  const email = await register(page, 'Admin');
  await page.request.post('http://127.0.0.1:3101/__test/admin', {
    headers: { 'X-Test-Token': process.env.MADATOURS_E2E_TOKEN! },
    data: { email },
  });
  try {
    await page.goto('/');
    await page.getByRole('link', { name: 'Admin', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Admin sections' });
    for (const [link, heading] of [
      ['Tours', 'Tours'],
      ['Places', 'Places'],
      ['Meet-ups', 'Meet-ups'],
      ['Users', 'Users'],
      ['Reviews', 'Reviews'],
      ['Messages', 'Messages'],
      ['Submissions', 'Place submissions'],
      ['Photos', 'Owner photos and photo reports'],
      ['Sources and Google', 'Sources and Google matching'],
      ['Site content', 'Site content'],
      ['Activity log', 'Activity log'],
      ['Overview', 'Overview'],
    ]) {
      await nav.getByRole('link', { name: link, exact: true }).click();
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
      await expect(nav.getByRole('link', { name: link, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(page.getByRole('status', { name: 'Loading…' })).toHaveCount(0);
      await fitsAndTargets(page);
    }
    // Empty lists explain themselves instead of showing a blank table.
    await nav.getByRole('link', { name: 'Messages', exact: true }).click();
    await expect(page.getByText('No messages yet')).toBeVisible();
    // Sign out works from inside the dashboard and leaves it.
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/#?$/);
    await expect(page.getByRole('navigation', { name: 'Admin sections' })).toHaveCount(0);
    await page.request.post('/api/auth/login', { headers: client, data: { email, password } });
  } finally {
    await removeAccount(page, email);
  }
});
