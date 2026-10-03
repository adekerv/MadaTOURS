import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longestSharedRun, planListing, planSources } from '../scripts/lib/apply-plan';
import type { PlaceAnalysis, SourceResult } from '../scripts/lib/place-analysis';
import type { PlaceRecord } from '../scripts/lib/place-sources';
import type { AuditRow } from '../scripts/audit-places';
const url = 'https://terresducentremartinique.fr/restaurant/spice-sugar-2/';
const place = (overrides: Partial<PlaceRecord> = {}): PlaceRecord => ({
  id: 361,
  name: 'Spice & Sugar',
  type: 'restaurant',
  lat: 14.6,
  lng: -61,
  location: 'Fort-de-France',
  description: 'A restaurant and food bar introducing dishes from several Caribbean islands.',
  description_fr: 'Un restaurant et food bar.',
  tags: [],
  sources: [{ url, title: 'Terres du Centre', fields: ['Name', 'Town'], checkedAt: '2026-09-24' }],
  published: true,
  access: 'unknown',
  hours: null,
  details: {},
  listing_status: 'active',
  archived: false,
  ...overrides,
});
const source = (overrides: Partial<SourceResult> = {}): SourceResult => ({
  url,
  title: 'Terres du Centre',
  declaredFields: ['Name', 'Town'],
  previouslyCheckedAt: '2026-09-24',
  fetch: 'ok',
  redirected: false,
  nameMatch: 1,
  mentionsName: true,
  ...overrides,
});
const analysis = (current: PlaceRecord, overrides: Partial<PlaceAnalysis> = {}): PlaceAnalysis => ({
  id: current.id,
  name: current.name,
  town: current.location,
  type: current.type,
  published: current.published,
  sources: [source()],
  details: {
    address: "Centre d'affaires Valmenière, 97200 Fort de France",
    phone: '+596 596 73 25 05',
    openingPeriods: [{ day: 1, opens: 600, closes: 900 }],
    from: {
      address: { url, checkedAt: '2026-10-02' },
      phone: { url, checkedAt: '2026-10-02' },
      openingPeriods: { url, checkedAt: '2026-10-02' },
    },
  },
  conflicts: [],
  flags: [],
  sourceTexts: [
    {
      url,
      text: 'Caribbean food bar. Découvrez toutes les spécialités caribéennes Martinique Barbade Trinidad Haïti Jamaïque.',
    },
  ],
  before: {
    description: current.description,
    descriptionFr: current.description_fr,
    sources: current.sources,
    details: (current.details ?? {}) as Record<string, unknown>,
    listingStatus: current.listing_status ?? 'active',
    published: current.published,
  },
  ...overrides,
});
test('source facts are written with provenance, structured hours separately, and checked dates refreshed', () => {
  const current = place();
  const plan = planSources(analysis(current), current, '2026-10-02');
  assert.deepEqual(plan.skipped, []);
  assert.equal((plan.patch.details as { phone: string }).phone, '+596 596 73 25 05');
  assert.equal(
    (plan.patch.details as { from: Record<string, unknown> }).from.openingPeriods,
    undefined,
    'hours provenance lives with the hours',
  );
  assert.deepEqual(plan.hours, { periods: [{ day: 1, opens: 600, closes: 900 }], url });
  const [updated] = plan.patch.sources!;
  assert.equal(updated.checkedAt, '2026-10-02');
  assert.deepEqual(updated.fields, ['Name', 'Town', 'Address', 'Telephone', 'Opening hours']);
});
test('a place edited after it was read is never overwritten', () => {
  const read = place();
  const plan = planSources(
    analysis(read),
    place({ description: 'Someone improved this by hand.' }),
    '2026-10-02',
  );
  assert.deepEqual(plan.patch, {});
  assert.match(plan.skipped[0], /edited after/);
});
test('a source that no longer matches the place keeps its old checked date', () => {
  const current = place();
  const stale = analysis(current, { sources: [source({ nameMatch: 0.1 })], details: {} });
  const plan = planSources(stale, current, '2026-10-02');
  assert.equal(plan.patch.sources, undefined);
  assert.deepEqual(plan.changes, []);
});
test('description drafts must be in our own words and sized for the page', () => {
  const current = place();
  const own = planSources(analysis(current), current, '2026-10-02', {
    en: 'A relaxed food bar in Fort-de-France serving dishes from across the Caribbean, from Barbados to Jamaica.',
    fr: 'Un food bar décontracté à Fort-de-France, avec des plats de toute la Caraïbe, de la Barbade à la Jamaïque.',
  });
  assert.match(own.patch.description!, /relaxed food bar/);
  assert.match(own.patch.description_fr!, /décontracté/);
  const copied = planSources(analysis(current), current, '2026-10-02', {
    en: 'Come and discover Découvrez toutes les spécialités caribéennes Martinique Barbade Trinidad Haïti Jamaïque today.',
    fr: 'x'.repeat(601),
  });
  assert.equal(copied.patch.description, undefined);
  assert.equal(copied.patch.description_fr, undefined);
  assert.equal(copied.skipped.length, 2);
  assert.equal(longestSharedRun('a b c d e', 'x b c d y'), 3);
});
const row = (id: number, proposed: AuditRow['proposed'], reason = 'Reason.'): AuditRow => ({
  id,
  name: `Place ${id}`,
  town: 'T',
  currentStatus: 'active',
  proposed,
  reason,
  evidenceUrl: 'https://example.test/e',
  sourcesChecked: 1,
  notes: [],
  public: true,
  decidedBy: 'script',
});
test('closures wait for approval, drafts and archived places are left alone, and reopening needs a person', () => {
  const places = [
    place({ id: 1 }),
    place({ id: 2 }),
    place({ id: 3 }),
    place({ id: 4, published: false }),
    place({ id: 5, archived: true, listing_status: 'closed', published: false }),
    place({ id: 6, listing_status: 'needs_review' }),
  ];
  const rows = [
    row(1, 'keep'),
    row(2, 'closed', 'Source says closed.'),
    row(3, 'uncertain'),
    row(4, 'keep'),
    row(5, 'keep'),
    row(6, 'keep'),
  ];
  const analyses = places.map((p) => analysis(p));
  const plan = planListing({ rows, analyses }, places, {
    approveClosed: new Set(),
    include: new Set(['keep', 'update']),
  });
  assert.deepEqual(
    plan.actions.map((a) => `${a.id}:${a.from}>${a.to}`),
    ['1:active>active', '6:needs_review>active'],
  );
  assert.deepEqual(
    plan.held.map((h) => h.id),
    [2, 5],
  );
  assert.equal(plan.actions[0].confirmedSources.length, 1);
  assert.match(plan.skipped.map((s) => s.why).join(' '), /draft/);
  const approved = planListing({ rows, analyses }, places, {
    approveClosed: new Set([2]),
    include: new Set(['keep', 'uncertain']),
  });
  assert.ok(approved.actions.some((a) => a.id === 2 && a.to === 'closed'));
  assert.ok(approved.actions.some((a) => a.id === 3 && a.to === 'needs_review'));
});
test('a status that changed after the audit is not overwritten', () => {
  const read = place({ id: 7 });
  const plan = planListing(
    { rows: [row(7, 'uncertain')], analyses: [analysis(read)] },
    [place({ id: 7, listing_status: 'needs_review' })],
    { approveClosed: new Set(), include: new Set(['uncertain']) },
  );
  assert.deepEqual(plan.actions, []);
  assert.match(plan.skipped[0].why, /changed after the audit/);
});
