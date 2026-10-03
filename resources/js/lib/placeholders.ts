import type { Place } from '../types';
import { normalizeSearch } from './places-utils';
// Ordered classification is intentionally separate from the marker palette.
// Add a category here without changing card, modal or map components.
export interface Placeholder {
  src: string;
  label: string;
  credit: string;
  source?: string;
  license?: string;
}
export const placeholders = {
  hiking: {
    src: '/assets/placeholders/hiking.jpg',
    label: 'Hiking · AI illustration',
    credit: 'MadaTours · AI-generated illustration',
  },
  seafood: {
    src: '/assets/placeholders/seafood.jpg',
    label: 'Seafood · AI illustration',
    credit: 'MadaTours · AI-generated illustration',
  },
  restaurant: {
    src: '/assets/placeholders/restaurant.jpg',
    label: 'Restaurant · AI illustration',
    credit: 'MadaTours · AI-generated illustration',
  },
  beach: {
    src: '/assets/placeholders/beach.jpg',
    label: 'Beach · illustrative photo',
    credit: 'Hervé NICOLAS · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Etang_des_Salines_(Martinique).jpg',
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  culture: {
    src: '/assets/placeholders/culture.jpg',
    label: 'Culture · illustrative photo',
    credit: 'Jeremy Gross · CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Habitation_Cl%C3%A9ment.jpg',
    license: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  nature: {
    src: '/assets/placeholders/nature.jpg',
    label: 'Nature · illustrative photo',
    credit: 'Box-Off-Dreams, Julie · Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Jardin_de_Balata.jpg',
  },
} satisfies Record<
  string,
  { src: string; label: string; credit: string; source?: string; license?: string }
>;
/** AI illustrations carry the same message in their label and credit, so the credit is only shown for real photos. */
export const creditLine = (item: Placeholder) =>
  item.credit.startsWith('MadaTours') ? undefined : item.credit;
export function placeholderFor(place: Place): Placeholder {
  const words = normalizeSearch([place.name, ...(place.tags || [])].join(' '));
  if (place.type === 'restaurant')
    return /seafood|fish|poisson|lobster|langouste|crab/.test(words)
      ? placeholders.seafood
      : placeholders.restaurant;
  if (/hiking|hike|trail|volcano|mountain|randonnee|pelee|piton/.test(words))
    return placeholders.hiking;
  if (/museum|culture|cultural|history|histor|heritage|musee|distill|eglise|habitation/.test(words))
    return placeholders.culture;
  if (/beach|plage|anse|snorkel|surf|swimming|salines/.test(words)) return placeholders.beach;
  return placeholders.nature;
}
