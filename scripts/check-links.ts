import { writeFile } from 'node:fs/promises';
import { loadPlaces, today } from './lib/place-sources';
/**
 * Follows every place's website and source links and reports the ones that need a person: a redirect to another
 * domain, a parked or for-sale domain, a gambling redirect, or a 4xx/5xx answer. It reads only; nothing is written
 * to the catalogue.
 *   npm run links:check                 every place (live database when configured, else the seed)
 *   npm run links:check -- --ids=16,280 only these places
 * The report goes to reports/link-check-<date>.csv.
 */
const args = process.argv.slice(2);
if (args.some((arg) => !/^--ids=[\d,]+$/.test(arg)))
  throw new Error('Unknown argument. Use --ids=1,2,3 or nothing.');
const only = new Set((args[0]?.slice(6) ?? '').split(',').filter(Boolean).map(Number));
const userAgent = 'MadaTours link check (+https://github.com/adekerv/MadaTOURS)';
const parkedWords =
  /domain (name )?(is |may be )?for sale|buy this domain|ce domaine est à vendre|domaine à vendre|parked (free|domain)|this domain is parked|sedoparking|dan\.com|afternic|hugedomains|domain parking/i;
const gamblingWords =
  /\b(casino|slot gacor|judi online|togel|sportsbook|paris sportifs en ligne|betting site)\b/i;
/** The last two labels of a host, enough to tell martinique.org from another site for the hosts in this catalogue. */
const siteOf = (host: string) =>
  host
    .replace(/^www\./, '')
    .split('.')
    .slice(-2)
    .join('.');
type LinkResult = {
  id: number;
  name: string;
  kind: 'website' | 'source';
  url: string;
  status: number | null;
  finalUrl: string;
  problem: string;
};
async function check(url: string) {
  let current = url;
  for (let hop = 0; hop < 10; hop++) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': userAgent, Accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(20000),
    });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).toString();
      await response.body?.cancel();
      continue;
    }
    let text = '';
    if (response.headers.get('content-type')?.includes('text/html'))
      text = (await response.text()).slice(0, 300000);
    else await response.body?.cancel();
    return { status: response.status, finalUrl: current, text };
  }
  return { status: null, finalUrl: current, text: '', loop: true };
}
function problemOf(url: string, result: Awaited<ReturnType<typeof check>> & { loop?: boolean }) {
  if (result.loop) return 'Too many redirects';
  const problems: string[] = [];
  if (result.status !== null && result.status >= 400)
    problems.push(
      result.status === 403 || result.status === 429
        ? `HTTP ${result.status} (the site may block automated reading)`
        : `HTTP ${result.status}`,
    );
  if (siteOf(new URL(url).hostname) !== siteOf(new URL(result.finalUrl).hostname))
    problems.push(`Redirects to another domain: ${new URL(result.finalUrl).hostname}`);
  if (gamblingWords.test(result.text)) problems.push('Page mentions gambling');
  if (parkedWords.test(result.text)) problems.push('Looks like a parked or for-sale domain');
  return problems.join('; ');
}
const { places, origin } = await loadPlaces();
const links = places
  .filter((place) => !only.size || only.has(place.id))
  .flatMap((place) => [
    ...(typeof place.details?.website === 'string'
      ? [{ place, kind: 'website' as const, url: place.details.website }]
      : []),
    ...place.sources.map((source) => ({ place, kind: 'source' as const, url: source.url })),
  ]);
console.log(`Checking ${links.length} links from ${places.length} places (${origin}).`);
const results: LinkResult[] = [];
// A few requests at a time, so no site sees a burst from this script.
for (let index = 0; index < links.length; index += 4) {
  const batch = links.slice(index, index + 4);
  results.push(
    ...(await Promise.all(
      batch.map(async ({ place, kind, url }) => {
        try {
          const result = await check(url);
          return {
            id: place.id,
            name: place.name,
            kind,
            url,
            status: result.status,
            finalUrl: result.finalUrl,
            problem: problemOf(url, result),
          };
        } catch (error) {
          return {
            id: place.id,
            name: place.name,
            kind,
            url,
            status: null,
            finalUrl: url,
            problem: `No answer: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }),
    )),
  );
  if ((index / 4) % 25 === 0) console.log(`${Math.min(index + 4, links.length)}/${links.length}`);
  await new Promise((resolve) => setTimeout(resolve, 500));
}
const flagged = results.filter((result) => result.problem);
const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [
  'id,name,kind,url,status,final_url,problem',
  ...flagged.map((row) =>
    [row.id, row.name, row.kind, row.url, row.status, row.finalUrl, row.problem]
      .map(cell)
      .join(','),
  ),
].join('\n');
const path = `reports/link-check-${today()}.csv`;
await writeFile(path, `${csv}\n`);
console.log(
  `${flagged.length} of ${results.length} links need a look. Report: ${path}. Nothing was changed.`,
);
