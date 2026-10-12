import { readFile, writeFile } from 'node:fs/promises';
import { loadPlaces } from './lib/place-sources';
import { api, details, metres, rejection, type Info } from './lib/commons';
import { parseCsv } from './lib/csv';
/**
 * Finds Wikimedia Commons photo candidates for the landmark places of a photo audit. It reads only: the result is a
 * CSV and a contact sheet for a person to pick from, never a change to the catalogue.
 *   npm run photos:find                                   every landmark in the audit CSV
 *   npm run photos:find -- --ids=135,136                  only these places
 * For each place it looks for files within 500 m (1.5 km if none), files named after the place, and the Wikidata image
 * (P18) of a matching item. It keeps CC0, CC BY, CC BY-SA and public-domain files, including US federal works, and
 * drops files that are public domain in the US only because a copyright expired, GFDL-only files, files with
 * personality or trademark restrictions, and files tagged as lacking freedom of panorama in France.
 */
const auditPath = 'reports/photo-audit-2026-10-12/madatours-photo-audit.csv';
const outCsv = 'reports/photo-audit-2026-10-12/commons-candidates.csv';
const outSheet = 'reports/photo-audit-2026-10-12/candidates/commons-sheet.html';
/** Places that never get a Commons photo here: a restricted site, an artwork needing the artist's permission. */
const skipped: Record<number, string> = {
  2: 'Keeps its own Commons photo.',
  3: 'Keeps its own Commons photo.',
  7: 'Access prohibited: keeps its warning tile.',
  159: 'Its photo is being set separately.',
  101: "A 2013 artwork: France has no commercial freedom of panorama, so this needs the artist's permission.",
};
const args = process.argv.slice(2);
if (args.some((arg) => !/^--ids=[\d,]+$/.test(arg)))
  throw new Error('Unknown argument. Use --ids=1,2,3 or nothing.');
const only = new Set((args[0]?.slice(6) ?? '').split(',').filter(Boolean).map(Number));

