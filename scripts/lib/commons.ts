/** Wikimedia Commons and Wikidata helpers shared by the photo scripts, with the project's licence rules. */
export const userAgent = 'MadaTours photo research/1.0 (https://github.com/adekerv/MadaTOURS)';
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function api(host: string, params: Record<string, string | number>) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), format: 'json', formatversion: '2', ...(host.startsWith('commons') ? { maxlag: '5' } : {}) })}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(30000),
    });
    const data = (await response.json()) as { error?: { code: string } } & Record<string, unknown>;
    await sleep(250);
    const busy = ['maxlag', 'ratelimited', 'cirrussearch-too-busy-error'];
    if (
      busy.includes(data.error?.code ?? '') ||
      response.status === 429 ||
      response.status === 503
    ) {
      await sleep(8000 * (attempt + 1));
      continue;
    }
    if (data.error) throw new Error(`${host}: ${data.error.code}`);
    return data;
  }
  throw new Error(`${host}: still busy after retries`);
}
export const metres = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
export const plain = (html = '') =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
export const allowedLicence = /^(CC0|Public domain|CC BY(-SA)? [0-9.]+( [a-z]+)?)$/i;
/** Templates that rule a file out under the project's licence and rights rules. */
export const excludingTemplates = [
  'Template:PD-US-expired',
  'Template:PD-US-no notice',
  'Template:PD-US-not renewed',
  'Template:PD-1923',
  'Template:PD-US-1923-abroad',
  'Template:Personality rights',
  'Template:Trademarked',
  'Template:NoFoP-France',
  'Template:FoP-France',
];

export type Info = {
  title: string;
  url: string;
  thumb: string;
  width: number;
  height: number;
  mime: string;
  licence: string;
  licenceUrl: string;
  author: string;
  attribution: string;
  description: string;
  restrictions: string;
  templates: string[];
  lat?: number;
  lng?: number;
};
export async function details(titles: string[], thumbWidth = 480) {
  const result = new Map<string, Info>();
  for (let index = 0; index < titles.length; index += 40) {
    const batch = titles.slice(index, index + 40);
    const data = await api('commons.wikimedia.org', {
      action: 'query',
      titles: batch.join('|'),
      prop: 'imageinfo|templates',
      iiprop: 'url|extmetadata|size|mime',
      iiurlwidth: thumbWidth,
      tltemplates: excludingTemplates.join('|'),
      tllimit: 'max',
    });
    for (const page of ((data.query as { pages?: unknown[] })?.pages ?? []) as {
      title: string;
      imageinfo?: {
        url: string;
        thumburl: string;
        width: number;
        height: number;
        mime: string;
        descriptionurl: string;
        extmetadata?: Record<string, { value?: string }>;
      }[];
      templates?: { title: string }[];
    }[]) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata ?? {};
      const value = (key: string) => plain(meta[key]?.value);
      result.set(page.title, {
        title: page.title,
        url: info.descriptionurl,
        thumb: info.thumburl,
        width: info.width,
        height: info.height,
        mime: info.mime,
        licence: value('LicenseShortName'),
        licenceUrl: value('LicenseUrl'),
        author: value('Artist'),
        attribution: value('Attribution'),
        description: value('ImageDescription').slice(0, 240),
        restrictions: value('Restrictions'),
        templates: (page.templates ?? []).map((template) => template.title),
        lat: Number(value('GPSLatitude')) || undefined,
        lng: Number(value('GPSLongitude')) || undefined,
      });
    }
  }
  return result;
}
/** Why a file cannot be used, or an empty string when it can. */
export function rejection(info: Info) {
  if (!/^image\/(jpeg|png|webp)$/.test(info.mime)) return 'not a photo format';
  if (!allowedLicence.test(info.licence)) return `licence ${info.licence || 'unknown'}`;
  if (info.restrictions) return `restriction: ${info.restrictions}`;
  const bad = info.templates.find((template) => excludingTemplates.includes(template));
  if (bad) return bad.replace('Template:', '');
  if (Math.max(info.width, info.height) < 1200) return 'too small';
  return '';
}
