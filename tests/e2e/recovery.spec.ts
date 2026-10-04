import { test, expect } from '@playwright/test';
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
          time: '2026-10-04T12:00',
        },
      },
    }),
  );
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
});

for (const language of ['en', 'fr'] as const)
  test(`signup shows recovery codes once, and a code resets the password a single time ${language}`, async ({
    page,
    context,
    browserName,
  }) => {
    test.setTimeout(90000);
    const t = (key: string, params?: Record<string, string>) => translate(language, key, params);
    const email = `${randomUUID()}@example.test`;
    const dialog = page.getByRole('dialog');
    const noEmailPromise = /inbox|boîte de réception|we sent|nous avons envoyé|spam/i;
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/?lang=${language}`);

    // Signup: the screen explains there is no email, and hands over eight codes.
    await page
      .getByRole('button', { name: t('Create an account'), exact: true })
      .first()
      .click();
    await page.getByLabel(t('Your name'), { exact: true }).fill('Camille');
    await page.getByLabel(t('Email'), { exact: true }).fill(email);
    await page.getByLabel(t('Password'), { exact: true }).fill('a long test password');
    await expect(dialog).not.toContainText(noEmailPromise);
    await dialog.getByRole('button', { name: t('Create account'), exact: true }).click();
    await expect(dialog.locator('[data-recovery-code]')).toHaveCount(8);
    const codes = await dialog.locator('[data-recovery-code]').allTextContents();
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);

    await page.screenshot({
      path: `test-results/recovery-codes-${test.info().project.name}-${language}.png`,
    });
    // The window holds on to the person until the codes are saved.
    await page.keyboard.press('Escape');
    await expect(dialog.getByText(t('Save your codes first, then tick the box.'))).toBeVisible();
    await expect(dialog.getByRole('button', { name: t('Done'), exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );

    // Download holds every code and the account; copy puts them on the clipboard where the browser allows it.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: t('Download codes') }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('madatours-recovery-codes.txt');
    const { readFile } = await import('node:fs/promises');
    const file = await readFile((await download.path())!, 'utf8');
    expect(file).toContain(email);
    for (const code of codes) expect(file).toContain(code);
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await dialog.getByRole('button', { name: t('Copy codes') }).click();
      await expect(dialog.getByRole('button', { name: t('Copied') })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(codes.join('\n'));
    }
    await dialog.getByLabel(t('I have saved these codes')).check();
    await dialog.getByRole('button', { name: t('Done'), exact: true }).click();
    await expect(dialog).toHaveCount(0);

    // Forgotten password: sign out, then reset with one of the codes, typed loosely.
    await page.getByRole('button', { name: t('Sign out'), exact: true }).click();
    const recover = async (code: string, password: string) => {
      await page.getByRole('button', { name: t('Sign in'), exact: true }).click();
      await dialog.getByRole('button', { name: t('Forgot password?'), exact: true }).click();
      await expect(dialog).not.toContainText(noEmailPromise);
      await dialog.getByLabel(t('Email'), { exact: true }).fill(email);
      await dialog.getByLabel(t('Recovery code'), { exact: true }).fill(code);
      await dialog.getByLabel(t('New password'), { exact: true }).fill(password);
      await dialog.getByRole('button', { name: t('Reset password'), exact: true }).click();
    };
    await recover(codes[2].toLowerCase().replace('-', ' '), 'a replacement password');
    await expect(
      dialog.getByText(t('Password updated. Sign in with your new password.')),
    ).toBeVisible();
    await dialog.getByLabel(t('Password'), { exact: true }).fill('a replacement password');
    await dialog.getByRole('button', { name: t('Sign in'), exact: true }).click();
    await expect(dialog).toHaveCount(0);

    // The same code does nothing a second time, and says so without hinting why.
    await page.getByRole('button', { name: t('Sign out'), exact: true }).click();
    await recover(codes[2], 'a third password here');
    await expect(dialog.getByRole('alert')).toHaveText(
      t('The email or recovery code is not valid.'),
    );
    await page.screenshot({
      path: `test-results/recovery-${test.info().project.name}-${language}.png`,
    });
  });
