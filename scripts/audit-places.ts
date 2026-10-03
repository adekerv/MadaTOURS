import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadPlaces, today, type PlaceRecord } from './lib/place-sources';
import { SourceFetcher } from './lib/source-fetch';
import { loadBoardSitemap } from './lib/board-sitemap';
import { analyzePlace, type PlaceAnalysis, type SourceResult } from './lib/place-analysis';
/**
 * Checks every place's cited sources and proposes keep / update / uncertain / closed. Read-only:
 * it writes a CSV and a JSON report and changes nothing. Re-run every few months.
 *   npm run places:audit
 * Options: --seed (bundled catalogue), --refresh (ignore the page cache), --stale-years=3
 *
 * A dead link alone never means "closed": it means "needs checking". A place is proposed as closed only
 * when a page that is about the place says so in clear words. Every proposal still goes to a human.
 */
export type Proposal = 'keep' | 'update' | 'uncertain' | 'closed';
export interface AuditRow {
  id: number;
  name: string;
  town: string;
  currentStatus: string;
  proposed: Proposal;
  reason: string;
  evidenceUrl: string;
  sourcesChecked: number;
  notes: string[];
  /** Whether visitors can see the place today. Drafts are reported but never changed by the audit. */
  public: boolean;
  decidedBy: 'script' | 'manual';
}
const rank = (url: string) => (/martinique\.org|terresducentre|pnr-martinique/.test(url) ? 1 : 0);
const dead = (source: SourceResult) =>
  source.fetch === 'not_found' || source.fetch === 'dns' || source.fetch === 'tls';
const live = (source: SourceResult) => source.fetch === 'ok' && source.nameMatch >= 0.5;
const years = (from: string, to: string) =>
  (Date.parse(to) - Date.parse(from)) / (365.25 * 86400_000);
