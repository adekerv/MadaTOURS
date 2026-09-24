import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { placeInput } from '../../server/validation';
import { sourceSchema } from '../../src/lib/content';
import { normalizeSearch } from '../../src/lib/places-utils';

const point = z.object({
  lat: z.number().min(14.38).max(14.9),
  lng: z.number().min(-61.25).max(-60.79),
  sources: sourceSchema.array().min(1),
});
export const batchSchema = z.object({
  batch: z.string().regex(/^[a-z0-9-]+$/),
  checkedAt: z.iso.date(),
  additions: z
    .array(
      placeInput
        .extend({
          ...point.shape,
          description_fr: z.string().min(1).max(3000),
          published: z.literal(true),
          access: z.literal('unknown'),
        })
        .strict(),
    )
    .max(900),
  updates: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string(),
      before: point,
      after: point,
    }),
  ),
});
export type CatalogueBatch = z.infer<typeof batchSchema>;
export type CatalogueRow = Record<string, unknown> & {
  id: number;
  name: string;
  sources: z.infer<typeof sourceSchema>[];
};
export type Receipt = Record<string, number>;
const nameKey = (name: string) => normalizeSearch(name).replace(/[^a-z0-9]/g, '');

export function planImport(batch: CatalogueBatch, rows: CatalogueRow[], receipt: Receipt) {
  const seen = new Set<string>();
  const additions = batch.additions.filter((place) => {
    const url = place.sources[0].url;
    if (seen.has(url)) throw new Error(`Duplicate batch source: ${place.name}`);
    seen.add(url);
    // A completed import must not resurrect a deliberately deleted or edited listing.
    if (receipt[url]) return false;
    const matches = rows.filter((row) => row.sources.some((source) => source.url === url));
    if (matches.length > 1) throw new Error(`Ambiguous existing source: ${place.name}`);
    if (matches.length) return false;
    if (rows.some((row) => nameKey(row.name) === nameKey(place.name)))
      throw new Error(`Existing name needs manual review: ${place.name}`);
    return true;
  });
  const updates = batch.updates.filter((update) => {
    const current = rows.find((row) => row.id === update.id);
    if (!current) return false;
    const values = { lat: current.lat, lng: current.lng, sources: current.sources };
    if (isDeepStrictEqual(values, update.after)) return false;
    if (current.name !== update.name || !isDeepStrictEqual(values, update.before))
      throw new Error(`Existing listing changed; review before import: ${update.name}`);
    return true;
  });
  return { additions, updates };
}
