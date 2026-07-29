import { db } from './index.ts';
import { places, users } from './schema.ts';
import defaultPlaces from '../data/places.json';
import { eq } from 'drizzle-orm';

export async function seedDatabase() {
  try {
    // 1. Seed default users
    const existingAdmin = await db.select().from(users).where(eq(users.email, 'admin@madatours.com'));
    if (existingAdmin.length === 0) {
      await db.insert(users).values({
        email: 'admin@madatours.com',
        password: 'admin',
        role: 'admin',
      });
    }

    const existingUser = await db.select().from(users).where(eq(users.email, 'user@madatours.com'));
    if (existingUser.length === 0) {
      await db.insert(users).values({
        email: 'user@madatours.com',
        password: 'user',
        role: 'user',
      });
    }

    // 2. Seed default places if empty
    const existingPlaces = await db.select().from(places);
    if (existingPlaces.length === 0) {
      console.log('🌱 Seeding default places into PostgreSQL (Supabase)...');
      for (const p of defaultPlaces) {
        await db.insert(places).values({
          id: p.id,
          name: p.name,
          type: p.type,
          lat: p.lat,
          lng: p.lng,
          location: p.location,
          description: p.description,
          rating: p.rating,
          hours: p.hours,
          tags: p.tags,
          image: p.image,
        });
      }
      console.log('✅ Default places seeded successfully into PostgreSQL!');
    }
  } catch (err) {
    console.error('Error seeding PostgreSQL database:', err);
  }
}
