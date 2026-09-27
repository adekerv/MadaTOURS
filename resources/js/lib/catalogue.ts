import type { Place } from '../types';
import { normalizeSearch } from './places-utils';

// Retain neighbourhood labels on cards while grouping them under their commune.
export function catalogueTown(location: string) {
  if (normalizeSearch(location) === 'tartane') return 'La Trinité';
  return location.replaceAll("'", '’');
}

export const experiences = [
  { id: 'food', label: 'Food and drinks', tags: [] },
  { id: 'beaches', label: 'Beaches', tags: ['beach', 'beachfront'] },
  {
    id: 'nature',
    label: 'Hiking, gardens and nature',
    tags: [
      'hiking',
      'nature',
      'garden',
      'forest',
      'waterfall',
      'wetland',
      'mountain',
      'volcano',
      'natural site',
      'viewpoint',
      'nature reserve',
      'zoo',
    ],
  },
  {
    id: 'culture',
    label: 'Culture and heritage',
    tags: ['culture', 'heritage', 'history', 'museum', 'art', 'train', 'dance'],
  },
  {
    id: 'flavours',
    label: 'Rum, farms and local flavours',
    tags: [
      'rum tasting',
      'tasting',
      'farm visit',
      'chocolate',
      'vanilla',
      'cooking class',
      'ice cream',
    ],
  },
  {
    id: 'boats',
    label: 'Boat trips and sailing',
    tags: ['boat trip', 'sailing', 'marina', 'wildlife watching', 'fishing', 'yole'],
  },
  {
    id: 'water',
    label: 'Diving and water sports',
    tags: [
      'diving',
      'freediving',
      'water sports',
      'kayak',
      'paddle',
      'surf',
      'kitesurf',
      'jet ski',
      'jetboard',
      'underwater scooter',
      'wakeboarding',
      'swimming pool',
    ],
  },
  {
    id: 'adventure',
    label: 'Sports and adventure',
    tags: [
      'outdoor sports',
      'adventure park',
      'quad',
      'buggy',
      'flying',
      'canyoning',
      'cycling',
      'horse riding',
      'golf',
      'tennis',
      'paintball',
      'motor sports',
      'karting',
    ],
  },
  { id: 'guided', label: 'Guided tours', tags: ['guided tour'] },
  { id: 'wellness', label: 'Wellness and yoga', tags: ['wellness', 'spa', 'yoga'] },
  {
    id: 'entertainment',
    label: 'Entertainment and nightlife',
    tags: ['nightlife', 'bar', 'cinema', 'bowling', 'games', 'entertainment', 'laser tag'],
  },
] as const;

export function matchesExperience(place: Place, experience: string) {
  if (!experience) return true;
  if (experience === 'food') return place.type === 'restaurant';
  const group = experiences.find((item) => item.id === experience);
  return (
    !!group &&
    (place.tags ?? []).some((tag) =>
      (group.tags as readonly string[]).includes(normalizeSearch(tag)),
    )
  );
}
