import type { Browser } from '@playwright/test';
/**
 * Crops an image to 3:2 around its centre, scales it to 960×640 and encodes WebP in Chromium's canvas, lowering the
 * quality until it fits `maxBytes`; dense images get a light smoothing pass before the quality drops further. The
 * canvas drops all metadata, EXIF and GPS included. No extra dependency: Playwright already ships Chromium.
 */
export async function encodeWebp(
  browser: Browser,
  image: Buffer,
  { maxBytes, focusY = 0.5 }: { maxBytes: number; focusY?: number },
) {
  const page = await browser.newPage();
  try {
    const result = await page.evaluate(
      async ({ data, maxBytes, focusY }) => {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${data}`;
        await img.decode();
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        let cw = W;
        let ch = cw / 1.5;
        if (ch > H) {
          ch = H;
          cw = ch * 1.5;
        }
        const sx = (W - cw) / 2;
        const sy = Math.min(Math.max(focusY * H - ch / 2, 0), H - ch);
        const canvas = document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 640;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingQuality = 'high';
        for (const [blur, top, floor] of [
          [0, 0.8, 0.5],
          [0.5, 0.75, 0.4],
          [0.8, 0.6, 0.3],
        ]) {
          ctx.filter = blur ? `blur(${blur}px)` : 'none';
          ctx.clearRect(0, 0, 960, 640);
          ctx.drawImage(img, sx, sy, cw, ch, 0, 0, 960, 640);
          for (let q = top; q >= floor - 1e-9; q -= 0.02) {
            const url = canvas.toDataURL('image/webp', q);
            const bytes = Math.ceil(((url.length - 'data:image/webp;base64,'.length) * 3) / 4);
            if (bytes <= maxBytes)
              return {
                base64: url.split(',')[1],
                quality: Math.round(q * 100),
                smoothed: blur > 0,
              };
          }
        }
        return null;
      },
      { data: image.toString('base64'), maxBytes, focusY },
    );
    if (!result) throw new Error(`Could not encode under ${maxBytes} bytes.`);
    return { ...result, bytes: Buffer.from(result.base64, 'base64') };
  } finally {
    await page.close();
  }
}
