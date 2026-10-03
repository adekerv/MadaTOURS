import { readFile } from 'node:fs/promises';
import { liveClient, loadPlaces, today } from './lib/place-sources';
import { planSources, type DescriptionDraft } from './lib/apply-plan';
import {
  backup,
  canonical,
  csvIds,
  ensureListingSchema,
  readJson,
  withLock,
  writeSeed,
} from './lib/apply-support';
import type { PlaceAnalysis } from './lib/place-analysis';
/**
 * Writes what the cited sources state (see sources:extract) into the live catalogue, with provenance.
 * Without --apply it only shows what would change. Each place is checked against the moment it was read,
 * so a newer edit by a person is never overwritten.
 *   npm run sources:apply -- --from=.data/extraction/all-2026-10-02.json
 *   npm run sources:apply -- --from=... --ids=361,1 --apply
 *   npm run sources:apply -- --from=... --descriptions=supabase/catalogue/descriptions.json --apply
 * Descriptions file: { "361": { "en": "...", "fr": "...", "basedOn": "..." } }. A draft that copies more than
 * nine consecutive words from a source is refused. Add --sync-seed to mirror the result into the bundled seed.
 */
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'npm run sources:apply -- --from=extraction.json [--ids=1,2] [--descriptions=file.json] [--apply] [--sync-seed]',
  );
  process.exit(0);
}
if (
  args.some(
    (arg) => !['--apply', '--sync-seed'].includes(arg) && !/^--(from|ids|descriptions)=/.test(arg),
  )
)
  throw new Error('Unknown argument. Use --help.');
const option = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = args.includes('--apply');
if (args.includes('--sync-seed') && !apply) throw new Error('--sync-seed requires --apply.');
const from = option('from');
if (!from) throw new Error('Pass --from=<extraction json>. Run npm run sources:extract first.');
const extraction = await readJson<{ results: PlaceAnalysis[]; generatedAt: string }>(from);
const drafts = option('descriptions')
  ? await readJson<Record<string, DescriptionDraft>>(option('descriptions')!)
  : {};
const only = option('ids') ? csvIds(option('ids')) : undefined;
const { places, origin } = await loadPlaces();
if (origin !== 'live')
  throw new Error(
    'Applying needs the live database. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.',
  );
const client = liveClient();
const date = today();
const plans = extraction.results
  .filter((analysis) => !only || only.has(analysis.id))
  .flatMap((analysis) => {
    const current = places.find((place) => place.id === analysis.id);
    return current
      ? [{ analysis, plan: planSources(analysis, current, date, drafts[String(analysis.id)]) }]
      : [];
  });
const changing = plans.filter(({ plan }) => plan.changes.length);
console.log(
  `Extraction ${from} (read ${extraction.generatedAt}). ${apply ? 'APPLYING' : 'Preview only'}.`,
);
console.log(
  `${changing.length} of ${plans.length} places would change; ${plans.filter(({ plan }) => plan.skipped.length).length} have notes or refusals.`,
);
for (const { plan } of plans.slice(0, 60)) {
  if (plan.changes.length || plan.skipped.length)
    console.log(
      `  #${plan.id} ${plan.name}: ${plan.changes.join('; ') || 'no change'}${plan.skipped.length ? ` | ${plan.skipped.join(' ')}` : ''}`,
    );
}
if (!apply) {
  console.log('No changes were made. Add --apply to write them.');
  process.exit(0);
}
await ensureListingSchema(client);
await withLock('sources-apply', async () => {
  const saved = await backup(
    'sources',
    changing.map(({ plan }) => places.find((place) => place.id === plan.id)),
  );
  console.log(`Backed up affected rows to ${saved}.`);
  for (const { plan } of changing) {
    if (Object.keys(plan.patch).length) {
      const { error } = await client.from('mt_places').update(plan.patch).eq('id', plan.id);
      if (error)
        throw new Error(
          `Place ${plan.id}: ${error.message}. Stopped; earlier places were already updated (see the backup).`,
        );
    }
    if (plan.hours) {
      const { error } = await client.rpc('mt_apply_source_hours', {
        target_place: plan.id,
        periods: plan.hours.periods,
        source_url: plan.hours.url,
      });
      if (error) throw new Error(`Place ${plan.id} hours: ${error.message}`);
    }
  }
  const { data, error } = await client
    .from('mt_places')
    .select('id,details')
    .in(
      'id',
      changing.map(({ plan }) => plan.id),
    );
  if (error) throw new Error(`Verification failed: ${error.message}`);
  const missing = changing.filter(
    ({ plan }) =>
      plan.patch.details &&
      canonical(data.find((row) => row.id === plan.id)?.details) !== canonical(plan.patch.details),
  );
  if (missing.length)
    throw new Error(
      `Verification found details that did not save for: ${missing.map(({ plan }) => plan.id).join(', ')}.`,
    );
  console.log(`Verified ${changing.length} places.`);
});
if (args.includes('--sync-seed')) {
  const seedPath = 'database/data/places.json';
  const seed = JSON.parse(await readFile(seedPath, 'utf8')) as Record<string, unknown>[];
  for (const { plan } of changing) {
    const entry = seed.find((item) => item.id === plan.id);
    if (entry) Object.assign(entry, plan.patch);
  }
  await writeSeed(seedPath, seed);
  console.log(`Updated ${seedPath}. Review its diff, then run npm run db:prepare.`);
}
