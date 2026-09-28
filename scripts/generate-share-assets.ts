import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
const photo = (await readFile('public/photos/balata.jpg')).toString('base64');
const font = (
  await readFile('node_modules/@fontsource/outfit/files/outfit-latin-600-normal.woff2')
).toString('base64');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await mkdir('native-assets/store', { recursive: true });
  for (const language of ['en', 'fr']) {
    for (const [width, height, path] of [
      [1200, 630, `public/og-image${language === 'fr' ? '-fr' : ''}.png`],
      [1024, 500, `native-assets/store/feature-${language}.png`],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.setContent(
        `<style>@font-face{font-family:Outfit;src:url(data:font/woff2;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#fdfcfb;color:#19332c;font-family:Outfit,sans-serif}.layout{display:flex;height:100vh;padding:40px;gap:34px}.copy{width:52%;display:flex;flex-direction:column;justify-content:center}.brand{color:#c2410c;font-size:24px;letter-spacing:3px}h1{font-size:${width === 1200 ? 65 : 55}px;line-height:1.05;letter-spacing:-2px;margin:30px 0 20px}p{font-size:24px;line-height:1.5;margin:0}.picture{position:relative;width:48%;overflow:hidden;border-radius:170px 170px 28px 28px}img{width:100%;height:100%;object-fit:cover}.credit{position:absolute;bottom:15px;left:15px;right:15px;background:#10291cdb;padding:8px 12px;color:white;border-radius:10px;font-size:12px}.pill{margin-top:30px;align-self:flex-start;padding:12px 20px;background:#c2410c;color:white;border-radius:50px;font-size:19px}</style><div class="layout"><div class="copy"><div class="brand">MADATOURS</div><h1>${language === 'fr' ? 'La Martinique,<br>à votre rythme.' : 'Martinique,<br>at your pace.'}</h1><p>${language === 'fr' ? 'Des lieux à découvrir.<br>Des journées à imaginer.' : 'Places to discover.<br>Days to make your own.'}</p><span class="pill">${language === 'fr' ? 'Explorez · Planifiez · Profitez' : 'Explore · Plan · Enjoy'}</span></div><div class="picture"><img src="data:image/jpeg;base64,${photo}"><div class="credit">Jardin de Balata · Box-Off-Dreams, Julie<br>${language === 'fr' ? 'Domaine public · Photo recadrée' : 'Public domain · Cropped photograph'}</div></div></div>`,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path });
    }
  }
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(
    `<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${await readFile('native-assets/app-icon.svg', 'utf8')}`,
  );
  await page.screenshot({ path: 'native-assets/store/icon-512.png' });
} finally {
  await browser.close();
}
