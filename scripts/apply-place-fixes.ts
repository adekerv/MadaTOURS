import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { hasLiveDatabase, liveClient } from './lib/place-sources';
import { backup, canonical, readJson, withLock, writeSeed } from './lib/apply-support';
/**
 * Applies a reviewed list of single-field corrections (tags or location) to the live catalogue. Without --apply it
 * only prints the diff. Each fix states the value it expects to replace, and nothing is written if the live value
 * has drifted from it.
 *   npm run places:fix -- --file=supabase/catalogue/fixes-2026-10-12.json             preview
 *   npm run places:fix -- --file=supabase/catalogue/fixes-2026-10-12.json --apply     write, then mirror the seed
 */
const fixSchema = z.discriminatedUnion('field', [
  z.object({
    id: z.number().int().positive(),
    name: z.string(),
    field: z.literal('tags'),
    from: z.array(z.string().min(1)),
    to: z.array(z.string().min(1)).min(1),
    why: z.string().min(1),
  }),
  z.object({
    id: z.number().int().positive(),
    name: z.string(),
    field: z.literal('location'),
    from: z.string().min(1),
    to: z.string().min(1),
    why: z.string().min(1),
  }),
]);
const fileSchema = z.object({
  checkedAt: z.iso.date(),
  source: z.string(),
  fixes: z.array(fixSchema).min(1),
});
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--apply' && !arg.startsWith('--file=')))
  throw new Error('Unknown argument. Use --file=path.json and optionally --apply.');
const path = args.find((arg) => arg.startsWith('--file='))?.slice(7);
if (!path) throw new Error('Pass --file=path.json.');
const apply = args.includes('--apply');
const { fixes } = fileSchema.parse(await readJson(path));
if (!hasLiveDatabase()) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.');
const client = liveClient();
const ids = [...new Set(fixes.map((fix) => fix.id))];
const { data: rows, error } = await client
  .from('mt_places')
  .select('id,name,tags,location')
  .in('id', ids);
if (error) throw new Error(error.message);
const live = new Map(rows.map((row) => [row.id as number, row as Record<string, unknown>]));
const drifted: string[] = [];
console.log(`${fixes.length} fixes from ${path}. ${apply ? 'APPLYING' : 'Preview only'}.`);
for (const fix of fixes) {
  const row = live.get(fix.id);
  const current = row?.[fix.field];
  const ok = row && row.name === fix.name && canonical(current) === canonical(fix.from);
  console.log(
    `  #${fix.id} ${fix.name}  ${fix.field}: ${JSON.stringify(current)} -> ${JSON.stringify(fix.to)}${ok ? '' : '  (DRIFTED)'}`,
  );
  console.log(`      ${fix.why}`);
  if (!ok)
    drifted.push(
      `#${fix.id} expected ${JSON.stringify(fix.from)}, found ${JSON.stringify(current)}`,
    );
}
if (drifted.length)
  throw new Error(
    `Live values differ from the reviewed ones, nothing written: ${drifted.join('; ')}.`,
  );
if (!apply) {
  console.log('No changes were made. Add --apply to write them.');
  process.exit(0);
}
await withLock('place-fixes', async () => {
  console.log(`Backed up affected rows to ${await backup('place-fixes', rows)}.`);
  for (const fix of fixes) {
    const update = await client
      .from('mt_places')
      .update({ [fix.field]: fix.to })
      .eq('id', fix.id);
    if (update.error)
      throw new Error(
        `Place ${fix.id}: ${update.error.message}. Stopped; earlier fixes are written.`,
      );
  }
  const { data, error } = await client.from('mt_places').select('id,tags,location').in('id', ids);
  if (error) throw new Error(`Verification failed: ${error.message}`);
  const wrong = fixes.filter(
    (fix) => canonical(data.find((row) => row.id === fix.id)?.[fix.field]) !== canonical(fix.to),
  );
  if (wrong.length)
    throw new Error(
      `Verification found unexpected values for: ${wrong.map((fix) => fix.id).join(', ')}.`,
    );
  console.log(`Verified ${fixes.length} fixes in the live catalogue.`);
});
const seedPath = 'database/data/places.json';
const seed = JSON.parse(await readFile(seedPath, 'utf8')) as Record<string, unknown>[];
for (const fix of fixes) {
  const entry = seed.find((item) => item.id === fix.id);
  if (entry) entry[fix.field] = fix.to;
}
await writeSeed(seedPath, seed);
console.log(`Updated ${seedPath}. Review its diff, then run npm run db:prepare.`);
