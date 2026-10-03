import { parseDetails } from '../../resources/js/lib/content';
import type { PlaceAnalysis } from './place-analysis';
import type { PlaceRecord, SourceRef } from './place-sources';
import type { AuditRow, Proposal } from '../audit-places';
/**
 * Decides what to write, and what to refuse, without touching any database. Every write checks that the
 * row is unchanged since it was read, so a newer edit by a person is never overwritten.
 */
export const fieldLabels: Record<string, string> = {
  address: 'Address',
  phone: 'Telephone',
  website: 'Website',
  facebook: 'Social media',
  instagram: 'Social media',
  hoursText: 'Opening hours',
  openingPeriods: 'Opening hours',
  priceRange: 'Price range',
  kind: 'Type',
  payment: 'Payment',
  languages: 'Languages spoken',
  services: 'Services',
  reservations: 'Reservations',
  accessibility: 'Accessibility',
  parking: 'Parking',
};
export interface DescriptionDraft {
  en: string;
  fr: string;
  /** Free-text note on which source facts the wording rests on. */
  basedOn?: string;
}
export interface SourcesPlan {
  id: number;
  name: string;
  patch: {
    details?: Record<string, unknown>;
    description?: string;
    description_fr?: string;
    sources?: SourceRef[];
  };
  hours?: { periods: unknown[]; url: string };
  changes: string[];
  skipped: string[];
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
/** The longest run of consecutive words that two texts share. */
export function longestSharedRun(a: string, b: string): number {
  const left = wordsOf(a);
  const right = wordsOf(b);
  let best = 0;
  const previous = new Array<number>(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i++) {
    let diagonal = 0;
    for (let j = 1; j <= right.length; j++) {
      const saved = previous[j];
      previous[j] = left[i - 1] === right[j - 1] ? diagonal + 1 : 0;
      if (previous[j] > best) best = previous[j];
      diagonal = saved;
    }
  }
  return best;
}
export const maxCopiedWords = 9;
export function planSources(
  analysis: PlaceAnalysis,
  current: PlaceRecord,
  today: string,
  draft?: DescriptionDraft,
): SourcesPlan {
  const plan: SourcesPlan = {
    id: current.id,
    name: current.name,
    patch: {},
    changes: [],
    skipped: [],
  };
  const before = analysis.before;
  if (
    current.description !== before.description ||
    (current.description_fr ?? null) !== before.descriptionFr ||
    !same(current.sources ?? [], before.sources) ||
    !same(current.details ?? {}, before.details)
  ) {
    plan.skipped.push(
      'The place was edited after the sources were read; run the extraction again.',
    );
    return plan;
  }
  const {
    openingPeriods,
    from: rawFrom,
    ...extracted
  } = analysis.details as Record<string, unknown> & {
    openingPeriods?: unknown[];
    from?: Record<string, { url: string; checkedAt: string }>;
  };
  const provenance = { ...(rawFrom ?? {}) };
  const hoursFrom = provenance.openingPeriods;
  delete provenance.openingPeriods;
  const existing = (current.details ?? {}) as Record<string, unknown> & {
    from?: Record<string, unknown>;
  };
  const merged: Record<string, unknown> = {
    ...existing,
    ...extracted,
    from: { ...(existing.from ?? {}), ...provenance },
  };
  const valid = parseDetails(merged);
  if (valid) {
    for (const key of Object.keys(extracted))
      if (!(key in valid))
        plan.skipped.push(`"${key}" from the source did not pass validation and was left out.`);
    if (!same(valid, existing)) {
      plan.patch.details = valid as Record<string, unknown>;
      plan.changes.push(`details: ${Object.keys(extracted).join(', ') || 'provenance'}`);
    }
  }
  if (openingPeriods?.length && hoursFrom && !same(openingPeriods, current.opening_periods)) {
    plan.hours = { periods: openingPeriods, url: hoursFrom.url };
    plan.changes.push('opening hours (structured)');
  }
  // Sources that were re-read and are about this place get today's date and the fields they provided.
  const providedBy = (url: string) => [
    ...new Set(
      Object.entries(provenance)
        .filter(([, ref]) => ref.url === url)
        .map(([field]) => fieldLabels[field])
        .filter(Boolean),
    ),
  ];
  const hoursLabel = hoursFrom ? ['Opening hours'] : [];
  const sources = (current.sources ?? []).map((source) => {
    const result = analysis.sources.find((item) => item.url === source.url);
    if (!result || result.fetch !== 'ok' || result.nameMatch < 0.5) return source;
    const labels = [
      ...providedBy(source.url),
      ...(hoursFrom?.url === source.url ? hoursLabel : []),
    ];
    return {
      ...source,
      checkedAt: today,
      fields: [...new Set([...source.fields, ...labels])].slice(0, 20),
    };
  });
  if (!same(sources, current.sources ?? [])) {
    plan.patch.sources = sources;
    plan.changes.push('source checked dates');
  }
  if (draft) {
    const texts = analysis.sourceTexts.map((item) => item.text);
    for (const [language, text] of [
      ['en', draft.en],
      ['fr', draft.fr],
    ] as const) {
      const copied = Math.max(0, ...texts.map((source) => longestSharedRun(text, source)));
      if (!text.trim() || text.length > 600)
        plan.skipped.push(`Draft ${language} description is empty or too long.`);
      else if (copied > maxCopiedWords)
        plan.skipped.push(
          `Draft ${language} description copies ${copied} words in a row from a source.`,
        );
      else if (language === 'en' && text !== current.description) {
        plan.patch.description = text;
        plan.changes.push('English description');
      } else if (language === 'fr' && text !== (current.description_fr ?? '')) {
        plan.patch.description_fr = text;
        plan.changes.push('French description');
      }
    }
  }
  return plan;
}
export type Status = 'active' | 'needs_review' | 'closed';
export interface ListingAction {
  id: number;
  name: string;
  from: string;
  to: Status;
  reason: string;
  evidence: string | null;
  /** Source addresses that were re-read today and confirm the place, to receive today's date. */
  confirmedSources: string[];
}
export interface ListingPlan {
  actions: ListingAction[];
  /** Waiting for a person: closures not yet approved, and anything that would reopen a closed place. */
  held: { id: number; name: string; proposed: Proposal; reason: string }[];
  skipped: { id: number; name: string; why: string }[];
}
const target: Record<Exclude<Proposal, 'closed'>, Status> = {
  keep: 'active',
  update: 'active',
  uncertain: 'needs_review',
};
export function planListing(
  report: { rows: AuditRow[]; analyses: PlaceAnalysis[] },
  current: PlaceRecord[],
  options: { approveClosed: Set<number>; include: Set<Proposal> },
): ListingPlan {
  const plan: ListingPlan = { actions: [], held: [], skipped: [] };
  const byId = new Map(current.map((place) => [place.id, place]));
  const analyses = new Map(report.analyses.map((analysis) => [analysis.id, analysis]));
  for (const row of report.rows) {
    const place = byId.get(row.id);
    const analysis = analyses.get(row.id);
    const skip = (why: string) => plan.skipped.push({ id: row.id, name: row.name, why });
    if (!place || !analysis) {
      skip('No longer in the catalogue.');
      continue;
    }
    if (
      !options.include.has(row.proposed) &&
      !(row.proposed === 'closed' && options.approveClosed.has(row.id))
    ) {
      if (row.proposed === 'closed')
        plan.held.push({ id: row.id, name: row.name, proposed: 'closed', reason: row.reason });
      continue;
    }
    const status = (place.listing_status ?? 'active') as Status;
    if (place.archived || status === 'closed') {
      if (row.proposed !== 'closed')
        plan.held.push({
          id: row.id,
          name: row.name,
          proposed: row.proposed,
          reason: `Currently closed; the audit now says "${row.proposed}". Reopening needs a person's decision.`,
        });
      continue;
    }
    if (!place.published) {
      skip('An unpublished draft is not changed by the audit.');
      continue;
    }
    if (status !== analysis.before.listingStatus || place.published !== analysis.before.published) {
      skip('Its status changed after the audit was run; run the audit again.');
      continue;
    }
    const confirmedSources =
      row.proposed === 'keep' || row.proposed === 'update'
        ? analysis.sources
            .filter((source) => source.fetch === 'ok' && source.nameMatch >= 0.5)
            .map((source) => source.url)
        : [];
    if (row.proposed === 'closed') {
      plan.actions.push({
        id: row.id,
        name: row.name,
        from: status,
        to: 'closed',
        reason: row.reason.slice(0, 1000),
        evidence: row.evidenceUrl || null,
        confirmedSources,
      });
      continue;
    }
    const to = target[row.proposed];
    if (to === status && !confirmedSources.length) continue;
    plan.actions.push({
      id: row.id,
      name: row.name,
      from: status,
      to,
      reason: row.reason.slice(0, 1000),
      evidence: row.evidenceUrl || null,
      confirmedSources,
    });
  }
  return plan;
}
