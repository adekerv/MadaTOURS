import { z } from 'zod';
const https = z.url().refine((value) => value.startsWith('https://'));
export const sourceSchema = z.object({
  url: https,
  title: z.string().max(200),
  checkedAt: z.iso.date(),
  fields: z.array(z.string().max(100)).max(20),
});
export const photoCreditSchema = z.object({
  author: z.string().max(200),
  license: z.string().max(100),
  sourceUrl: https,
  licenseUrl: https,
  caption: z.string().max(300),
});

const text = (max: number) => z.string().trim().min(1).max(max);
const onHost = (hosts: string[]) =>
  https.refine((value) => {
    const host = new URL(value).hostname.replace(/^www\./, '');
    return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  });
const sourceRefSchema = z.object({ url: https, checkedAt: z.iso.date() });
/** Fields keyed by what a cited source actually says. A field absent here is simply not shown. */
export const placeDetailFields = {
  address: text(240),
  phone: z.string().regex(/^\+?[0-9][0-9 ().-]{6,22}[0-9]$/),
  website: https,
  facebook: onHost(['facebook.com', 'fb.com']),
  instagram: onHost(['instagram.com']),
  hoursText: text(400),
  priceRange: text(80),
  kind: z.array(text(60)).min(1).max(6),
  payment: z.array(text(60)).min(1).max(8),
  languages: z.array(text(40)).min(1).max(8),
  services: z.array(text(60)).min(1).max(10),
  reservations: text(200),
  accessibility: text(240),
  parking: text(200),
} as const;
export type PlaceDetails = {
  -readonly [K in keyof typeof placeDetailFields]?: z.infer<(typeof placeDetailFields)[K]>;
} & { from?: Record<string, z.infer<typeof sourceRefSchema>> };
/** Keeps every valid field and drops the rest, so one bad value never hides the others. */
export function parseDetails(value: unknown): PlaceDetails | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const details: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(placeDetailFields)) {
    const parsed = schema.safeParse(input[key]);
    if (parsed.success) details[key] = parsed.data;
  }
  if (!Object.keys(details).length) return undefined;
  if (input.from && typeof input.from === 'object') {
    const from: Record<string, z.infer<typeof sourceRefSchema>> = {};
    for (const [key, ref] of Object.entries(input.from)) {
      const parsed = sourceRefSchema.safeParse(ref);
      if (key in details && parsed.success) from[key] = parsed.data;
    }
    if (Object.keys(from).length) details.from = from;
  }
  return details as PlaceDetails;
}
export const listingStatusSchema = z.enum(['active', 'needs_review', 'closed']);
