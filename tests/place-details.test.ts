import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeFacts, telHref, hasHours } from '../resources/js/lib/place-details';
import { parseDetails } from '../resources/js/lib/content';
import { normalizePlace } from '../resources/js/lib/places-utils';
const base = {
  id: 1,
  name: 'Spice & Sugar',
  type: 'restaurant',
  lat: 14.6,
  lng: -61,
  location: 'Fort-de-France',
  description:
    'A restaurant and food bar. Listed street: 5 Lotissement Hardy Dessources. Contact: +596 596 73 25 05.',
  description_fr:
    'Un restaurant et food bar. Voie indiquée : 5 Lotissement Hardy Dessources. Contact : +596 596 73 25 05.',
};
test('legacy street and phone sentences become facts in both languages', () => {
  const place = normalizePlace(base);
  for (const language of ['en', 'fr'] as const) {
    const facts = placeFacts(place, language);
    assert.equal(facts.address, '5 Lotissement Hardy Dessources, Fort-de-France');
    assert.equal(facts.phone, '+596 596 73 25 05');
    assert.equal(
      facts.about,
      language === 'en' ? 'A restaurant and food bar.' : 'Un restaurant et food bar.',
    );
  }
  assert.equal(telHref('+596 596 73 25 05'), 'tel:+596596732505');
  assert.equal(hasHours(place, placeFacts(place, 'en')), false);
});
test('source details win over legacy text and invalid fields are dropped individually', () => {
  const place = normalizePlace({
    ...base,
    details: {
      address: 'Centre d’affaires Valmenière, 97200 Fort-de-France',
      phone: 'call me',
      website: 'http://insecure.test',
      facebook: 'https://evil.example/facebook.com',
      instagram: 'https://www.instagram.com/spice',
      kind: ['Caribbean'],
      hoursText: 'Lundi au samedi : 11h30 – 15h30',
      from: {
        address: { url: 'https://example.test/a', checkedAt: '2026-10-02' },
        phone: { url: 'https://example.test/p', checkedAt: '2026-10-02' },
      },
    },
  });
  const facts = placeFacts(place, 'en');
  assert.equal(facts.address, 'Centre d’affaires Valmenière, 97200 Fort-de-France');
  assert.equal(facts.phone, '+596 596 73 25 05', 'invalid phone falls back to the legacy value');
  assert.equal(place.details?.website, undefined);
  assert.equal(place.details?.facebook, undefined);
  assert.equal(place.details?.instagram, 'https://www.instagram.com/spice');
  assert.deepEqual(Object.keys(place.details!.from!), ['address']);
  assert.equal(hasHours(place, facts), true);
  assert.equal(parseDetails({}), undefined);
  assert.equal(parseDetails([]), undefined);
});
test('only needs_review is exposed as a listing note', () => {
  assert.equal(
    normalizePlace({ ...base, listingStatus: 'needs_review' }).listingStatus,
    'needs_review',
  );
  assert.equal(normalizePlace({ ...base, listing_status: 'closed' }).listingStatus, undefined);
});
