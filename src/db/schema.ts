import { relations } from 'drizzle-orm';
import { doublePrecision, integer, json, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: varchar('uid', { length: 255 }).unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password'),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const places = pgTable('places', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  description: text('description').notNull(),
  rating: doublePrecision('rating').default(4.5),
  hours: varchar('hours', { length: 255 }),
  tags: json('tags').$type<string[]>(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userFavorites = pgTable('user_favorites', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  placeId: integer('place_id')
    .references(() => places.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userRevisits = pgTable('user_revisits', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  placeId: integer('place_id')
    .references(() => places.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  favorites: many(userFavorites),
  revisits: many(userRevisits),
}));

export const placesRelations = relations(places, ({ many }) => ({
  favoritedBy: many(userFavorites),
  revisitedBy: many(userRevisits),
}));

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(users, {
    fields: [userFavorites.userId],
    references: [users.id],
  }),
  place: one(places, {
    fields: [userFavorites.placeId],
    references: [places.id],
  }),
}));

export const userRevisitsRelations = relations(userRevisits, ({ one }) => ({
  user: one(users, {
    fields: [userRevisits.userId],
    references: [users.id],
  }),
  place: one(places, {
    fields: [userRevisits.placeId],
    references: [places.id],
  }),
}));
