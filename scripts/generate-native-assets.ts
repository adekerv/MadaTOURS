import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const icon = await readFile('native-assets/app-icon.svg', 'utf8');
  const splash = await readFile('native-assets/splash.svg', 'utf8');
  async function render(svg: string, size: number, output: string) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
    );
    await page.screenshot({ path: output });
  }
  await render(icon, 1024, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  const splashPath = 'ios/App/App/Assets.xcassets/Splash.imageset/';
  await render(splash, 2732, `${splashPath}splash-2732x2732.png`);
  const splashBytes = await readFile(`${splashPath}splash-2732x2732.png`);
  await writeFile(`${splashPath}splash-2732x2732-1.png`, splashBytes);
  await writeFile(`${splashPath}splash-2732x2732-2.png`, splashBytes);
  for (const [density, size] of [
    ['mdpi', 48],
    ['hdpi', 72],
    ['xhdpi', 96],
    ['xxhdpi', 144],
    ['xxxhdpi', 192],
  ] as const) {
    const directory = `android/app/src/main/res/mipmap-${density}/`;
    await render(icon, size, `${directory}ic_launcher.png`);
    await writeFile(
      `${directory}ic_launcher_round.png`,
      await readFile(`${directory}ic_launcher.png`),
    );
  }
  console.log('Native artwork generated from original SVG sources.');
} finally {
  await browser.close();
}
