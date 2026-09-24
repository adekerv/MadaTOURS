import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir, open, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { batchSchema, planImport, type CatalogueRow } from './lib/catalogue-import';

config({ path: ['.env.local', '.env'], quiet: true });
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'npm run catalogue:import -- [--apply] [--sync-seed]\nReads the reviewed 2026-09-24 batch. Defaults to read-only preview. Run only one importer at a time.',
  );
  process.exit(0);
}
if (args.some((arg) => !['--apply', '--sync-seed'].includes(arg)))
  throw new Error('Unknown argument. Use --help.');
const apply = args.includes('--apply');
if (args.includes('--sync-seed') && !apply) throw new Error('--sync-seed requires --apply.');
const batch = batchSchema.parse(
  JSON.parse(await readFile('supabase/catalogue/2026-09-24.json', 'utf8')),
);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const receiptKey = `catalogue_import_${batch.batch}`;
async function readRows(): Promise<CatalogueRow[]> {
  const rows: CatalogueRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await client
      .from('mt_places')
      .select('*')
      .order('id')
      .range(offset, offset + 499);
    if (result.error) throw new Error(`Catalogue read failed (${result.error.code}).`);
    rows.push(...(result.data as CatalogueRow[]));
    if (result.data.length < 500) return rows;
  }
}
await mkdir('.data/catalogue-import', { recursive: true });
const lockPath = '.data/catalogue-import/import.lock';
const lock = await open(lockPath, 'wx').catch(() => {
  throw new Error(
    'An importer is already running or left a lock. Check before removing .data/catalogue-import/import.lock.',
  );
});
try {
  const rows = await readRows();
  const saved = await client
    .from('mt_metadata')
    .select('value')
    .eq('key', receiptKey)
    .maybeSingle();
  if (saved.error) throw new Error(`Import history read failed (${saved.error.code}).`);
  const receipt = z
    .record(z.string(), z.number().int().positive())
    .parse(saved.data ? JSON.parse(saved.data.value) : {});
  const plan = planImport(batch, rows, receipt);
  console.log(
    `${apply ? 'APPLY' : 'PREVIEW'} ${new URL(url).hostname}: ${plan.additions.length} additions, ${plan.updates.length} existing map/source corrections.`,
  );
  if (apply) {
    const backup = `.data/catalogue-import/${Date.now()}-before.json`;
    await writeFile(backup, JSON.stringify(rows, null, 2) + '\n', { flag: 'wx' });
    console.log(`Venue-only backup saved to ${backup}.`);
    // Let PostgreSQL allocate IDs so existing favorites and future admin inserts remain valid.
    if (plan.additions.length) {
      const inserted = await client.from('mt_places').insert(plan.additions).select('id,sources');
      if (inserted.error)
        throw new Error(`Insert failed (${inserted.error.code}); no insert retry was attempted.`);
      if (inserted.data.length !== plan.additions.length)
        throw new Error('Unexpected insert response count; inspect the database before retrying.');
      for (const row of inserted.data) receipt[row.sources[0].url] = row.id;
    }
    for (const place of batch.additions) {
      const existing = rows.find((row) =>
        row.sources.some((source) => source.url === place.sources[0].url),
      );
      if (existing) receipt[place.sources[0].url] = existing.id;
    }
    // Persist successful inserts before independent corrections; a rerun can resume after failure.
    const recorded = await client
      .from('mt_metadata')
      .upsert({ key: receiptKey, value: JSON.stringify(receipt) });
    if (recorded.error)
      throw new Error(
        `Import history write failed (${recorded.error.code}); preserve the backup and inspect before retrying.`,
      );
    for (const update of plan.updates) {
      const result = await client
        .from('mt_places')
        .update(update.after)
        .eq('id', update.id)
        .eq('name', update.name)
        .eq('lat', update.before.lat)
        .eq('lng', update.before.lng)
        .eq('sources', JSON.stringify(update.before.sources))
        .select('id');
      if (result.error || result.data?.length !== 1)
        throw new Error(
          `Correction stopped for ${update.name}; the record changed or the request failed.`,
        );
    }
    const after = await readRows();
    const remaining = planImport(batch, after, receipt);
    if (remaining.additions.length || remaining.updates.length)
      throw new Error('Import verification failed.');
    for (const place of plan.additions) {
      if (!after.some((row) => row.id === receipt[place.sources[0].url] && row.published === true))
        throw new Error(`Inserted listing is missing: ${place.name}`);
    }
    if (args.includes('--sync-seed')) {
      const fields = [
        'id',
        'name',
        'type',
        'lat',
        'lng',
        'location',
        'description',
        'description_fr',
        'rating',
        'hours',
        'tags',
        'image',
        'photo_credit',
        'sources',
        'access',
        'published',
      ];
      const seed = after.map((row) =>
        Object.fromEntries(
          fields.filter((field) => row[field] != null).map((field) => [field, row[field]]),
        ),
      );
      await writeFile('src/data/places.json', JSON.stringify(seed, null, 2) + '\n');
    }
    console.log(
      `Verified ${after.filter((row) => row.published).length} public places; ${after.filter((row) => !row.published).length} drafts. No accounts or saved places were modified.`,
    );
  }
} finally {
  await lock.close();
  await unlink(lockPath);
}
