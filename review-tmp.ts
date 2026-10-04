import { chromium, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startLaravel } from './tests/support/laravel';
import { stubMap } from './tests/e2e/support/map';

process.env.MADATOURS_E2E_TOKEN ??= 'review-token';
const app = await startLaravel(3100, 3101);
const browser = await chromium.launch();
const out: Record<string, unknown> = {};
const sizes = [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1440, 900],
] as const;
async function audit(page: import('@playwright/test').Page, label: string) {
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('a,button,input,select,textarea,summary')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && (r.width < 44 || r.height < 44) && !(el as HTMLInputElement).type?.match(/hidden|checkbox|radio/);
      })
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
  );
  out[label] = {
    overflowPx: overflow,
    axe: axe.violations.map((v) => `${v.impact} ${v.id} x${v.nodes.length}: ${v.nodes[0]?.target?.join(' ')}`),
    smallTargets: small,
  };
}
try {
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'en-GB' });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 120)));
    page.on('pageerror', (e) => errors.push('pageerror ' + e.message.slice(0, 120)));
    await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { current: { temperature_2m: 28, relative_humidity_2m: 75, weather_code: 2, time: '2026-10-04T12:00' } } }));
    await page.route('https://images.unsplash.com/**', (r) => r.abort());
    await stubMap(page);
    await page.goto(app.origin + '/');
    await page.waitForLoadState('networkidle');
    await audit(page, `home ${w}`);
    out[`home ${w} consoleErrors`] = errors;
    if (w === 390) {
      const perf = await page.evaluate(
        () =>
          new Promise((resolve) => {
            let lcp = 0, cls = 0;
            new PerformanceObserver((l) => l.getEntries().forEach((e) => (lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
            new PerformanceObserver((l) => l.getEntries().forEach((e: any) => !e.hadRecentInput && (cls += e.value))).observe({ type: 'layout-shift', buffered: true });
            setTimeout(() => {
              const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
              const by = (re: RegExp) => res.filter((r) => re.test(r.name));
              const kb = (a: PerformanceResourceTiming[]) => Math.round(a.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024);
              resolve({ lcpMs: Math.round(lcp), cls: +cls.toFixed(3), requests: res.length, jsKB: kb(by(/\.js/)), cssKB: kb(by(/\.css/)), apiKB: kb(by(/\/api\//)), imgKB: kb(by(/\.(png|jpe?g|webp|avif|svg)/)), totalKB: kb(res), places: by(/\/api\/places/).map((r) => Math.round(r.encodedBodySize / 1024) + 'KB enc / ' + Math.round(r.decodedBodySize / 1024) + 'KB raw') });
            }, 1500);
          }),
      );
      out['home 390 perf'] = perf;
    }
    await page.goto(app.origin + '/#explore');
    await page.waitForLoadState('networkidle');
    await audit(page, `explore ${w}`);
    await ctx.close();
  }
  // Account area: sign up, then settings, at phone and desktop widths, in French for the error wording.
  for (const [w, h, lang] of [[390, 844, 'fr'], [1440, 900, 'en']] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: lang === 'fr' ? 'fr-FR' : 'en-GB' });
    const page = await ctx.newPage();
    await stubMap(page);
    await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { current: { temperature_2m: 28, relative_humidity_2m: 75, weather_code: 2, time: '2026-10-04T12:00' } } }));
    const email = `review-${w}-${Date.now()}@example.test`;
    await page.request.post(app.origin + '/api/auth/register', { headers: { 'X-MadaTours-Client': '1' }, data: { name: 'Reviewer', email, password: 'Review browser password 42' } });
    await page.goto(app.origin + `/?lang=${lang}#settings`);
    await page.waitForLoadState('networkidle');
    await audit(page, `settings ${w} ${lang}`);
    // Form/error clarity: a wrong current password on the email form, and a short password on signup.
    const labels = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => `${i.type}:${i.autocomplete || '-'}:${i.labels?.[0]?.textContent?.trim().slice(0, 24) || i.getAttribute('aria-label') || '??'}`));
    out[`settings ${w} ${lang} inputs`] = labels;
    await ctx.close();
  }
  // Signup validation wording in French.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await stubMap(page);
  await page.goto(app.origin + '/?lang=fr');
  await page.getByRole('button', { name: /Se connecter|Connexion/i }).first().click();
  await page.getByRole('button', { name: /Créer un compte/i }).first().click();
  await page.getByLabel(/Votre nom/i).fill('Camille');
  await page.getByLabel(/^E-?mail/i).fill('camille@example.test');
  await page.getByLabel(/^Mot de passe/i).fill('court');
  await page.getByRole('button', { name: /Créer le compte|Créer un compte/i }).last().click();
  out['signup short password (fr) native validity message'] = await page.getByLabel(/^Mot de passe/i).evaluate((i: HTMLInputElement) => i.validationMessage);
  out['signup page lang'] = await page.evaluate(() => document.documentElement.lang);
  await page.getByLabel(/^Mot de passe/i).fill('un mot de passe assez long');
  await page.getByLabel(/^E-?mail/i).fill('camille@example.test');
  await page.getByRole('button', { name: /Créer le compte|Créer un compte/i }).last().click();
  await page.waitForTimeout(1500);
  out['after valid signup'] = (await page.locator('dialog').first().innerText().catch(() => 'closed')).slice(0, 160);
  await ctx.close();
} catch (error) {
  out.error = String(error).slice(0, 400);
} finally {
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
  await app.close();
}
