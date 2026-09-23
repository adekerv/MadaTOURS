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
