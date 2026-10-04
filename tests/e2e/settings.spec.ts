import { test, expect, type Page } from '@playwright/test';
import { translate } from '../../resources/js/i18n/core';
import { randomUUID } from 'node:crypto';

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
const fits = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
const session = async (page: Page) =>
  (await (await page.request.get('/api/auth/session')).json()) as {
    user: { name: string; email: string; emailVerified: boolean; language: string | null } | null;
  };

test('guests are asked to sign in instead of seeing account forms', async ({ page }) => {
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: 'Account settings', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to manage your account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Permanently delete my account' })).toHaveCount(0);
});

for (const language of ['en', 'fr'] as const)
  for (const width of [360, 1440]) {
    test(`settings: edit profile and email, then delete the account ${language} ${width}`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      const t = (key: string, params?: Record<string, string>) => translate(language, key, params);
      const user = await register(page);
      const newName = `Camille Martin ${randomUUID().slice(0, 6)}`;
      const newEmail = `${randomUUID()}@example.test`;
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?lang=${language}`);
      await page.getByRole('button', { name: t('Your account'), exact: true }).click();
      await expect(
        page.getByRole('heading', { name: t('Account settings'), level: 1 }),
      ).toBeVisible();
      await fits(page);

      const section = (heading: string) =>
        page
          .locator('section')
          .filter({ has: page.getByRole('heading', { name: t(heading), level: 2 }) });
      const emailSection = section('Email address');
      const recoverySection = section('Account recovery');

      // Profile: saved to the account and still there after a reload.
      await page.getByLabel(t('Name'), { exact: true }).fill(newName);
      await page.getByRole('button', { name: t('Save changes'), exact: true }).click();
      await expect(page.getByText(t('Your changes have been saved.'))).toBeVisible();
      expect((await session(page)).user).toMatchObject({ name: newName, language });
      await page.reload();
      await expect(page.getByLabel(t('Name'), { exact: true })).toHaveValue(newName);

      // Email: a wrong password is refused with a readable message and changes nothing.
      await emailSection.getByLabel(t('New email address'), { exact: true }).fill(newEmail);
      await emailSection
        .getByLabel(t('Current password'), { exact: true })
        .fill('not the password');
      await emailSection.getByRole('button', { name: t('Change email'), exact: true }).click();
      await expect(emailSection.getByRole('alert')).toBeVisible();
      await fits(page);
      expect((await session(page)).user?.email).toBe(user.email);
      // The right password changes it straight away, and no email is mentioned or sent.
      await emailSection
        .getByLabel(t('Current password'), { exact: true })
        .fill('a long test password');
      await emailSection.getByRole('button', { name: t('Change email'), exact: true }).click();
      await expect(
        page.getByText(t('Your email address is now {email}.', { email: newEmail })),
      ).toBeVisible();
      expect((await session(page)).user).toMatchObject({ email: newEmail, emailVerified: false });
      await expect(page.getByRole('main')).not.toContainText(/verification code|inbox|we sent/i);
      await fits(page);

      // Recovery codes: the count is shown, new codes need the password, and they are shown once.
      await expect(
        page.getByText(
          t('{remaining} of {total} recovery codes left', { remaining: '8', total: '8' }),
        ),
      ).toBeVisible();
      await recoverySection
        .getByLabel(t('Current password'), { exact: true })
        .fill('wrong password');
      await recoverySection
        .getByRole('button', { name: t('Create new recovery codes'), exact: true })
        .click();
      await expect(recoverySection.getByRole('alert')).toBeVisible();
      await recoverySection
        .getByLabel(t('Current password'), { exact: true })
        .fill('a long test password');
      await recoverySection
        .getByRole('button', { name: t('Create new recovery codes'), exact: true })
        .click();
      await expect(page.locator('[data-recovery-code]')).toHaveCount(8);
      await expect(page.getByRole('button', { name: t('Done'), exact: true })).toBeDisabled();
      await page.getByLabel(t('I have saved these codes')).check();
      await page.getByRole('button', { name: t('Done'), exact: true }).click();
      await expect(page.locator('[data-recovery-code]')).toHaveCount(0);
      await fits(page);

      // Delete: the button stays disabled until the exact email is typed.
      const remove = page.getByRole('button', { name: t('Permanently delete my account') });
      const typed = page.getByLabel(t('Type {email} to confirm', { email: newEmail }), {
        exact: true,
      });
      await page.getByLabel(t('Password'), { exact: true }).fill('a long test password');
      await expect(remove).toBeDisabled();
      await typed.fill(newEmail.slice(0, -2));
      await expect(remove).toBeDisabled();
      await typed.fill(newEmail.toUpperCase());
      await expect(remove).toBeEnabled();
      await page.screenshot({
        path: `test-results/settings-${test.info().project.name}-${language}-${width}.png`,
        fullPage: true,
      });
      await remove.click();
      await expect(page.getByText(t('Your account and its data have been deleted.'))).toBeVisible();
      await expect(page.getByRole('button', { name: t('Sign in'), exact: true })).toBeVisible();
      expect(new URL(page.url()).hash).toBe('');
      expect((await session(page)).user).toBeNull();
      await fits(page);
    });
  }