const label: Record<string, string> = {
  not_found: 'the page no longer exists (HTTP 404/410)',
  dns: 'the website address no longer resolves',
  tls: 'the website has a broken security certificate',
  timeout: 'the website did not answer',
  server_error: 'the website returned a server error',
  network: 'the website could not be reached',
  robots_denied: 'the website does not allow automated checks',
  blocked: 'the website blocks automated checks',
  non_html: 'the source is a document, not a web page',
  too_large: 'the page is too large to read',
  redirect_loop: 'the address redirects in a loop',
};
export function judge(
  analysis: PlaceAnalysis,
  date: string,
  staleYears: number,
): Omit<AuditRow, 'id' | 'name' | 'town' | 'currentStatus' | 'public' | 'decidedBy'> {
  const notes: string[] = [];
  const sources = analysis.sources;
  const base = { sourcesChecked: sources.length, notes };
  for (const source of sources) {
    if (source.redirected && source.fetch === 'ok')
      notes.push(`Link redirects to ${source.finalUrl}`);
    for (const note of source.extracted?.notes ?? [])
      if (note.startsWith('price-expired'))
        notes.push(`Source price list ended ${note.split(':')[1]}`);
  }
  for (const conflict of analysis.conflicts)
    notes.push(
      `Source ${conflict.field} differs: ours "${conflict.ours}", source "${conflict.theirs}"`,
    );
  const matched = sources.filter(live).sort((a, b) => rank(a.url) - rank(b.url));
  // 1. A page about this place that clearly says it is closed.
  for (const source of matched) {
    const strong = source.extracted?.closureSignals.find((signal) => signal.strength === 'strong');
    if (strong)
      return {
        ...base,
        proposed: 'closed',
        reason: `Source says "${strong.phrase}": “${strong.snippet}”`,
        evidenceUrl: source.url,
      };
  }
  // 2. Softer wording (renovation, seasonal or temporary closure, private access) needs a human decision.
  for (const source of matched) {
    const weak = source.extracted?.closureSignals.find((signal) => signal.strength === 'weak');
    if (weak)
      return {
        ...base,
        proposed: 'uncertain',
        reason: `Source mentions "${weak.phrase}": “${weak.snippet}”`,
        evidenceUrl: source.url,
      };
  }
  if (!sources.length)
    return {
      ...base,
      proposed: 'uncertain',
      reason: 'No source is cited for this place.',
      evidenceUrl: '',
    };
  if (matched.length) {
    const dated = matched
      .map((source) => source.extracted?.modified)
      .filter((value): value is string => !!value);
    const undated = matched.length > dated.length;
    const newest = dated.sort().at(-1);
    if (!undated && newest && years(newest, date) > staleYears)
      return {
        ...base,
        proposed: 'uncertain',
        reason: `Its only live listing was last updated ${newest} (over ${staleYears} years ago), so it cannot confirm the place is still open.`,
        evidenceUrl: matched[0].url,
      };
    // A tourism-board page that loads but has left the board's own current index may be an orphaned page.
    const boardPages = matched.filter((source) => source.board);
    if (
      boardPages.length &&
      boardPages.length === matched.length &&
      boardPages.every((source) => !source.board!.listed)
    )
      return {
        ...base,
        proposed: 'uncertain',
        reason:
          "The tourism board page still loads but is no longer in the board's current sitemap, so it may be an orphaned page.",
        evidenceUrl: matched[0].url,
      };
    for (const source of matched)
      if (source.board?.listed)
        notes.push(
          `Listed in the tourism board's current sitemap${source.board.modified ? ` (changed ${source.board.modified})` : ''}`,
        );
    const changed = analysis.conflicts.filter((conflict) => conflict.field !== 'map point');
    if (changed.length)
      return {
        ...base,
        proposed: 'update',
        reason: `Open and listed, but details differ: ${changed.map((c) => c.field).join(', ')}.`,
        evidenceUrl: changed[0].source,
      };
    const mapped = analysis.conflicts.find((conflict) => conflict.field === 'map point');
    return {
      ...base,
      proposed: 'keep',
      reason: `Listed on ${matched.length} live page${matched.length > 1 ? 's' : ''} about the place, with no closure wording${newest ? ` (listing updated ${newest})` : ''}.${mapped ? ' Map point differs from the source; review separately.' : ''}`,
      evidenceUrl: matched[0].url,
    };
  }
  // 3. Nothing could be confirmed. Explain each source rather than guessing.
  const problems = sources.map((source) => {
    if (source.fetch === 'ok')
      return `${source.url} loads but is about “${source.extracted?.heading ?? source.extracted?.pageTitle ?? 'something else'}”${source.redirected ? ` (redirected to ${source.finalUrl})` : ''}`;
    return `${source.url}: ${label[source.fetch] ?? source.fetch}`;
  });
  const allDead = sources.every(dead);
  return {
    ...base,
    proposed: 'uncertain',
    reason: `${allDead ? 'Every cited link is dead' : 'Could not confirm from any cited source'}. A dead link alone is not proof of closure. ${problems.join('; ')}`,
    evidenceUrl: sources[0].url,
  };
}
const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
export function toCsv(rows: AuditRow[]) {
  const header = [
    'id',
    'place',
    'town',
    'current_status',
    'proposed_status',
    'reason',
    'evidence_link',
    'sources_checked',
    'public',
    'decided_by',
    'notes',
  ];
  return (
    [
      header.join(','),
      ...rows.map((row) =>
        [
          row.id,
          row.name,
          row.town,
          row.currentStatus,
          row.proposed,
          row.reason,
          row.evidenceUrl,
          row.sourcesChecked,
          row.public ? 'yes' : 'no',
          row.decidedBy,
          row.notes.join(' | '),
        ]
          .map(quote)
          .join(','),
      ),
    ].join('\n') + '\n'
  );
}
export interface Override {
  id: number;
  proposed: Proposal;
  reason: string;
  evidenceUrl: string;
  checkedOn?: string;
}
/** Manual research replaces the script's proposal and is recorded as such, with the reviewer's own evidence. */
export function applyOverrides(rows: AuditRow[], overrides: Override[]): AuditRow[] {
  const byId = new Map(overrides.map((item) => [item.id, item]));
  return rows.map((row) => {
    const override = byId.get(row.id);
    if (!override) return row;
    return {
      ...row,
      proposed: override.proposed,
      reason: `${override.reason} (manual review${override.checkedOn ? `, ${override.checkedOn}` : ''}; script said ${row.proposed})`,
      evidenceUrl: override.evidenceUrl || row.evidenceUrl,
      decidedBy: 'manual',
    };
  });
}
const currentStatus = (place: PlaceRecord) =>
  place.archived
    ? 'closed (archived)'
    : !place.published
      ? `draft (unpublished)${place.listing_status && place.listing_status !== 'active' ? `, ${place.listing_status}` : ''}`
      : (place.listing_status ?? 'active');
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(
      'npm run places:audit [-- --seed --refresh --stale-years=3 --overrides=reports/manual-review.json]\nRead-only. Writes reports/listing-audit-<date>.csv and .json.',
    );
    return;
  }
  if (
    args.some(
      (arg) =>
        !['--seed', '--refresh'].includes(arg) &&
        !arg.startsWith('--stale-years=') &&
        !arg.startsWith('--overrides='),
    )
  )
    throw new Error('Unknown argument. Use --help.');
  const staleYears = Number(args.find((arg) => arg.startsWith('--stale-years='))?.slice(14) ?? 3);
  if (!(staleYears > 0)) throw new Error('--stale-years must be a positive number.');
  const { places, origin } = await loadPlaces({ seed: args.includes('--seed') });
  const date = today();
  const fetcher = new SourceFetcher({ refresh: args.includes('--refresh') });
  const board = await loadBoardSitemap(fetcher);
  if (!board)
    console.warn("The tourism board's sitemap could not be read; listing membership is not used.");
  const rows: AuditRow[] = [];
  const analyses: PlaceAnalysis[] = [];
  for (const place of places) {
    const analysis = await analyzePlace(place, fetcher, date, board);
    analyses.push(analysis);
    rows.push({
      id: place.id,
      name: place.name,
      town: place.location,
      currentStatus: currentStatus(place),
      public: place.published,
      decidedBy: 'script',
      ...judge(analysis, date, staleYears),
    });
    if (rows.length % 25 === 0) console.log(`${rows.length}/${places.length}`);
  }
  const overridesPath = args.find((arg) => arg.startsWith('--overrides='))?.slice(12);
  const final = overridesPath
    ? applyOverrides(rows, JSON.parse(await readFile(overridesPath, 'utf8')) as Override[])
    : rows;
  await mkdir('reports', { recursive: true });
  const base = `reports/listing-audit-${date}`;
  await writeFile(`${base}.csv`, toCsv(final));
  await writeFile(
    `${base}.json`,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), origin, staleYears, rows: final, analyses },
      null,
      1,
    ),
  );
  const tally = (proposal: Proposal) => final.filter((row) => row.proposed === proposal).length;
  console.log(`Audited ${final.length} places from the ${origin} catalogue.`);
  console.log(
    `keep ${tally('keep')} · update ${tally('update')} · uncertain ${tally('uncertain')} · closed ${tally('closed')}`,
  );
  console.log(`Wrote ${base}.csv and ${base}.json. Nothing was changed in the database.`);
}
if (process.argv[1]?.endsWith('audit-places.ts')) await main();
