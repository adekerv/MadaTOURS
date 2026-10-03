import { extract, fold, isDirectory, normalizePhone, type Extracted } from './source-extract';
import type { SourceFetcher, FetchStatus } from './source-fetch';
import { inBoardSitemap, type BoardSitemap } from './board-sitemap';
import type { PlaceRecord, SourceRef } from './place-sources';
/** What one place's cited sources say, and where they disagree with what we hold. */
export interface SourceResult {
  url: string;
  title: string;
  declaredFields: string[];
  previouslyCheckedAt: string;
  fetch: FetchStatus;
  httpStatus?: number;
  finalUrl?: string;
  redirected: boolean;
  /** Share of the place name's words found in the page's own heading or title (0-1). */
  nameMatch: number;
  /** The place's name appears somewhere in the page, e.g. on a directory's index of venues. */
  mentionsName: boolean;
  extracted?: Extracted;
  /** For tourism-board pages: whether the page is in the board's current sitemap, and when it last changed. */
  board?: { listed: boolean; modified?: string };
}
export interface Conflict {
  field: string;
  ours: string;
  theirs: string;
  source: string;
}
export interface PlaceAnalysis {
  id: number;
  name: string;
  town: string;
  type: string;
  published: boolean;
  sources: SourceResult[];
  details: Record<string, unknown>;
  conflicts: Conflict[];
  flags: string[];
  sourceTexts: { url: string; text: string }[];
  /** What the database held when this was read, so an apply step can refuse to overwrite a newer edit. */
  before: {
    description: string;
    descriptionFr: string | null;
    sources: SourceRef[];
    details: Record<string, unknown>;
    listingStatus: string;
    published: boolean;
  };
}
const stop = new Set([
  'le',
  'la',
  'les',
  'l',
  'de',
  'du',
  'des',
  'd',
  'et',
  'the',
  'au',
  'aux',
  'a',
  'en',
  'sur',
  'restaurant',
  'bar',
  'martinique',
  'hotel',
  'chez',
]);
const words = (value: string) =>
  fold(value)
    .replace(/&/g, ' et ')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !stop.has(word));
