import { readFile } from 'node:fs/promises';
import { liveClient, hasLiveDatabase } from './lib/place-sources';
import { canonical, writeSeed } from './lib/apply-support';
/**
 * Mirrors the live catalogue's source-backed fields into the bundled seed (database/data/places.json), so a new
 * database, the offline fallback and the tests all start from what the live site shows. It only updates places
 * already in the seed and only these fields; review the diff before committing, then run npm run db:prepare.
 *   npm run catalogue:sync-seed            preview
 *   npm run catalogue:sync-seed -- --write write the seed
 */
const fields = [
  'description',
  'description_fr',
  'details',
  'sources',
  'opening_periods',
  'hours_source',
  'hours_updated_at',
  'listing_status',
  'archived',
  'published',
] as const;
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--write'))
  throw new Error('Unknown argument. Use --write to save.');
if (!hasLiveDatabase()) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.');
const client = liveClient();
const live: Record<string, unknown>[] = [];
for (let offset = 0; ; offset += 500) {
  const { data, error } = await client
    .from('mt_places')
    .select(['id', ...fields].join(','))
    .order('id')
    .range(offset, offset + 499);
  if (error) throw new Error(error.message);
  live.push(...(data as unknown as Record<string, unknown>[]));
  if (data.length < 500) break;
}
const seedPath = 'database/data/places.json';
const seed = JSON.parse(await readFile(seedPath, 'utf8')) as Record<string, unknown>[];
const changed: Record<string, number> = {};
let places = 0;
for (const entry of seed) {
  const row = live.find((item) => item.id === entry.id);
  if (!row) continue;
  let touched = false;
  for (const field of fields) {
    const value = row[field];
    // Empty values stay out of the seed, as they do for places that never had them.
    const empty =
      value === null ||
      value === undefined ||
      (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) ||
      (field === 'listing_status' && value === 'active') ||
      (field === 'archived' && value === false);
    if (empty) {
      if (field in entry && field !== 'published') {
        delete entry[field];
        changed[field] = (changed[field] ?? 0) + 1;
        touched = true;
      }
      continue;
    }
    if (canonical(entry[field]) !== canonical(value)) {
      entry[field] = value;
      changed[field] = (changed[field] ?? 0) + 1;
      touched = true;
    }
  }
  if (touched) places += 1;
}
console.log(
  `${places} seed places differ from the live catalogue. Fields: ${JSON.stringify(changed)}`,
);
if (!args.includes('--write')) console.log('Preview only. Add --write to update the seed.');
else {
  await writeSeed(seedPath, seed);
  console.log(`Updated ${seedPath}. Review its diff, then run npm run db:prepare.`);
}
