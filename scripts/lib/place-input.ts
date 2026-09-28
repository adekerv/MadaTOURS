import { z } from 'zod';

export const placeInput = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(['restaurant', 'activity']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  location: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(3000),
  description_fr: z.string().trim().max(3000).optional(),
  rating: z.number().min(0).max(5).optional(),
  hours: z.string().trim().max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  image: z
    .url()
    .refine((value) => value.startsWith('https://'), 'Use an HTTPS image URL.')
    .max(2000)
    .optional(),
});