const compact = (value: string) => fold(value).replace(/[^a-z0-9]+/g, '');
export function nameMatch(name: string, ...pageNames: (string | undefined)[]): number {
  const wanted = words(name);
  if (!wanted.length) return 1;
  // "Acro'Kart" and "ACROKART" are the same name once punctuation and spacing are ignored.
  const flat = compact(name);
  if (flat.length >= 4 && pageNames.some((value) => value && compact(value).includes(flat)))
    return 1;
  const page = new Set(pageNames.flatMap((value) => (value ? words(value) : [])));
  return wanted.filter((word) => page.has(word)).length / wanted.length;
}
const townKey = (value: string) =>
  fold(value)
    .replace(/^(le|la|les|l)\b[\s'’-]*/, '')
    .replace(/\bsaint(e?)\b/g, 'st$1')
    .replace(/[^a-z0-9]+/g, '');
/** Great-circle distance in metres. */
function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
}
function overlap(a: string, b: string) {
  const left = new Set(words(a));
  const right = new Set(words(b));
  if (!left.size || !right.size) return 1;
  return [...left].filter((word) => right.has(word)).length / Math.min(left.size, right.size);
}
const legacyStreet = /(?:Listed street|Voie indiquée)\s*:\s*(.+?)\.(?=\s*Contact\s*:|\s*$)/;
const legacyPhone = /Contact\s*:\s*(\+?\d[\d\s().-]{6,}\d)/;
export const fieldNames = [
  'address',
  'phone',
  'website',
  'facebook',
  'instagram',
  'hoursText',
  'priceRange',
  'kind',
  'payment',
  'languages',
  'services',
  'reservations',
  'accessibility',
  'parking',
] as const;
export async function analyzePlace(
  place: PlaceRecord,
  fetcher: SourceFetcher,
  today: string,
  board?: BoardSitemap,
): Promise<PlaceAnalysis> {
  const results: SourceResult[] = [];
  for (const source of place.sources ?? [])
    results.push(await readSource(source, place, fetcher, today, board));
  const analysis: PlaceAnalysis = {
    id: place.id,
    name: place.name,
    town: place.location,
    type: place.type,
    published: place.published,
    sources: results,
    details: {},
    conflicts: [],
    flags: [],
    sourceTexts: [],
    before: {
      description: place.description,
      descriptionFr: place.description_fr,
      sources: place.sources ?? [],
      details: (place.details as Record<string, unknown>) ?? {},
      listingStatus: place.listing_status ?? 'active',
      published: place.published,
    },
  };
  const from: Record<string, { url: string; checkedAt: string }> = {};
  const trusted = results.filter(
    (result) => result.fetch === 'ok' && result.extracted && result.nameMatch >= 0.5,
  );
  for (const result of results) {
    if (result.fetch !== 'ok') analysis.flags.push(`source-${result.fetch}: ${result.url}`);
    else if (result.nameMatch < 0.5 && !result.mentionsName)
      analysis.flags.push(`page-does-not-match-name: ${result.url}`);
    if (result.redirected && result.fetch === 'ok')
      analysis.flags.push(`source-redirected: ${result.url} → ${result.finalUrl}`);
  }
  if (!results.length) analysis.flags.push('no-sources');
  for (const result of trusted) {
    const data = result.extracted!;
    for (const field of fieldNames) {
      const value = data[field];
      if (
        value === undefined ||
        (Array.isArray(value) && !value.length) ||
        field in analysis.details
      )
        continue;
      analysis.details[field] = value;
      from[field] = { url: result.url, checkedAt: today };
    }
    if (data.openingPeriods?.length && !('openingPeriods' in analysis.details)) {
      analysis.details.openingPeriods = data.openingPeriods;
      from.openingPeriods = { url: result.url, checkedAt: today };
    }
    if (data.sourceText) analysis.sourceTexts.push({ url: result.url, text: data.sourceText });
    for (const note of data.notes)
      if (note.startsWith('price-expired')) analysis.flags.push(`${note}: ${result.url}`);
    if (data.notes.includes('hours-text-unparsed'))
      analysis.flags.push(`hours-kept-as-source-text: ${result.url}`);
    if (data.unmapped.length) analysis.flags.push(`unmapped-info: ${data.unmapped.join(' | ')}`);
    // Conflicts: shown to a human, never silently resolved by overwriting our data.
    const ourStreet = legacyStreet.exec(place.description)?.[1];
    const ourPhone = normalizePhone(legacyPhone.exec(place.description)?.[1]);
    if (data.phone && ourPhone && data.phone !== ourPhone)
      analysis.conflicts.push({
        field: 'phone',
        ours: ourPhone,
        theirs: data.phone,
        source: result.url,
      });
    if (data.address && ourStreet && overlap(data.address, ourStreet) < 0.4)
      analysis.conflicts.push({
        field: 'address',
        ours: ourStreet,
        theirs: data.address,
        source: result.url,
      });
    if (data.town && townKey(data.town) !== townKey(place.location))
      analysis.conflicts.push({
        field: 'town',
        ours: place.location,
        theirs: data.town,
        source: result.url,
      });
    if (data.geo && metres(data.geo, place) > 250)
      analysis.conflicts.push({
        field: 'map point',
        ours: `${place.lat},${place.lng}`,
        theirs: `${data.geo.lat},${data.geo.lng} (${Math.round(metres(data.geo, place))} m away)`,
        source: result.url,
      });
  }
  if (Object.keys(from).length) analysis.details.from = from;
  return analysis;
}
/** http→https, "www." and a trailing slash are not a change of destination; a different path or host is. */
export function meaningfulRedirect(from: string, to: string | undefined): boolean {
  if (!to) return false;
  try {
    const a = new URL(from);
    const b = new URL(to);
    const host = (url: URL) => url.hostname.replace(/^www\./, '').toLowerCase();
    const path = (url: URL) => decodeURIComponent(url.pathname).replace(/\/+$/, '').toLowerCase();
    return host(a) !== host(b) || path(a) !== path(b);
  } catch {
    return false;
  }
}
async function readSource(
  source: SourceRef,
  place: PlaceRecord,
  fetcher: SourceFetcher,
  today: string,
  sitemap?: BoardSitemap,
): Promise<SourceResult> {
  const response = await fetcher.get(source.url);
  const base: SourceResult = {
    url: source.url,
    title: source.title,
    declaredFields: source.fields,
    previouslyCheckedAt: source.checkedAt,
    fetch: response.status,
    httpStatus: response.httpStatus,
    finalUrl: response.finalUrl,
    redirected: meaningfulRedirect(source.url, response.finalUrl),
    nameMatch: 0,
    mentionsName: false,
  };
  if (response.status !== 'ok' || !response.html) return base;
  const extracted = extract(response.html, { url: source.url, today });
  const mentionsName = fold(
    response.html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' '),
  ).includes(fold(place.name.trim()));
  let score = nameMatch(place.name, extracted.heading, extracted.pageTitle);
  // On a venue's own website the brand is usually the first distinctive word of its name, and it
  // appears in the web address or the page title.
  if (score < 0.5 && !isDirectory(source.url)) {
    let host = '';
    try {
      host = new URL(response.finalUrl ?? source.url).hostname
        .replace(/^www\./, '')
        .split('.')
        .slice(0, -1)
        .join(' ');
    } catch {
      /* An unparseable address cannot contribute a brand match. */
    }
    const brand = words(place.name)[0];
    if (brand && nameMatch(brand, extracted.heading, extracted.pageTitle, host) === 1) score = 0.5;
  }
  const board =
    sitemap && /martinique\.org/.test(source.url)
      ? inBoardSitemap(sitemap, source.url, response.finalUrl)
      : undefined;
  return { ...base, extracted, mentionsName, nameMatch: score, board };
}
