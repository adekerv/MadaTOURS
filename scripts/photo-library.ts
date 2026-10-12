import { readFileSync, statSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import type { LibraryEntry } from '../resources/js/lib/placeholders';

export const libraryDirectory = 'public/assets/placeholders';
/** The library images are precached for offline use, so their total size is capped. */
export const libraryBudgetBytes = 3.5 * 1024 * 1024;

export function readLibrary(): LibraryEntry[] {
  return JSON.parse(readFileSync('resources/content/photo-library.json', 'utf8')).entries;
}

/** Every library file, checked to exist and to fit the offline budget. Throws otherwise. */
export function libraryFiles(entries = readLibrary()) {
  const files = [...new Set(entries.flatMap((entry) => entry.files))];
  let total = 0;
  for (const file of files) {
    const path = `${libraryDirectory}/${file}`;
    try {
      total += statSync(path).size;
    } catch {
      throw new Error(`Photo library file is missing: ${path}`);
    }
  }
  if (total > libraryBudgetBytes)
    throw new Error(
      `Photo library is ${(total / 1048576).toFixed(2)} MB, over the ${libraryBudgetBytes / 1048576} MB offline budget.`,
    );
  return files;
}

const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
/** `public/assets/placeholders/CREDITS.md`, generated from the manifest by `npm run photos:credits`. */
export function creditsMarkdown(entries = readLibrary()) {
  const rows = entries.flatMap((entry) =>
    entry.files.map((file) => {
      const credit = entry.credits[file];
      const provenance = credit.ai
        ? `AI-generated for MadaTours (${credit.retrievedAt}). ${credit.caption}. Labelled “AI-generated image · not this place”. Prompt: ${credit.prompt ?? 'not recorded'}`
        : `${credit.author}, [${credit.title ?? credit.caption}](<${credit.sourceUrl}>), [${credit.license}](${credit.licenseUrl}). Retrieved ${credit.retrievedAt}; ${credit.modified ?? 'unmodified'}.`;
      return `| ${file} | ${cell(entry.key)} | ${cell(provenance)} |`;
    }),
  );
  return [
    '# Photo library',
    '',
    'Generated from `resources/content/photo-library.json` by `npm run photos:credits`. Do not edit by hand.',
    '',
    'These images illustrate an activity or a landscape. They never show the listed venue or another named place, and the app labels each one “Illustrative photo · not this place” (AI images: “AI-generated image · not this place”). Subjects without a file show an icon tile instead.',
    '',
    'Stock photos are used under the Unsplash License or the Pexels License, downloaded, re-encoded and served from this folder. Keep the credits when redistributing.',
    '',
    '| File | Subject | Provenance and licence |',
    '| ---- | ------- | ---------------------- |',
    ...rows,
    '',
  ].join('\n');
}

export const creditsPath = `${libraryDirectory}/CREDITS.md`;
/** The credits file exactly as committed: generated, then formatted like the rest of the repository. */
export async function formattedCredits(entries = readLibrary()) {
  const options = (await resolveConfig(creditsPath)) ?? {};
  return format(creditsMarkdown(entries), { ...options, filepath: creditsPath });
}
