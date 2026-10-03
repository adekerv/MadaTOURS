import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  canonicalPayment,
  closureSignals,
  extract,
  joinStreet,
  normalizePhone,
  periodsFromSpec,
  tidyCase,
  validityEnd,
} from '../scripts/lib/source-extract';
import { parseRobots, robotsAllows } from '../scripts/lib/source-fetch';
import {
  meaningfulRedirect,
  nameMatch,
  type PlaceAnalysis,
  type SourceResult,
} from '../scripts/lib/place-analysis';
import { applyOverrides, judge, type AuditRow } from '../scripts/audit-places';
const fixture = (name: string) => readFileSync(`tests/fixtures/sources/${name}`, 'utf8');
const today = '2026-10-02';
test('a Terres du Centre record yields its own facts and ignores the site footer', () => {
  const facts = extract(fixture('terres-spice-sugar.html'), {
    url: 'https://terresducentremartinique.fr/restaurant/spice-sugar-2/',
    today,
  });
  assert.equal(facts.template, 'terres-du-centre');
  assert.equal(facts.heading, 'Spice & Sugar');
  assert.equal(
    facts.address,
    "Centre d'affaires Valmenière, Pont de Châteauboeuf, 97200 Fort de France",
  );
  assert.equal(facts.town, 'Fort de France');
  assert.equal(facts.phone, '+596 596 73 25 05');
  assert.deepEqual(facts.payment, ['Espèces', 'Cartes bancaires']);
  assert.equal(facts.hoursText, 'Lundi au Samedi : 11h30 – 15h30\nVendredi : 19h – 22h');
  assert.ok(facts.notes.includes('placeholder-email-ignored'));
  assert.ok(
    facts.notes.includes('hours-text-unparsed'),
    'free-text hours are kept, never guessed into a schedule',
  );
  assert.equal(facts.openingPeriods, undefined);
  // The footer lists the tourist offices' own addresses and hours.
  assert.doesNotMatch(JSON.stringify(facts), /Victor Hugo|Schoelcher|8h-16h30/);
  assert.equal(facts.modified, '2023-08-22');
  assert.equal(facts.facebook, undefined, 'share buttons are not the venue page');
});
test('a martinique.org record gives structured hours, contact and lists, and drops an expired price', () => {
  const facts = extract(fixture('martinique-petibonum.html'), {
    url: 'https://www.martinique.org/fr/bars-restaurants/restaurants/restaurant-le-petibonum',
    today,
  });
  assert.equal(facts.template, 'martinique.org');
  assert.equal(facts.address, 'Quartier le Coin, 97221 Le Carbet');
  assert.equal(facts.phone, '+596 596 78 04 34');
  assert.equal(facts.website, 'https://www.lepetibonum.com/');
  assert.equal(facts.openingPeriods?.length, 7);
  assert.deepEqual(facts.openingPeriods?.[0], { day: 0, opens: 600, closes: 1380 });
  assert.deepEqual(facts.languages, ['Allemand', 'Anglais', 'Espagnol', 'Français']);
  assert.deepEqual(facts.payment, ['Cartes bancaires', 'Espèces', 'Virement bancaire']);
  assert.deepEqual(facts.services, ['Point wifi']);
  assert.equal(facts.priceRange, undefined, 'a price list that ended in 2024 is not current');
  assert.ok(facts.notes.includes('price-expired:2024-12-31'));
  assert.deepEqual(facts.geo, { lat: 14.7015273, lng: -61.181476 });
  // The same page read earlier in the year still shows its price.
  const earlier = extract(fixture('martinique-petibonum.html'), {
    url: 'https://www.martinique.org/fr/bars-restaurants/restaurants/restaurant-le-petibonum',
    today: '2024-06-01',
  });
  assert.equal(earlier.priceRange, '16 €');
});
test('a directory page that is not a venue record never lends its contact details to a venue', () => {
  const html = `<html><head><title>Montagne Pelée | Martinique Tourisme</title>
    <script type="application/ld+json">{"@type":"Organization","name":"Martinique Tourisme","telephone":"0596000000","sameAs":["https://www.facebook.com/LaMartiniqueTourisme"]}</script></head>
    <body><main><h1>La Montagne Pelée</h1><p>Un volcan.</p></main>
    <footer><a href="tel:0596111111">Appeler</a><a href="https://instagram.com/lamartinique">ig</a></footer></body></html>`;
  const facts = extract(html, {
    url: 'https://www.martinique.org/fr/que-faire/incontournables/montagne-pelee',
    today,
  });
  assert.equal(facts.phone, undefined);
  assert.equal(facts.facebook, undefined);
  assert.equal(facts.instagram, undefined);
  assert.equal(facts.heading, 'La Montagne Pelée');
  const own = extract(html.replace('Organization', 'Restaurant'), {
    url: 'https://le-restaurant.example/',
    today,
  });
  assert.equal(own.instagram, 'https://instagram.com/lamartinique');
  assert.equal(own.phone, '+596 596 00 00 00', 'the venue structured data wins over a footer link');
});
test('phone numbers, payments and validity dates are normalised without inventing anything', () => {
  assert.equal(normalizePhone('0596 78 04 34'), '+596 596 78 04 34');
  assert.equal(normalizePhone('+596 596 794 710'), '+596 596 79 47 10');
  assert.equal(normalizePhone('00596696525210'), '+596 696 52 52 10');
  assert.equal(normalizePhone('+33 6 12 34 56 78'), '+33612345678');
  assert.equal(normalizePhone('tel'), undefined);
  assert.equal(normalizePhone('12345'), undefined);
  assert.equal(canonicalPayment('Cartes Bancaire'), 'Cartes bancaires');
  assert.equal(canonicalPayment('ESPÈCES'), 'Espèces');
  assert.equal(canonicalPayment('Bitcoin'), 'Bitcoin');
  assert.equal(validityEnd('Du 1 janvier 2024 au 31 décembre 2024'), '2024-12-31');
  assert.equal(validityEnd('Du 1er mars au 1er août 2026'), '2026-08-01');
  assert.equal(validityEnd('Toute l’année'), undefined);
});
test('opening hours are read only when unambiguous', () => {
  assert.deepEqual(
    periodsFromSpec([
      { dayOfWeek: ['Monday', 'https://schema.org/Tuesday'], opens: '09:00', closes: '17:30' },
    ]),
    [
      { day: 1, opens: 540, closes: 1050 },
      { day: 2, opens: 540, closes: 1050 },
    ],
  );
  assert.deepEqual(periodsFromSpec({ dayOfWeek: 'Friday', opens: '18:00', closes: '00:00' }), [
    { day: 5, opens: 1080, closes: 1440 },
  ]);
  assert.equal(
    periodsFromSpec({ dayOfWeek: 'Friday', opens: '20:00', closes: '02:00' }),
    undefined,
    'overnight hours are not guessed',
  );
  assert.equal(
    periodsFromSpec({ dayOfWeek: 'Someday', opens: '09:00', closes: '10:00' }),
    undefined,
  );
  assert.equal(periodsFromSpec(undefined), undefined);
});
test('only clear closure wording is strong; ordinary opening hours are not closure', () => {
  const strong = closureSignals('Le restaurant a définitivement fermé ses portes en 2024.');
  assert.ok(strong.some((signal) => signal.strength === 'strong'));
  assert.ok(closureSignals('PERMANENTLY CLOSED').some((s) => s.strength === 'strong'));
  assert.ok(
    closureSignals('Fermeture annuelle du 1er au 15 septembre.').every(
      (s) => s.strength === 'weak',
    ),
  );
  assert.ok(
    closureSignals('Site en rénovation, réouverture prévue.').some((s) => s.strength === 'weak'),
  );
  assert.deepEqual(
    closureSignals('Fermé le lundi. Ouvert du mardi au dimanche, de 10h à 23h.'),
    [],
  );
});
test('robots.txt rules follow the standard, with the longest match winning', () => {
  const { rules, delayMs } = parseRobots(`User-agent: *
Disallow: /private/
Allow: /private/open/
Disallow: /*?lat=
Disallow: /exact$
Crawl-delay: 3`);
  assert.equal(delayMs, 3000);
  assert.equal(robotsAllows(rules, '/restaurant/spice'), true);
  assert.equal(robotsAllows(rules, '/private/x'), false);
  assert.equal(robotsAllows(rules, '/private/open/x'), true);
  assert.equal(robotsAllows(rules, '/map?lat=14'), false);
  assert.equal(robotsAllows(rules, '/exact'), false);
  assert.equal(robotsAllows(rules, '/exact/more'), true);
  const specific = parseRobots(
    'User-agent: MadaToursSourceCheck\nDisallow: /\n\nUser-agent: *\nDisallow:',
  );
  assert.equal(
    robotsAllows(specific.rules, '/anything'),
    false,
    'a group naming this bot takes precedence',
  );
});
test('name matching tolerates accents and filler words, and redirects ignore cosmetic changes', () => {
  assert.equal(nameMatch('Musee Du Pere Pinchon', 'Musée du Père Pinchon | Martinique'), 1);
  assert.ok(nameMatch('Habitation Clément', 'Restaurant Chez Marie') < 0.5);
  assert.equal(nameMatch('Le Petibonum', 'Restaurant Le Petibonum'), 1);
  assert.equal(meaningfulRedirect('http://example.fr/a/', 'https://www.example.fr/a'), false);
  assert.equal(meaningfulRedirect('https://example.fr/a', 'https://example.fr/'), true);
  assert.equal(meaningfulRedirect('https://example.fr/a', 'https://other.example/a'), true);
});
const result = (
  overrides: Partial<SourceResult> & {
    signals?: ReturnType<typeof closureSignals>;
    modified?: string;
  },
): SourceResult => ({
  url: 'https://www.martinique.org/fr/x',
  title: 'Source',
  declaredFields: ['Name'],
  previouslyCheckedAt: '2026-09-24',
  fetch: 'ok',
  redirected: false,
  nameMatch: 1,
  mentionsName: true,
  extracted: {
    template: 'martinique.org',
    unmapped: [],
    notes: [],
    closureSignals: overrides.signals ?? [],
    modified: overrides.modified,
  },
  ...overrides,
});
const place = (
  sources: SourceResult[],
  conflicts: PlaceAnalysis['conflicts'] = [],
): PlaceAnalysis => ({
  id: 1,
  name: 'Chez Test',
  town: 'Fort-de-France',
  type: 'restaurant',
  published: true,
  sources,
  details: {},
  conflicts,
  flags: [],
  sourceTexts: [],
  before: {
    description: '',
    descriptionFr: null,
    sources: [],
    details: {},
    listingStatus: 'active',
    published: true,
  },
});
test('the audit calls a place closed only on clear wording, and a dead link alone is never closure', () => {
  const dead = judge(
    place([
      result({ fetch: 'not_found', nameMatch: 0, extracted: undefined }),
      result({ fetch: 'dns', nameMatch: 0, extracted: undefined }),
    ]),
    today,
    3,
  );
  assert.equal(dead.proposed, 'uncertain');
  assert.match(dead.reason, /not proof of closure/);
  const closed = judge(
    place([result({ signals: closureSignals('Ce restaurant est définitivement fermé.') })]),
    today,
    3,
  );
  assert.equal(closed.proposed, 'closed');
  assert.match(closed.reason, /définitivement fermé/);
  assert.equal(closed.evidenceUrl, 'https://www.martinique.org/fr/x');
  const renovation = judge(
    place([result({ signals: closureSignals('Fermé pour travaux jusqu’à nouvel ordre.') })]),
    today,
    3,
  );
  assert.equal(renovation.proposed, 'uncertain');
  const blocked = judge(
    place([result({ fetch: 'blocked', nameMatch: 0, extracted: undefined })]),
    today,
    3,
  );
  assert.equal(blocked.proposed, 'uncertain');
  assert.match(blocked.reason, /blocks automated checks/);
  assert.equal(judge(place([]), today, 3).proposed, 'uncertain');
});
test('the audit keeps live listings, flags stale-only ones, and proposes updates when details differ', () => {
  assert.equal(judge(place([result({})]), today, 3).proposed, 'keep');
  assert.equal(judge(place([result({ modified: '2023-08-22' })]), today, 3).proposed, 'uncertain');
  assert.equal(
    judge(place([result({ modified: '2023-08-22' }), result({})]), today, 3).proposed,
    'keep',
    'an undated live page counts as current',
  );
  assert.equal(judge(place([result({ modified: '2026-01-01' })]), today, 3).proposed, 'keep');
  const changed = judge(
    place(
      [result({})],
      [
        {
          field: 'phone',
          ours: '+596 596 00 00 00',
          theirs: '+596 596 11 11 11',
          source: 'https://www.martinique.org/fr/x',
        },
      ],
    ),
    today,
    3,
  );
  assert.equal(changed.proposed, 'update');
  const mapOnly = judge(
    place(
      [result({})],
      [
        {
          field: 'map point',
          ours: '1,1',
          theirs: '2,2',
          source: 'https://www.martinique.org/fr/x',
        },
      ],
    ),
    today,
    3,
  );
  assert.equal(mapOnly.proposed, 'keep');
  assert.match(mapOnly.reason, /Map point differs/);
  const mismatch = judge(place([result({ nameMatch: 0.1, mentionsName: false })]), today, 3);
  assert.equal(mismatch.proposed, 'uncertain');
});
test('punctuation and spacing do not break a name match, and a board page outside the board index is flagged', () => {
  assert.equal(nameMatch("Acro'Kart", 'ACROKART'), 1);
  assert.equal(nameMatch('Coco Mango', 'Chez Bernadette'), 0);
  const unlisted = judge(place([result({ board: { listed: false } })]), today, 3);
  assert.equal(unlisted.proposed, 'uncertain');
  assert.match(unlisted.reason, /no longer in the board's current sitemap/);
  const listed = judge(
    place([result({ board: { listed: true, modified: '2026-09-01' } })]),
    today,
    3,
  );
  assert.equal(listed.proposed, 'keep');
  assert.match(listed.notes.join(' '), /current sitemap \(changed 2026-09-01\)/);
});
test('manual research replaces a proposal and is recorded as manual', () => {
  const rows: AuditRow[] = [
    {
      id: 1,
      name: 'A',
      town: 'T',
      currentStatus: 'active',
      proposed: 'uncertain',
      reason: 'Dead link.',
      evidenceUrl: '',
      sourcesChecked: 1,
      notes: [],
      public: true,
      decidedBy: 'script',
    },
    {
      id: 2,
      name: 'B',
      town: 'T',
      currentStatus: 'active',
      proposed: 'keep',
      reason: 'Live.',
      evidenceUrl: 'https://example.test/b',
      sourcesChecked: 1,
      notes: [],
      public: true,
      decidedBy: 'script',
    },
  ] as const;
  const result = applyOverrides(
    [...rows],
    [
      {
        id: 1,
        proposed: 'keep',
        reason: 'Official page shows 2026 posts.',
        evidenceUrl: 'https://example.test/a',
        checkedOn: '2026-10-02',
      },
    ],
  );
  assert.equal(result[0].proposed, 'keep');
  assert.equal(result[0].decidedBy, 'manual');
  assert.match(result[0].reason, /manual review, 2026-10-02; script said uncertain/);
  assert.equal(result[1].decidedBy, 'script');
});
test('addresses are tidied without losing information', () => {
  assert.equal(
    joinStreet('DOMAINE DE SIGY ROUTE DU STADE', 'Domaine de Sigy / Route du Stade'),
    'DOMAINE DE SIGY ROUTE DU STADE',
  );
  assert.equal(joinStreet('Quartier la Ferme', 'Bâtiment B'), 'Quartier la Ferme, Bâtiment B');
  assert.equal(tidyCase('DOMAINE DE SIGY ROUTE DU STADE'), 'Domaine de Sigy Route du Stade');
  assert.equal(tidyCase('Quartier le Coin'), 'Quartier le Coin');
  assert.equal(tidyCase('Rue du Chacha, le village créole'), 'Rue du Chacha, le village créole');
});
test('price ranges cover only rows still in force and collapse equal bounds', () => {
  const page = (rows: string) =>
    `<html><body><div class="TisProvider-body"><div class="TisProvider-body-prices"><table><tbody>${rows}</tbody></table></div></div><aside class="TisProvider-infos"></aside></body></html>`;
  const row = (label: string, valid: string, min: string, max: string) =>
    `<tr><td>${label}<span>${valid}</span></td><td>${min}</td><td>${max}</td></tr>`;
  const url = 'https://www.martinique.org/fr/que-faire/x';
  const mixed = extract(
    page(
      row('Adulte', 'Du 1 janvier 2024 au 31 décembre 2024', '20€', '-') +
        row('Adulte', 'Du 1 janvier 2026 au 31 décembre 2026', '25€', '40€'),
    ),
    { url, today },
  );
  assert.equal(mixed.priceRange, '25–40 €');
  assert.ok(mixed.notes.includes('price-expired:2024-12-31'));
  assert.equal(extract(page(row('A', '', '5€', '5€')), { url, today }).priceRange, '5 €');
  assert.equal(
    extract(page(row('A', 'Du 1 janvier 2021 au 31 décembre 2021', '5€', '9€')), { url, today })
      .priceRange,
    undefined,
  );
});
