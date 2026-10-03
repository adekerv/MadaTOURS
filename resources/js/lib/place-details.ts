import type { Place } from '../types';
import type { PlaceDetails } from './content';
type Language = 'en' | 'fr';
export interface PlaceFacts extends PlaceDetails {
  /** The description with listed street and contact sentences moved into their own facts. */
  about: string;
}
// Older descriptions end with "Listed street: … Contact: …". Both are shown as facts instead.
const street = /\s*(?:Listed street|Voie indiquée)\s*:\s*(.+?)\.(?=\s*Contact\s*:|\s*$)/;
const contact = /\s*Contact\s*:\s*(\+?\d[\d\s().-]{6,}\d)\.?/;
export function placeFacts(place: Place, language: Language): PlaceFacts {
  const raw = (language === 'fr' && place.descriptionFr) || place.description;
  const details: PlaceDetails = { ...place.details };
  let about = raw;
  const legacyStreet = street.exec(about)?.[1]?.trim();
  if (legacyStreet) about = about.replace(street, '');
  const legacyPhone = contact.exec(about)?.[1]?.trim();
  if (legacyPhone) about = about.replace(contact, '');
  if (!details.address && legacyStreet) details.address = `${legacyStreet}, ${place.location}`;
  if (!details.phone && legacyPhone) details.phone = legacyPhone;
  if (!details.hoursText && place.hours) details.hoursText = place.hours;
  return { ...details, about: about.replace(/\s{2,}/g, ' ').trim() || raw };
}
/** A tel: link target: digits and a leading plus only. */
export const telHref = (phone: string) => `tel:${phone.replace(/(?!^\+)[^\d]/g, '')}`;
export const hasHours = (place: Place, facts: PlaceFacts) =>
  Boolean(place.openingPeriods?.length || facts.hoursText);
export const whatsMissing = (facts: PlaceFacts) =>
  ['address', 'phone', 'website'].filter((key) => !facts[key as keyof PlaceFacts]);
