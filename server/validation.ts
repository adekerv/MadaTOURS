import { z } from 'zod';

export const credentials = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: z.string().min(1, 'Enter your password.').max(128, 'Use at most 128 characters.'),
});
export const registration = credentials.extend({
  password: z.string().min(12, 'Use a password with at least 12 characters.').max(128),
});
export const placeInput = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(['restaurant', 'activity']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  location: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(3000),
  rating: z.number().min(0).max(5).optional(),
  hours: z.string().trim().max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  image: z
    .url()
    .refine((value) => value.startsWith('https://'), 'Use an HTTPS image URL.')
    .max(2000)
    .optional(),
});
const numeric = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .min(1)
      .regex(/^[+-]?\d+(\.\d+)?$/),
  ])
  .pipe(z.coerce.number());
export const positiveId = numeric.pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
export const nearbyQuery = z.object({
  lat: numeric.pipe(z.number().min(-90).max(90)),
  lng: numeric.pipe(z.number().min(-180).max(180)),
  radius: numeric.pipe(z.number().min(1).max(100)).default(50),
});
