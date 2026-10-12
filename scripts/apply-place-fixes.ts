import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { hasLiveDatabase, liveClient } from './lib/place-sources';
import { backup, canonical, readJson, withLock, writeSeed } from './lib/apply-support';
import { placeDetailFields } from '../resources/js/lib/content';
/**
 * Applies a reviewed list of single-field corrections (tags, location or website) to the live catalogue. Without
 * --apply it only prints the diff. Each fix states the value it expects to replace, and nothing is written if the
 * live value has drifted from it. A website fix edits details.website and records where the new address was
 * confirmed in details.from.website; `to: null` removes a dead link.
 *   npm run places:fix -- --file=supabase/catalogue/fixes-2026-10-12.json             preview
 *   npm run places:fix -- --file=supabase/catalogue/fixes-2026-10-12.json --apply     write, then mirror the seed
 */
const base = { id: z.number().int().positive(), name: z.string(), why: z.string().min(1) };
const fixSchema = z.discriminatedUnion('field', [
  z.object({
    ...base,
    field: z.literal('tags'),
    from: z.array(z.string().min(1)),
    to: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    ...base,
    field: z.literal('location'),
    from: z.string().min(1),
    to: z.string().min(1),
  }),
  z
    .object({
      ...base,
      field: z.literal('website'),
      from: placeDetailFields.website,
      to: placeDetailFields.website.nullable(),
      evidence: placeDetailFields.website.optional(),
    })
    .refine((fix) => fix.to === null || fix.evidence, {
      message: 'A new website needs the evidence URL where it was confirmed.',
    }),
]);
type Fix = z.infer<typeof fixSchema>;
type Row = Record<string, unknown> & { details?: Record<string, unknown> | null };
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
const { fixes, checkedAt } = fileSchema.parse(await readJson(path));

/** The value a fix compares against: a column, or the website inside details. */
const valueOf = (row: Row, fix: Fix) =>
  fix.field === 'website' ? (row.details?.website ?? null) : row[fix.field];
/** The column and value to write for a fix. */
function patchFor(row: Row, fix: Fix): Record<string, unknown> {
  if (fix.field !== 'website') return { [fix.field]: fix.to };
  const details = { ...(row.details ?? {}) };
  const from = { ...((details.from as Record<string, unknown>) ?? {}) };
  if (fix.to === null) {
    delete details.website;
    delete from.website;
  } else {
    details.website = fix.to;
    from.website = { url: fix.evidence, checkedAt };
  }
  if (Object.keys(from).length) details.from = from;
  else delete details.from;
  return { details };
}

if (!hasLiveDatabase()) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.');
const client = liveClient();
const ids = [...new Set(fixes.map((fix) => fix.id))];
const columns = 'id,name,tags,location,details';
const { data: rows, error } = await client.from('mt_places').select(columns).in('id', ids);
if (error) throw new Error(error.message);
const live = new Map((rows as Row[]).map((row) => [row.id as number, row]));
const drifted: string[] = [];
const pending: Fix[] = [];
console.log(`${fixes.length} fixes from ${path}. ${apply ? 'APPLYING' : 'Preview only'}.`);
for (const fix of fixes) {
  const row = live.get(fix.id);
  const current = row ? valueOf(row, fix) : undefined;
  const named = row?.name === fix.name;
  const done = named && canonical(current) === canonical(fix.to);
  const ok = named && canonical(current) === canonical(fix.from);
  const note = done ? '  (already applied)' : ok ? '' : '  (DRIFTED)';
  console.log(
    `  #${fix.id} ${fix.name}  ${fix.field}: ${JSON.stringify(current)} -> ${JSON.stringify(fix.to)}${note}`,
  );
  console.log(`      ${fix.why}`);
  if (ok) pending.push(fix);
  else if (!done)
    drifted.push(
      `#${fix.id} expected ${JSON.stringify(fix.from)}, found ${JSON.stringify(current)}`,
    );
}
if (drifted.length)
  throw new Error(
    `Live values differ from the reviewed ones, nothing written: ${drifted.join('; ')}.`,
  );
if (!pending.length) {
  console.log('Every fix is already applied. Nothing to do.');
  process.exit(0);
}
if (!apply) {
  console.log('No changes were made. Add --apply to write them.');
  process.exit(0);
}
await withLock('place-fixes', async () => {
  console.log(`Backed up affected rows to ${await backup('place-fixes', rows)}.`);
  for (const fix of pending) {
    // Re-read so two fixes on one place build on each other.
    const current = await client.from('mt_places').select(columns).eq('id', fix.id).single();
    if (current.error) throw new Error(`Place ${fix.id}: ${current.error.message}`);
    const update = await client
      .from('mt_places')
      .update(patchFor(current.data as Row, fix))
      .eq('id', fix.id);
    if (update.error)
      throw new Error(
        `Place ${fix.id}: ${update.error.message}. Stopped; earlier fixes are written.`,
      );
  }
  const { data, error } = await client.from('mt_places').select(columns).in('id', ids);
  if (error) throw new Error(`Verification failed: ${error.message}`);
  const wrong = pending.filter((fix) => {
    const row = (data as Row[]).find((item) => item.id === fix.id);
    return !row || canonical(valueOf(row, fix)) !== canonical(fix.to);
  });
  if (wrong.length)
    throw new Error(
      `Verification found unexpected values for: ${wrong.map((fix) => fix.id).join(', ')}.`,
    );
  console.log(`Verified ${pending.length} fixes in the live catalogue.`);
});
const seedPath = 'database/data/places.json';
const seed = JSON.parse(await readFile(seedPath, 'utf8')) as Row[];
for (const fix of pending) {
  const entry = seed.find((item) => item.id === fix.id);
  if (entry) Object.assign(entry, patchFor(entry, fix));
}
await writeSeed(seedPath, seed);
console.log(`Updated ${seedPath}. Review its diff, then run npm run db:prepare.`);
