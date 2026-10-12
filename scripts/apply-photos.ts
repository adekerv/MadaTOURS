import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { format, resolveConfig } from 'prettier';
import { hasLiveDatabase, liveClient, today } from './lib/place-sources';
import { backup, readJson, withLock, writeSeed } from './lib/apply-support';
import { details, rejection } from './lib/commons';
import { encodeWebp } from './lib/webp';
import { parseCsv } from './lib/csv';
import { photoCreditSchema } from '../resources/js/lib/content';
/**
 * Gives landmarks their own Wikimedia Commons photo, from the picks made on the contact sheet that
 * `npm run photos:find` writes. Without --apply it only shows what would change.
 *   npm run photos:apply -- --picks=6:4,137:1             preview
 *   npm run photos:apply -- --picks=6:4,137:1 --apply     download, encode, write and verify
 * With --apply each file's licence is checked again on Commons, the photo is saved as a 960×640 WebP of at most
 * 100 KB in public/photos/<id>-<slug>.webp, the live place gets `image` and `photo_credit`, and the seed and
 * public/photos/CREDITS.md are updated.
 */
const candidatesPath = 'reports/photo-audit-2026-10-12/commons-candidates.csv';
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--apply' && !/^--picks=\d+:\d+(,\d+:\d+)*$/.test(arg)))
  throw new Error('Use --picks=placeId:rank,... from the contact sheet, and optionally --apply.');
const picks = (args.find((arg) => arg.startsWith('--picks='))?.slice(8) ?? '')
  .split(',')
  .filter(Boolean);
if (!picks.length) throw new Error('Pass --picks=placeId:rank,... from the contact sheet.');
const apply = args.includes('--apply');

const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/, '');
const https = (url: string) => url.replace(/^http:\/\//, 'https://');

const rows = parseCsv(await readFile(candidatesPath, 'utf8'));
const chosen = picks.map((pick) => {
  const row = rows.find((item) => item.pick === pick);
  if (!row) throw new Error(`No candidate ${pick} in ${candidatesPath}.`);
  return row;
});
const placeIds = chosen.map((row) => Number(row.place_id));
if (new Set(placeIds).size !== placeIds.length)
  throw new Error('Pick at most one photo per place.');
if (!hasLiveDatabase()) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.');
const client = liveClient();
const { data: live, error } = await client
  .from('mt_places')
  .select('id,name,image,photo_credit')
  .in('id', placeIds);
if (error) throw new Error(error.message);
// Licences can change: check each file again on Commons right before using it.
const files = await details(
  chosen.map((row) => row.file),
  1600,
);
const plan = chosen.map((row) => {
  const place = live.find((item) => item.id === Number(row.place_id));
  if (!place) throw new Error(`Place ${row.place_id} is not in the live catalogue.`);
  const file = files.get(row.file);
  if (!file) throw new Error(`${row.file} is no longer on Commons.`);
  const why = rejection(file);
  if (why) throw new Error(`${row.file} can no longer be used: ${why}.`);
  return { place, file, name: `${place.id}-${slug(place.name)}.webp` };
});
console.log(`${plan.length} landmark photos. ${apply ? 'APPLYING' : 'Preview only'}.`);
for (const { place, file, name } of plan)
  console.log(
    `  #${place.id} ${place.name}: ${file.title} (${file.licence}, ${file.attribution || file.author}) -> /photos/${name}${place.image ? `, replacing ${place.image}` : ''}`,
  );
if (!apply) {
  console.log('No changes were made. Add --apply to write them.');
  process.exit(0);
}

const date = today();
const credits: Record<number, unknown> = {};
const browser = await chromium.launch();
try {
  await withLock('photos-apply', async () => {
    console.log(`Backed up affected rows to ${await backup('photos', live)}.`);
    for (const { place, file, name } of plan) {
      const download = await fetch(file.thumb, {
        headers: { 'User-Agent': 'MadaTours photo import (https://github.com/adekerv/MadaTOURS)' },
      });
      if (!download.ok) throw new Error(`${file.title}: download failed (${download.status}).`);
      const encoded = await encodeWebp(browser, Buffer.from(await download.arrayBuffer()), {
        maxBytes: 100 * 1024,
      });
      await writeFile(`public/photos/${name}`, encoded.bytes);
      const credit = photoCreditSchema.parse({
        author: (file.attribution || file.author || 'Unknown author').slice(0, 200),
        license: file.licence,
        licenseUrl: https(file.licenceUrl || file.url),
        sourceUrl: https(file.url),
        caption: place.name.slice(0, 300),
        basis: 'commons',
        title: file.title.replace(/^File:/, '').slice(0, 300),
        modified: encoded.smoothed ? 'cropped, resized, lightly smoothed' : 'cropped, resized',
        retrievedAt: date,
        ...(file.attribution ? { attribution: file.attribution.slice(0, 300) } : {}),
      });
      credits[place.id] = credit;
      const update = await client
        .from('mt_places')
        .update({ image: `/photos/${name}`, photo_credit: credit })
        .eq('id', place.id);
      if (update.error)
        throw new Error(
          `Place ${place.id}: ${update.error.message}. Stopped; earlier photos are written.`,
        );
      console.log(
        `  #${place.id} saved /photos/${name} (${(encoded.bytes.length / 1024).toFixed(1)} KB, q${encoded.quality})`,
      );
    }
    const check = await client.from('mt_places').select('id,image').in('id', placeIds);
    if (check.error) throw new Error(`Verification failed: ${check.error.message}`);
    const wrong = plan.filter(
      ({ place, name }) =>
        check.data.find((row) => row.id === place.id)?.image !== `/photos/${name}`,
    );
    if (wrong.length)
      throw new Error(
        `Verification found unexpected images for: ${wrong.map(({ place }) => place.id).join(', ')}.`,
      );
    console.log(`Verified ${plan.length} photos in the live catalogue.`);
  });
} finally {
  await browser.close();
}

const seedPath = 'database/data/places.json';
const seed = await readJson<Record<string, unknown>[]>(seedPath);
for (const { place, name } of plan) {
  const entry = seed.find((item) => item.id === place.id);
  if (entry) Object.assign(entry, { image: `/photos/${name}`, photo_credit: credits[place.id] });
}
await writeSeed(seedPath, seed);
const creditsPath = 'public/photos/CREDITS.md';
const markdown = await readFile(creditsPath, 'utf8');
const cell = (text: string) => text.replaceAll('|', '\\|');
const added = plan
  .map(
    ({ file, name }) =>
      `| \`${name}\` | ${cell(file.attribution || file.author)} | [${cell(file.title.replace(/^File:/, ''))}](<${https(file.url)}>), retrieved ${date}, cropped and resized | [${cell(file.licence)}](${https(file.licenceUrl || file.url)}) |`,
  )
  .join('\n');
const tableEnd = markdown.indexOf('\n\nPreserve attribution');
if (tableEnd < 0) throw new Error(`Could not find the credits table in ${creditsPath}.`);
const next = `${markdown.slice(0, tableEnd)}\n${added}${markdown.slice(tableEnd)}`;
await writeFile(
  creditsPath,
  await format(next, { ...((await resolveConfig(creditsPath)) ?? {}), filepath: creditsPath }),
);
console.log(
  `Updated ${seedPath} and ${creditsPath}. Review the diff, then run npm run db:prepare.`,
);
