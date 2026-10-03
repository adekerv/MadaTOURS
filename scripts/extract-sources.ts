import { mkdir, writeFile } from 'node:fs/promises';
import { loadPlaces, today } from './lib/place-sources';
import { SourceFetcher } from './lib/source-fetch';
import { analyzePlace, type PlaceAnalysis } from './lib/place-analysis';
/**
 * Reads every cited source of the chosen places and writes what they state, with provenance and conflicts.
 * Read-only: nothing is written to the database. Review the output, then use the apply script.
 *   npm run sources:extract -- --ids=361,1,5      chosen places
 *   npm run sources:extract -- --sample           the review sample (default)
 *   npm run sources:extract -- --all              every place
 * Options: --seed (bundled catalogue instead of the live database), --refresh (ignore the page cache)
 */
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'npm run sources:extract -- [--ids=1,2 | --sample | --all] [--seed] [--refresh] [--out=file.json]',
  );
  process.exit(0);
}
const known = ['--sample', '--all', '--seed', '--refresh'];
if (
  args.some((arg) => !known.includes(arg) && !arg.startsWith('--ids=') && !arg.startsWith('--out='))
)
  throw new Error('Unknown argument. Use --help.');
const { places, origin } = await loadPlaces({ seed: args.includes('--seed') });
const ids = args
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',')
  .map(Number);
const sampleIds = [361, 1, 5, 11, 7];
const chosen = args.includes('--all')
  ? places
  : places.filter((place) => (ids ?? sampleIds).includes(place.id));
if (ids && chosen.length !== new Set(ids).size) console.warn('Some requested ids were not found.');
const date = today();
const fetcher = new SourceFetcher({ refresh: args.includes('--refresh') });
const results: PlaceAnalysis[] = [];
for (const place of chosen) {
  results.push(await analyzePlace(place, fetcher, date));
  if (results.length % 20 === 0) console.log(`${results.length}/${chosen.length}`);
}
const out =
  args.find((arg) => arg.startsWith('--out='))?.slice(6) ??
  `.data/extraction/${args.includes('--all') ? 'all' : 'sample'}-${date}.json`;
await mkdir(out.slice(0, out.lastIndexOf('/')), { recursive: true });
await writeFile(
  out,
  JSON.stringify({ generatedAt: new Date().toISOString(), origin, results }, null, 1),
);
const count = (test: (r: PlaceAnalysis) => boolean) => results.filter(test).length;
console.log(`Places read from the ${origin} catalogue: ${results.length}. Written to ${out}`);
console.log(
  `With conflicts: ${count((r) => r.conflicts.length > 0)}; with an unreachable or mismatched source: ${count((r) => r.flags.some((f) => /^(source-|page-does)/.test(f)))}`,
);
