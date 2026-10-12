import library from '../../content/photo-library.json';
import subjects from '../../content/photo-subjects.json';
import type { Place } from '../types';
import type { PhotoCredit } from './content';
import { normalizeSearch } from './places-utils';
import { pinPalette, type PinTone } from '../utils/emoji';

/**
 * Images for places without their own photograph. Each place resolves to one subject of the library
 * (`resources/content/photo-library.json`): a labelled illustrative photo when the subject is a `photo` with files,
 * otherwise an icon tile that needs no network request and no licence.
 */
export interface LibraryEntry {
  key: string;
  labelEn: string;
  labelFr: string;
  kind: 'photo' | 'tile';
  emoji: string;
  tone: PinTone;
  files: string[];
  /** One credit per file, with how its licence was checked. An AI image also records its prompt. */
  credits: Record<string, PhotoCredit & { prompt?: string; note?: string }>;
}
export interface Placeholder {
  key: string;
  label: { en: string; fr: string };
  emoji: string;
  color: string;
  /** Set only when an illustrative photo is shown; a tile has no file. */
  src?: string;
  credit?: PhotoCredit;
}
/** Checked by tests/placeholders.test.ts: labels, kinds, files and every credit. */
export const photoLibrary = library.entries as unknown as LibraryEntry[];
const byKey = new Map(photoLibrary.map((entry) => [entry.key, entry]));
const overrides = subjects as Record<string, string>;
export const placeholderPath = (file: string) => `/assets/placeholders/${file}`;

/** Exact catalogue tags, most specific first. Tags are compared after `normalizeSearch`. */
const activityTags: [string, string][] = [
  ['underwater scooter', 'snorkel'],
  ['freediving', 'diving'],
  ['diving', 'diving'],
  ['kitesurf', 'kitesurf'],
  ['surf', 'surf'],
  ['jet ski', 'jetski'],
  ['jetboard', 'foil'],
  ['wakeboarding', 'wakeboard'],
  ['paddle', 'paddle'],
  ['kayak', 'kayak'],
  ['yole', 'yole'],
  ['fishing', 'fishing'],
  ['wildlife watching', 'dolphins'],
  ['marina', 'marina'],
  ['sailing', 'sailboat'],
  ['swimming pool', 'pool'],
  ['yoga', 'yoga'],
  ['spa', 'spa'],
  ['cinema', 'cinema'],
  ['bowling', 'bowling'],
  ['laser tag', 'bowling'],
  ['karting', 'karting'],
  ['paintball', 'paintball'],
  ['tennis', 'tennis'],
  ['golf', 'golf'],
  ['horse riding', 'horse'],
  ['cycling', 'cycling'],
  ['canyoning', 'canyoning'],
  ['flying', 'flight'],
  ['quad', 'quad'],
  ['buggy', 'quad'],
  ['motor sports', 'quad'],
  ['adventure park', 'adventure-park'],
  ['rum tasting', 'rum'],
  ['chocolate', 'cacao'],
  ['vanilla', 'vanilla'],
  ['cooking class', 'cooking'],
  ['ice cream', 'ice-cream'],
  ['farm visit', 'orchard'],
  ['tasting', 'local-produce'],
  ['dance', 'bele'],
  ['art', 'art'],
  ['train', 'sugar-cane'],
  ['museum', 'heritage'],
  ['heritage', 'heritage'],
  ['history', 'heritage'],
  ['culture', 'heritage'],
  ['zoo', 'zoo'],
  ['waterfall', 'waterfall'],
  ['wetland', 'mangrove-forest'],
  ['forest', 'rainforest'],
  ['garden', 'garden'],
  ['viewpoint', 'coast-view'],
  ['natural site', 'coast-view'],
  ['volcano', 'hiking'],
  ['mountain', 'hiking'],
  ['nature reserve', 'hiking'],
  ['hiking', 'hiking'],
  ['beach', 'beach-white'],
  ['boat trip', 'boat-coast'],
  ['wellness', 'spa'],
  ['guided tour', 'island-road'],
  ['nightlife', 'cocktails'],
  ['bar', 'cocktails'],
  ['nature', 'rainforest'],
];
const restaurantTags: [string, string][] = [
  ['sushi', 'sushi'],
  ['japanese', 'sushi'],
  ['steakhouse', 'steak'],
  ['lebanese', 'mezze'],
  ['brazilian', 'brazilian'],
  ['bowls', 'bowl'],
  ['burgers', 'burger'],
  ['fast food', 'burger'],
  ['seafood', 'grilled-fish'],
  ['grill', 'grilled-fish'],
  ['fine dining', 'fine-dining'],
  ['beachfront', 'beach-restaurant'],
  ['beach', 'beach-restaurant'],
  ['bar', 'cocktails'],
  ['nightlife', 'cocktails'],
  ['cafe', 'cafe'],
  ['creole', 'creole-food'],
];
/** Last resort for an activity without a known subject or tag: whole words of its name. */
const nameWords: [RegExp, string][] = [
  [/\b(plongee|dive|diving|scuba)\b/, 'diving'],
  [/\b(catamaran|cata)\b/, 'catamaran'],
  [/\b(kite|kitesurf)\b/, 'kitesurf'],
  [/\bsurf\b/, 'surf'],
  [/\bkayaks?\b/, 'kayak'],
  [/\bpaddle\b/, 'paddle'],
  [/\b(spa|massages?)\b/, 'spa'],
  [/\byoga\b/, 'yoga'],
  [/\b(distillerie|distillery|rhums?|rum)\b/, 'rum'],
  [/\b(musee|museum|memorial|fort|eglise)\b/, 'heritage'],
  [/\b(jardin|jardins|garden|gardens)\b/, 'garden'],
  [/\bcascade\b/, 'waterfall'],
  [/\b(plage|beach|anse)\b/, 'beach-white'],
];
function subjectFor(place: Place): string {
  const override = overrides[String(place.id)];
  if (override && byKey.has(override)) return override;
  if (place.access === 'restricted') return 'restricted';
  const tags = new Set((place.tags ?? []).map(normalizeSearch));
  const table = place.type === 'restaurant' ? restaurantTags : activityTags;
  const tagged = table.find(([tag]) => tags.has(tag));
  if (tagged) return tagged[1];
  if (place.type === 'restaurant') return 'restaurant';
  const name = normalizeSearch(place.name);
  return nameWords.find(([words]) => words.test(name))?.[1] ?? 'activity';
}
export function placeholderFor(place: Place): Placeholder {
  const entry = byKey.get(subjectFor(place))!;
  const shown = {
    key: entry.key,
    label: { en: entry.labelEn, fr: entry.labelFr },
    emoji: entry.emoji,
    color: pinPalette[entry.tone],
  };
  if (entry.kind !== 'photo' || !entry.files.length) return shown;
  // Neighbouring cards of one subject differ, and a place always gets the same variant.
  const file = entry.files[place.id % entry.files.length];
  return { ...shown, src: placeholderPath(file), credit: entry.credits[file] };
}
