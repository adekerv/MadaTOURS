import { readFile } from 'node:fs/promises';
import { liveClient, loadPlaces, today, type PlaceRecord } from './lib/place-sources';
import { planListing } from './lib/apply-plan';
import {
  backup,
  csvIds,
  ensureListingSchema,
  latestReport,
  readJson,
  withLock,
  writeSeed,
} from './lib/apply-support';
import type { AuditRow, Proposal } from './audit-places';
import type { PlaceAnalysis } from './lib/place-analysis';
/**
 * Applies a reviewed audit report to the live catalogue. Without --apply it only shows what would change.
 *   npm run places:apply -- --report=reports/listing-audit-2026-10-02.json
 *   npm run places:apply -- --apply                                  keep and update only (the default)
 *   npm run places:apply -- --apply --include=keep,update,uncertain  also mark places for review
 *   npm run places:apply -- --apply --approve-closed=12,34           hide only the closures you approved
 * Nothing is deleted. Closing archives and hides a place; the reason and evidence are kept in mt_listing_audits.
 * Add --sync-seed to mirror the applied statuses into database/data/places.json, then review that diff.
 */
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'npm run places:apply -- [--report=file.json] [--apply] [--include=keep,update,uncertain] [--approve-closed=1,2] [--sync-seed]',
  );
  process.exit(0);
}
const known = ['--apply', '--sync-seed'];
if (args.some((arg) => !known.includes(arg) && !/^--(report|include|approve-closed)=/.test(arg)))
  throw new Error('Unknown argument. Use --help.');
const option = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = args.includes('--apply');
if (args.includes('--sync-seed') && !apply) throw new Error('--sync-seed requires --apply.');
const include = new Set(
  (option('include') ?? 'keep,update').split(',').filter(Boolean),
) as Set<Proposal>;
if ([...include].some((value) => !['keep', 'update', 'uncertain'].includes(value)))
  throw new Error(
    '--include accepts keep, update and uncertain. Closures need --approve-closed with place ids.',
  );
const approveClosed = csvIds(option('approve-closed'));
const reportPath = option('report') ?? (await latestReport('listing-audit-'));
const report = await readJson<{ rows: AuditRow[]; analyses: PlaceAnalysis[]; generatedAt: string }>(
  reportPath,
);
const { places, origin } = await loadPlaces();
if (origin !== 'live')
  throw new Error(
    'Applying needs the live database. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.',
  );
const client = liveClient();
const plan = planListing(report, places, { approveClosed, include });
const approvedButMissing = [...approveClosed].filter(
  (id) => !report.rows.some((row) => row.id === id && row.proposed === 'closed'),
);
if (approvedButMissing.length)
  throw new Error(`Not proposed as closed in this report: ${approvedButMissing.join(', ')}.`);
console.log(
  `Report ${reportPath} (generated ${report.generatedAt}). ${apply ? 'APPLYING' : 'Preview only'}.`,
);
const count = (to: string) =>
  plan.actions.filter((action) => action.to === to && action.from !== action.to).length;
console.log(
  `Status changes: ${count('active')} to active, ${count('needs_review')} to needs review, ${count('closed')} closed.`,
);
console.log(
  `Source dates to refresh: ${plan.actions.filter((action) => action.confirmedSources.length).length}. Awaiting a person: ${plan.held.length}. Skipped: ${plan.skipped.length}.`,
);
for (const held of plan.held.slice(0, 40))
  console.log(`  held  #${held.id} ${held.name}: ${held.reason.slice(0, 140)}`);
for (const skipped of plan.skipped.slice(0, 20))
  console.log(`  skip  #${skipped.id} ${skipped.name}: ${skipped.why}`);
if (!apply) {
  console.log('No changes were made. Add --apply to write them.');
  process.exit(0);
}
const date = today();
await ensureListingSchema(client);
await withLock('listing-apply', async () => {
  const saved = await backup(
    'listing',
    places.filter((place) => plan.actions.some((action) => action.id === place.id)),
  );
  console.log(`Backed up affected rows to ${saved}.`);
  let done = 0;
  for (const action of plan.actions) {
    if (action.from !== action.to) {
      const { error } = await client.rpc('mt_set_listing_status', {
        target_place: action.id,
        new_status: action.to,
        why: action.reason,
        evidence: action.evidence,
        checked: date,
      });
      if (error)
        throw new Error(
          `Place ${action.id}: ${error.message}. Stopped; already applied changes are recorded in mt_listing_audits.`,
        );
    }
    if (action.confirmedSources.length) {
      const { data, error } = await client
        .from('mt_places')
        .select('sources')
        .eq('id', action.id)
        .single();
      if (error) throw new Error(`Place ${action.id}: ${error.message}`);
      const sources = (data.sources as PlaceRecord['sources']).map((source) =>
        action.confirmedSources.includes(source.url) ? { ...source, checkedAt: date } : source,
      );
      const update = await client.from('mt_places').update({ sources }).eq('id', action.id);
      if (update.error) throw new Error(`Place ${action.id}: ${update.error.message}`);
    }
    if (++done % 25 === 0) console.log(`${done}/${plan.actions.length}`);
  }
  const { data, error } = await client
    .from('mt_places')
    .select('id,listing_status,archived,published')
    .in(
      'id',
      plan.actions.map((action) => action.id),
    );
  if (error) throw new Error(`Verification failed: ${error.message}`);
  const wrong = plan.actions.filter(
    (action) => data.find((row) => row.id === action.id)?.listing_status !== action.to,
  );
  if (wrong.length)
    throw new Error(
      `Verification found unexpected statuses for: ${wrong.map((action) => action.id).join(', ')}.`,
    );
  console.log(
    `Verified ${plan.actions.length} places. Public places now: ${(await client.from('mt_places').select('id', { count: 'exact', head: true }).eq('published', true)).count}.`,
  );
});
if (args.includes('--sync-seed')) {
  const seedPath = 'database/data/places.json';
  const seed = JSON.parse(await readFile(seedPath, 'utf8')) as Record<string, unknown>[];
  for (const action of plan.actions) {
    const entry = seed.find((item) => item.id === action.id);
    if (!entry) continue;
    if (action.from !== action.to) {
      entry.listing_status = action.to;
      if (action.to === 'closed') Object.assign(entry, { archived: true, published: false });
    }
    if (action.confirmedSources.length)
      entry.sources = (entry.sources as { url: string; checkedAt: string }[]).map((source) =>
        action.confirmedSources.includes(source.url) ? { ...source, checkedAt: date } : source,
      );
  }
  await writeSeed(seedPath, seed);
  console.log(`Updated ${seedPath}. Review its diff, then run npm run db:prepare.`);
}