type Candidate = {
  title: string;
  found: Set<string>;
  distance?: number;
};
async function candidatesFor(place: { name: string; location: string; lat: number; lng: number }) {
  const found = new Map<string, Candidate>();
  const add = (title: string, how: string, distance?: number) => {
    const entry = found.get(title) ?? { title, found: new Set<string>() };
    entry.found.add(how);
    if (distance !== undefined) entry.distance = Math.min(entry.distance ?? Infinity, distance);
    found.set(title, entry);
  };
  // Map points are approximate, so widen to 1.5 km when nothing is within 500 m.
  for (const radius of [500, 1500]) {
    const near = await api('commons.wikimedia.org', {
      action: 'query',
      list: 'geosearch',
      gscoord: `${place.lat}|${place.lng}`,
      gsradius: radius,
      gsnamespace: 6,
      gslimit: 40,
    });
    const hits = ((near.query as { geosearch?: { title: string; dist: number }[] })?.geosearch ??
      []) as { title: string; dist: number }[];
    for (const hit of hits) add(hit.title, radius === 500 ? 'nearby' : 'within 1.5 km', hit.dist);
    if (hits.length) break;
  }
  // A busy search engine costs only the name results; the nearby files still stand.
  try {
    // The exact name first; if that finds nothing, its distinctive words plus the town.
    const stop = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'a', 'au', 'aux', 'l', 'd']);
    const words = `${place.name} ${place.location}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^A-Za-z0-9]+/)
      .filter((word) => word && !stop.has(word.toLowerCase()));
    for (const query of [`"${place.name}" Martinique`, [...new Set(words)].join(' ')]) {
      const named = await api('commons.wikimedia.org', {
        action: 'query',
        list: 'search',
        srsearch: `${query} filetype:bitmap`,
        srnamespace: 6,
        srlimit: 15,
      });
      const hits = ((named.query as { search?: { title: string }[] })?.search ?? []) as {
        title: string;
      }[];
      for (const hit of hits) add(hit.title, 'name');
      if (hits.length) break;
    }
  } catch (error) {
    console.log(
      `  Name search skipped for ${place.name}: ${error instanceof Error ? error.message : error}`,
    );
  }
  // Wikidata is a bonus source: if it is unavailable, the Commons results still stand.
  try {
    const items = await api('www.wikidata.org', {
      action: 'wbsearchentities',
      search: place.name,
      language: 'fr',
      limit: 5,
    });
    const ids = ((items.search ?? []) as { id: string }[]).map((item) => item.id);
    if (ids.length) {
      const entities = await api('www.wikidata.org', {
        action: 'wbgetentities',
        ids: ids.join('|'),
        props: 'claims',
      });
      for (const entity of Object.values(
        (entities.entities ?? {}) as Record<string, { claims?: Record<string, unknown[]> }>,
      )) {
        const where = (
          entity.claims?.P625?.[0] as
            | { mainsnak?: { datavalue?: { value?: { latitude: number; longitude: number } } } }
            | undefined
        )?.mainsnak?.datavalue?.value;
        // Only an item placed within 2 km is the same place; a homonym elsewhere is ignored.
        if (!where || metres(place.lat, place.lng, where.latitude, where.longitude) > 2000)
          continue;
        for (const claim of (entity.claims?.P18 ?? []) as {
          mainsnak?: { datavalue?: { value?: string } };
        }[]) {
          const file = claim.mainsnak?.datavalue?.value;
          if (file) add(`File:${file}`, 'wikidata');
        }
      }
    }
  } catch (error) {
    console.log(
      `  Wikidata skipped for ${place.name}: ${error instanceof Error ? error.message : error}`,
    );
  }
  return [...found.values()];
}

const audit = parseCsv(await readFile(auditPath, 'utf8')).filter(
  (row) => row.landmark === 'True' && (!only.size || only.has(Number(row.id))),
);
const { places } = await loadPlaces({ seed: true });
const out: Record<string, string | number>[] = [];
const sheet: string[] = [];
const escape = (text: string | number) =>
  String(text).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
for (const row of audit) {
  const id = Number(row.id);
  const place = places.find((item) => item.id === id);
  if (!place) continue;
  if (skipped[id]) {
    sheet.push(
      `<section><h2>${id}. ${escape(place.name)}</h2><p class="note">${escape(skipped[id])}</p></section>`,
    );
    continue;
  }
  const found = await candidatesFor(place);
  const info = await details(found.map((candidate) => candidate.title));
  const usable = found
    .map((candidate) => ({ candidate, info: info.get(candidate.title) }))
    .filter(
      (item): item is { candidate: Candidate; info: Info } => !!item.info && !rejection(item.info),
    )
    .map(({ candidate, info: file }) => {
      const distance =
        candidate.distance ??
        (file.lat && file.lng ? metres(place.lat, place.lng, file.lat, file.lng) : undefined);
      // Named and Wikidata hits first, then the nearest; landscape files ahead of portrait ones.
      const score =
        (candidate.found.has('wikidata') ? 0 : 400) +
        (candidate.found.has('name') ? 0 : 200) +
        Math.min(distance ?? 600, 600) +
        (file.width >= file.height ? 0 : 150);
      return { candidate, file, distance, score };
    })
    // A name match photographed far away is a homonym, such as a church in mainland France.
    .filter(({ distance }) => distance === undefined || distance <= 20000)
    .sort((a, b) => a.score - b.score)
    .slice(0, 8);
  const rejected =
    found.length - found.filter((c) => info.get(c.title) && !rejection(info.get(c.title)!)).length;
  console.log(
    `#${id} ${place.name}: ${usable.length} usable of ${found.length} (${rejected} ruled out)`,
  );
  usable.forEach(({ candidate, file, distance }, rank) =>
    out.push({
      place_id: id,
      name: place.name,
      subject: row.library,
      pick: `${id}:${rank + 1}`,
      file: file.title,
      found_by: [...candidate.found].join('+'),
      distance_m: distance === undefined ? '' : Math.round(distance),
      width: file.width,
      height: file.height,
      license: file.licence,
      license_url: file.licenceUrl,
      author: file.author,
      attribution: file.attribution,
      description: file.description,
      source_url: file.url,
    }),
  );
  const note =
    row.library === 'beach-dark'
      ? '<p class="note">Black-sand beach: pick a photo that shows dark sand.</p>'
      : '';
  const cards = usable
    .map(
      (
        { candidate, file, distance },
        rank,
      ) => `<figure><a href="${escape(file.url)}" target="_blank" rel="noreferrer"><img loading="lazy" src="${escape(file.thumb)}" alt=""></a>
<figcaption><b class="id">${id}:${rank + 1}</b> ${escape(file.licence)} · ${escape(file.author || '?')}<br><span class="meta">${escape([...candidate.found].join(' + '))}${distance === undefined ? '' : ` · ${Math.round(distance)} m`} · ${file.width}×${file.height}</span><br><span class="meta">${escape(file.description)}</span></figcaption></figure>`,
    )
    .join('');
  sheet.push(
    `<section><h2>${id}. ${escape(place.name)} <small>${escape(row.library)} · ${escape(place.location)}</small></h2>${note}<div class="grid">${cards || '<p class="note">No usable Commons file found. The place keeps its stand-in.</p>'}</div></section>`,
  );
}
const columns = Object.keys(out[0] ?? { place_id: '' });
const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
await writeFile(
  outCsv,
  `${[columns.join(','), ...out.map((row) => columns.map((column) => cell(row[column])).join(','))].join('\n')}\n`,
);
await writeFile(
  outSheet,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Landmark photos</title>
<style>:root{--bg:#fdfcfb;--card:#fff;--text:#0f172a;--muted:#475569;--line:#e2e8f0}@media (prefers-color-scheme:dark){:root{--bg:#191714;--card:#24211e;--text:#f5eee7;--muted:#c8bcb1;--line:#4b4138}}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:16px}h2{border-top:1px solid var(--line);padding-top:.8em;margin-top:1.6em}h2 small{font-weight:400;color:var(--muted);font-size:.7em}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
img{width:100%;aspect-ratio:3/2;object-fit:cover;display:block;background:#000}figcaption{padding:8px 10px;font-size:14px}.meta,.note{color:var(--muted);font-size:13px}.id{font-family:ui-monospace,monospace}a{color:inherit}</style></head>
<body><main><h1>Landmark photos from Wikimedia Commons</h1><p>Licence-checked candidates for each landmark (CC0, CC BY, CC BY-SA, public domain incl. US federal works; no restriction or no-freedom-of-panorama templates). Images load from Commons for review only. Reply with one id per place, for example <code>135:2</code>, or "none".</p>
${sheet.join('\n')}</main></body></html>`,
);
console.log(
  `${out.length} candidates for ${audit.length} landmarks. Wrote ${outCsv} and ${outSheet}. Nothing was changed.`,
);
