import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
/**
 * Pulls what a cited page actually states. Nothing is inferred: a field that the page does not give
 * is left out, and free-text hours that cannot be read unambiguously are kept as the source's words.
 */
export interface Period {
  day: number;
  opens: number;
  closes: number;
}
export interface ClosureSignal {
  strength: 'strong' | 'weak';
  phrase: string;
  snippet: string;
}
export interface Extracted {
  template: 'martinique.org' | 'terres-du-centre' | 'generic';
  pageTitle?: string;
  /** The venue's own name as the page gives it. */
  heading?: string;
  address?: string;
  town?: string;
  phone?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  hoursText?: string;
  openingPeriods?: Period[];
  priceRange?: string;
  kind?: string[];
  payment?: string[];
  languages?: string[];
  services?: string[];
  reservations?: string;
  accessibility?: string;
  parking?: string;
  geo?: { lat: number; lng: number };
  /** The page's own description, for writing a new one in our words. Never stored or shown. */
  sourceText?: string;
  /** Labels on the page that this extractor does not map yet, so nothing useful is silently dropped. */
  unmapped: string[];
  notes: string[];
  closureSignals: ClosureSignal[];
  modified?: string;
  copyrightYear?: number;
}
const clean = (value: string | undefined | null) =>
  (value ?? '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
const oneLine = (value: string | undefined | null) => clean(value).replace(/\s*\n\s*/g, ' ');
export const fold = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').toLowerCase();
const placeholderEmail =
  /^(email|mail|contact|exemple?|example|test)@(email|mail|example|exemple|domain|domaine)\./i;
/** Formats Martinique numbers as +596 XXX XX XX XX and leaves other valid international numbers spaced plainly. */
export function normalizePhone(raw: string | undefined | null): string | undefined {
  const text = clean(raw);
  if (!text) return undefined;
  let digits = text.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('0') && digits.length === 10) digits = '596' + digits.slice(1);
  if (!/^\d{9,15}$/.test(digits)) return undefined;
  if (digits.startsWith('596')) {
    // Martinique numbers are 596 followed by nine digits (some sources keep the old leading zero).
    const local = digits.slice(3).replace(/^0(?=\d{9}$)/, '');
    if (!/^\d{9}$/.test(local)) return undefined;
    return `+596 ${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
  }
  return `+${digits}`;
}
/** Maps spelling variants of common payment methods to one wording, and leaves anything else as written. */
export function canonicalPayment(value: string): string {
  const key = fold(value).replace(/\s+/g, ' ').trim();
  if (/^especes?$/.test(key)) return 'Espèces';
  if (/^cartes? (bancaires?|bleues?)$|^cb$/.test(key)) return 'Cartes bancaires';
  if (/^cheques?( vacances)?$/.test(key))
    return key.includes('vacances') ? 'Chèques vacances' : 'Chèques';
  if (/^virements?( bancaires?)?$/.test(key)) return 'Virement bancaire';
  if (/ticket.* restaurant|titres?.* restaurant/.test(key)) return 'Tickets restaurant';
  return clean(value);
}
/** Sources sometimes shout in capitals; turn those into ordinary capitalisation, and leave mixed case alone. */
export function tidyCase(value: string): string {
  const letters = value.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length < 6 || letters.replace(/[^A-ZÀ-Þ]/g, '').length / letters.length < 0.7)
    return value;
  const small = new Set([
    'de',
    'du',
    'des',
    'la',
    'le',
    'les',
    'et',
    'en',
    'sur',
    'sous',
    'au',
    'aux',
    "d'",
    "l'",
  ]);
  return value
    .toLowerCase()
    .split(/(\s+)/)
    .map((part, index) =>
      /\s+/.test(part) || (index > 0 && small.has(part))
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join('');
}
/** Joins street lines, dropping a second line that only repeats the first. */
export function joinStreet(first: string, second: string): string {
  const a = fold(first)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const b = fold(second)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!b || a.includes(b)) return first;
  if (!a || b.includes(a)) return second;
  return `${first}, ${second}`;
}
/** "16€", "1 200 €" → 16, 1200. */
const euros = (value: string) => {
  const number = Number(value.replace(/[^\d,.]/g, '').replace(',', '.'));
  return Number.isFinite(number) && value.trim() !== '' && /\d/.test(value) ? number : undefined;
};
const months: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
};
/** "Du 1 janvier 2024 au 31 décembre 2024" → the last day of validity, if the page states one. */
export function validityEnd(text: string): string | undefined {
  const match = /\bau\s+(\d{1,2})(?:er)?\s+([a-zéûè]+)\s+(\d{4})/i.exec(
    fold(text).replace(/\s+/g, ' '),
  );
  if (!match) return undefined;
  const month = months[match[2]];
  return month
    ? `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`
    : undefined;
}
const dayNames: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};
function minutes(value: unknown): number | undefined {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''));
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}
/** schema.org opening hours → periods. Anything overnight or malformed returns undefined rather than a guess. */
export function periodsFromSpec(spec: unknown): Period[] | undefined {
  const items = (Array.isArray(spec) ? spec : spec ? [spec] : []) as Record<string, unknown>[];
  const periods: Period[] = [];
  for (const item of items) {
    const days = ([] as unknown[]).concat(item.dayOfWeek ?? []);
    const opens = minutes(item.opens);
    let closes = minutes(item.closes);
    if (opens === undefined || closes === undefined) return undefined;
    if (closes === 0) closes = 1440;
    if (opens >= closes) return undefined;
    for (const day of days) {
      const index = dayNames[String(day).replace(/^.*\//, '').toLowerCase()];
      if (index === undefined) return undefined;
      periods.push({ day: index, opens, closes });
    }
  }
  const unique = [...new Map(periods.map((p) => [`${p.day}-${p.opens}-${p.closes}`, p])).values()];
  return unique.length && unique.length <= 28
    ? unique.sort((a, b) => a.day - b.day || a.opens - b.opens)
    : undefined;
}
const strongClosure: [RegExp, string][] = [
  [/d[eé]finitivement\s+ferm/, 'définitivement fermé'],
  [/ferm\w*\s+d[eé]finitiv/, 'fermé définitivement'],
  [/fermeture\s+d[eé]finitive/, 'fermeture définitive'],
  [/a\s+(?:d[eé]finitivement\s+)?cess[eé]\s+(?:son\s+|toute\s+)?activit/, 'a cessé son activité'],
  [/cessation\s+d['’]activit/, "cessation d'activité"],
  [/n['’]est\s+plus\s+ouvert/, "n'est plus ouvert"],
  [/a\s+ferm[eé]\s+ses\s+portes/, 'a fermé ses portes'],
  [/liquidation\s+judiciaire/, 'liquidation judiciaire'],
  [/permanently\s+closed/, 'permanently closed'],
  [/closed\s+permanently/, 'closed permanently'],
  [/has\s+(?:permanently\s+)?closed\s+down/, 'has closed down'],
  [/no\s+longer\s+(?:open|operat)/, 'no longer open'],
];
const weakClosure: [RegExp, string][] = [
  [/ferm[eé]e?\s+pour\s+(?:travaux|renovation|cause)/, 'fermé pour travaux'],
  [/\ben\s+(?:cours\s+de\s+)?(?:renovation|travaux)\b/, 'en rénovation / travaux'],
  [/temporairement\s+ferm/, 'temporairement fermé'],
  [/fermeture\s+(?:annuelle|temporaire|exceptionnelle|provisoire)/, 'fermeture temporaire'],
  [/\ba\s+vendre\b/, 'à vendre'],
  [/\b(?:propriete|domaine|site|acces)\s+(?:privee?|interdit|reserve)/, 'privé / accès réservé'],
  [/ferm[eé]e?\s+au\s+public/, 'fermé au public'],
  [/ne\s+se\s+visite\s+(?:pas|plus)/, 'ne se visite plus'],
  [/temporarily\s+closed/, 'temporarily closed'],
  [/closed\s+for\s+(?:renovation|repairs|the\s+season|maintenance)/, 'closed for renovation'],
  [/under\s+renovation/, 'under renovation'],
  [/not\s+open\s+to\s+the\s+public/, 'not open to the public'],
];
export function closureSignals(text: string): ClosureSignal[] {
  const flat = text.replace(/\s+/g, ' ');
  const folded = fold(flat);
  const found: ClosureSignal[] = [];
  for (const [list, strength] of [
    [strongClosure, 'strong'],
    [weakClosure, 'weak'],
  ] as const)
    for (const [pattern, phrase] of list) {
      const match = pattern.exec(folded);
      if (!match) continue;
      // Folding keeps string length, so the same offsets index the original text.
      const start = Math.max(0, match.index - 90);
      found.push({
        strength,
        phrase,
        snippet: flat.slice(start, match.index + match[0].length + 90).trim(),
      });
    }
  return found;
}
function jsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const data = JSON.parse($(element).contents().text());
      const walk = (value: unknown) => {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') {
          nodes.push(value as Record<string, unknown>);
          walk((value as Record<string, unknown>)['@graph']);
        }
      };
      walk(data);
    } catch {
      /* A malformed block is ignored; other blocks may still be valid. */
    }
  });
  return nodes;
}
const businessType =
  /(Restaurant|FoodEstablishment|LocalBusiness|BarOrPub|CafeOrCoffeeShop|TouristAttraction|Museum|Store|Hotel|LodgingBusiness|SportsActivityLocation|AmusementPark|Park|Place|EntertainmentBusiness|HealthAndBeautyBusiness|Winery|Distillery|Product|Organization)$/;
function typeOf(node: Record<string, unknown>) {
  return ([] as unknown[]).concat(node['@type'] ?? []).map(String);
}
/**
 * Tourism directories describe many venues. Their own header, footer and contact details belong to the
 * directory, so on pages that are not a venue's record nothing contact-related is taken from them.
 */
export const directoryHosts = [
  'martinique.org',
  'terresducentremartinique.fr',
  'pnr-martinique.com',
  'tripadvisor.fr',
  'tripadvisor.com',
];
export function isDirectory(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return directoryHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}
/** A profile address without tracking parameters or fragments. */
function cleanSocial(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  const keepId = /profile\.php/.test(parsed.pathname);
  const id = parsed.searchParams.get('id');
  parsed.search = keepId && id ? `?id=${id}` : '';
  return parsed.toString();
}
const socialHost = (url: string, hosts: string[]) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\.|^m\.|^fr-fr\./, '');
    if (!hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return false;
    // Share, plugin and tracking links are not the venue's own page.
    return !/\/(sharer|share|plugins|tr|dialog|intent)\b|sharer\.php|share\.php/i.test(
      parsed.pathname + parsed.search,
    );
  } catch {
    return false;
  }
};
function httpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
const addressFromLd = (value: unknown) => {
  if (!value || typeof value !== 'object')
    return typeof value === 'string' ? oneLine(value) : undefined;
  const a = value as Record<string, unknown>;
  const street = oneLine(String(a.streetAddress ?? ''));
  const town = [oneLine(String(a.postalCode ?? '')), oneLine(String(a.addressLocality ?? ''))]
    .filter(Boolean)
    .join(' ');
  return [street, town].filter(Boolean).join(', ') || undefined;
};
const text = ($: cheerio.CheerioAPI, selection: cheerio.Cheerio<AnyNode>) =>
  clean(selection.text());
export interface ExtractContext {
  url: string;
  today: string;
}
export function extract(html: string, context: ExtractContext): Extracted {
  const $ = cheerio.load(html);
  const result: Extracted = { template: 'generic', unmapped: [], notes: [], closureSignals: [] };
  result.pageTitle = oneLine($('title').first().text()) || undefined;
  const ld = jsonLd($);
  const provider =
    $('.TisProvider-infos').length > 0 || $('.TisProvider-body-description').length > 0;
  const terres =
    !provider && $('.elementor-icon-list-item').length > 0 && /terresducentre/i.test(context.url);
  // A directory's structured data describes the directory unless the page is a venue's own record.
  const ownRecord = !isDirectory(context.url) || provider || terres;
  const business = ownRecord
    ? ld.find((node) => typeOf(node).some((type) => businessType.test(type)) && node.name)
    : undefined;
  if (business) {
    result.heading = oneLine(String(business.name));
    result.address = addressFromLd(business.address);
    result.phone = normalizePhone(String(business.telephone ?? ''));
    result.priceRange = oneLine(String(business.priceRange ?? '')) || undefined;
    const geo = business.geo as { latitude?: unknown; longitude?: unknown } | undefined;
    if (geo && Number.isFinite(Number(geo.latitude)) && Number.isFinite(Number(geo.longitude)))
      result.geo = { lat: Number(geo.latitude), lng: Number(geo.longitude) };
    result.openingPeriods = periodsFromSpec(business.openingHoursSpecification);
    const cuisine = ([] as unknown[])
      .concat(business.servesCuisine ?? [])
      .map((c) => oneLine(String(c)))
      .filter(Boolean);
    if (cuisine.length) result.kind = cuisine;
    for (const link of ([] as unknown[]).concat(business.sameAs ?? [])) {
      const url = httpsUrl(String(link));
      if (!url) continue;
      if (!result.facebook && socialHost(url, ['facebook.com'])) result.facebook = cleanSocial(url);
      if (!result.instagram && socialHost(url, ['instagram.com']))
        result.instagram = cleanSocial(url);
    }
    const modified = String(
      business.dateModified ?? ld.find((node) => node.dateModified)?.dateModified ?? '',
    );
    if (/^\d{4}-\d{2}-\d{2}/.test(modified)) result.modified = modified.slice(0, 10);
  }
  result.modified ??= /^\d{4}-\d{2}-\d{2}/.exec(
    String(
      ld.find((node) => node.dateModified)?.dateModified ??
        $('meta[property="article:modified_time"]').attr('content') ??
        $('meta[property="og:updated_time"]').attr('content') ??
        '',
    ),
  )?.[0];
  const year = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map(
    (m) => Number(m[1]),
  );
  if (year.length) result.copyrightYear = Math.max(...year);
  if (provider) {
    result.template = 'martinique.org';
    martiniqueOrg($, result, context);
  } else if (terres) {
    result.template = 'terres-du-centre';
    terresDuCentre($, result, context);
  } else genericPage($, result, ownRecord, context.url);
  return result;
}
function martiniqueOrg($: cheerio.CheerioAPI, result: Extracted, context: ExtractContext) {
  const body = $('.TisProvider-body').first().length ? $('.TisProvider-body').first() : $('main');
  const infos = $('.TisProvider-infos').first();
  result.heading ??= oneLine($('h1').first().text()) || undefined;
  const line = infos.find('.address-line1').first().text();
  const street = tidyCase(
    joinStreet(oneLine(line), oneLine(infos.find('.address-line2').first().text())),
  );
  const postal = oneLine(infos.find('.postal-code').first().text());
  const town = oneLine(infos.find('.locality').first().text());
  if (town) result.town = town;
  // A postal code and town alone say nothing beyond the town, so no address is recorded for them.
  if (street)
    result.address = [street, [postal, town].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  else if (postal || town) result.notes.push('address-town-only');
  result.phone ??= normalizePhone(
    infos.find('.phone-item a').first().attr('href')?.replace(/^tel:/i, '') ??
      infos.find('.phone-item').text(),
  );
  const site = httpsUrl(infos.find('.website-item a').first().attr('href'));
  if (site) result.website = site;
  infos.find('.socials-links a').each((_, anchor) => {
    const url = httpsUrl($(anchor).attr('href'));
    if (!url) return;
    if (!result.facebook && socialHost(url, ['facebook.com'])) result.facebook = cleanSocial(url);
    if (!result.instagram && socialHost(url, ['instagram.com']))
      result.instagram = cleanSocial(url);
  });
  const description = text(
    $,
    body.find('.TisProvider-body-description').first().clone().find('h2').remove().end(),
  );
  if (description) result.sourceText = description.slice(0, 1500);
  // Hours: structured data wins; the on-page table is the fallback and is kept as the source's words.
  if (!result.openingPeriods) {
    const rows = body
      .find('.TisProvider-body-schedules table tr')
      .map((_, row) => {
        const cells = $(row).find('td');
        const times = cells
          .eq(1)
          .find('li')
          .map((__, li) => oneLine($(li).text()))
          .get()
          .join(', ');
        return times ? `${oneLine(cells.eq(0).text())} : ${times}` : '';
      })
      .get()
      .filter(Boolean);
    if (rows.length) {
      result.hoursText = rows.join('\n');
      result.notes.push('hours-text-unparsed');
    }
  }
  // Prices: a row that the page itself dates to a past period is not shown as current. When every row
  // has lapsed no price is shown at all; otherwise the range covers the rows still in force.
  const rows = body
    .find('.TisProvider-body-prices tbody tr')
    .map((_, row) => {
      const cells = $(row).find('td');
      return {
        until: validityEnd(cells.eq(0).find('span').text()),
        low: euros(oneLine(cells.eq(1).text())),
        high: euros(oneLine(cells.eq(2).text())),
      };
    })
    .get();
  if (rows.length) {
    const current = rows.filter((row) => !row.until || row.until >= context.today);
    const lapsed = rows.filter((row) => row.until && row.until < context.today);
    if (lapsed.length)
      result.notes.push(
        `price-expired:${lapsed
          .map((row) => row.until)
          .sort()
          .at(-1)}`,
      );
    const amounts = current
      .flatMap((row) => [row.low, row.high])
      .filter((value): value is number => value !== undefined);
    if (!current.length) result.priceRange = undefined;
    else if (amounts.length) {
      const low = Math.min(...amounts);
      const high = Math.max(...amounts);
      const money = (value: number) =>
        `${Number.isInteger(value) ? value : value.toFixed(2).replace('.', ',')} €`;
      result.priceRange =
        low === high ? money(low) : `${money(low).replace(' €', '')}–${money(high)}`;
    }
  }
  const items = (selection: cheerio.Cheerio<AnyNode>) =>
    selection
      .find('.tourinsoft-criteria')
      .map((_, e) => oneLine($(e).text()))
      .get()
      .filter(Boolean);
  const services = items(body.find('.TisProvider-body-services'));
  if (services.length) result.services = services;
  body.find('.TisProvider-body-others-informations > ul > li').each((_, li) => {
    const label = oneLine($(li).contents().first().text());
    const values = items($(li));
    const key = fold(label);
    if (!values.length) return;
    if (/langue/.test(key)) result.languages = values;
    else if (/paiement/.test(key)) result.payment = values.map(canonicalPayment);
    else if (/accessib|handicap|pmr/.test(key)) result.accessibility = values.join(', ');
    else if (/parking|stationnement/.test(key)) result.parking = values.join(', ');
    else if (/reserv/.test(key)) result.reservations = values.join(', ');
    else result.unmapped.push(`${label}: ${values.join(', ')}`);
  });
  body.find('h2').each((_, h) => {
    const label = oneLine($(h).text());
    if (
      !/^(Horaires|Tarifs|Nos services|Autres informations|Emplacement|Coordonn|Découvrez|Partager)/i.test(
        label,
      ) &&
      !$(h).closest('.TisProvider-body-description').length
    )
      if ($(h).closest('.TisProvider-body').length) result.unmapped.push(`section: ${label}`);
  });
  result.closureSignals = closureSignals(clean(body.text()));
}
function terresDuCentre($: cheerio.CheerioAPI, result: Extracted, _context: ExtractContext) {
  void _context;
  const everything = $('*').toArray();
  const order = new Map(everything.map((element, index) => [element, index]));
  // The footer repeats the tourist offices' own addresses and hours; stop before it.
  const boundary = everything.find((element) =>
    /^informations compl[eé]mentaires$/i.test(
      oneLine($(element).clone().children().remove().end().text()),
    ),
  );
  const limit = boundary ? order.get(boundary)! : Infinity;
  const before = (element: AnyNode) => (order.get(element) ?? Infinity) < limit;
  result.heading = oneLine($('h2.elementor-heading-title').first().text()) || undefined;
  const addressLines: string[] = [];
  $('.elementor-icon-list-item').each((_, item) => {
    if (!before(item)) return;
    const icon = $(item).find('i').attr('class') ?? '';
    const value = oneLine($(item).find('.elementor-icon-list-text').first().text());
    if (!value) return;
    if (/map-marker/.test(icon)) addressLines.push(value);
    else if (/phone/.test(icon)) result.phone ??= normalizePhone(value);
    else if (/envelope/.test(icon) && !placeholderEmail.test(value)) result.notes.push('has-email');
    else if (/envelope/.test(icon)) result.notes.push('placeholder-email-ignored');
  });
  // The page shows the town in its header and the street address further down: tell them apart by the postal code.
  const street = addressLines.find((line) => /\b97\d{3}\b/.test(line));
  if (street) result.address = street;
  const town = addressLines.find((line) => line !== street && !/\d/.test(line));
  if (town) result.town = town;
  else if (street) result.town = /\b97\d{3}\s+(.+)$/.exec(street)?.[1];
  const labelled = new Map<string, string>();
  $('.elementor-icon-list-text').each((_, element) => {
    if (!before(element)) return;
    const label = oneLine($(element).text());
    if (
      !/^(Description|Moyens? de paiement|Horaires d.ouverture|G[eé]olocalisation|Tarifs?|Services?|Langues?|Accessibilit[eé]|Parking|R[eé]servation)/i.test(
        label,
      )
    )
      return;
    const widget = $(element).closest('.elementor-widget');
    const next = widget.nextAll('.elementor-widget').first();
    if (!next.length || next.find('.elementor-icon-list-text').length) return;
    const value = clean(
      next
        .find('.elementor-widget-container')
        .first()
        .html()
        ?.replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '') ?? '',
    );
    if (value && !labelled.has(label))
      labelled.set(label, value.replace(/▪️|▪|•/g, '').replace(/&amp;/g, '&'));
  });
  for (const [label, value] of labelled) {
    const key = fold(label);
    if (/^description/.test(key)) result.sourceText = value.slice(0, 1500);
    else if (/paiement/.test(key))
      result.payment = value
        .split(/[,;]|\bet\b/i)
        .map((v) => canonicalPayment(oneLine(v)))
        .filter(Boolean);
    else if (/horaires/.test(key)) {
      result.hoursText = value.split('\n').map(oneLine).filter(Boolean).join('\n').slice(0, 400);
      result.notes.push('hours-text-unparsed');
    } else if (/langue/.test(key))
      result.languages = value.split(/[,;]/).map(oneLine).filter(Boolean);
    else if (/accessib/.test(key)) result.accessibility = oneLine(value);
    else if (/parking/.test(key)) result.parking = oneLine(value);
    else if (/reservation/.test(key)) result.reservations = oneLine(value);
    else if (!/geolocalisation/.test(key))
      result.unmapped.push(`${label}: ${oneLine(value).slice(0, 80)}`);
  }
  const main = $('[data-elementor-type="wp-page"]').first();
  const scope = main.length ? main : $('main');
  result.closureSignals = closureSignals(
    clean(scope.text()).split(/Informations complémentaires/i)[0],
  );
}
/** Pages that are not about one venue's own record (news, blog, contact) give boilerplate descriptions. */
const boilerplatePath =
  /actualit|news|blog|contact|mention|cgv|cgu|panier|shop|boutique|privacy|cookie/i;
function genericPage($: cheerio.CheerioAPI, result: Extracted, ownRecord: boolean, url: string) {
  result.heading ??= oneLine($('h1').first().text()) || undefined;
  if (ownRecord) {
    // Contact links usually sit in the header or footer, so read them before trimming the page.
    const tel = $('a[href^="tel:"]').first().attr('href')?.replace(/^tel:/i, '');
    result.phone ??= normalizePhone(tel);
    $('a[href]').each((_, anchor) => {
      const link = httpsUrl($(anchor).attr('href'));
      if (!link) return;
      if (!result.facebook && socialHost(link, ['facebook.com']))
        result.facebook = cleanSocial(link);
      if (!result.instagram && socialHost(link, ['instagram.com']))
        result.instagram = cleanSocial(link);
    });
  }
  const description =
    oneLine($('meta[name="description"]').attr('content')) ||
    oneLine($('meta[property="og:description"]').attr('content'));
  let path = '/';
  try {
    path = new URL(url).pathname;
  } catch {
    /* Keep the default. */
  }
  if (description && !boilerplatePath.test(path)) result.sourceText = description.slice(0, 1500);
  $('script,style,noscript,nav,header,footer,aside,form,svg').remove();
  const main = $('main').first().length ? $('main').first() : $('body');
  result.closureSignals = closureSignals(clean(main.text()));
}
