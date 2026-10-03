# Source facts and listing audit

Two repeatable processes keep the catalogue honest. Both only read public pages, both are read-only until you
pass `--apply`, and neither deletes anything.

## What they rely on

- `database/schema/listing.sql` adds, to `mt_places`: `details` (facts from sources, with provenance),
  `listing_status` (`active`, `needs_review`, `closed`), `archived` and `status_checked_at`. It also adds
  `mt_listing_audits` (reason, evidence link and date for every change, readable by administrators only) and
  `mt_set_listing_status()`, which changes status, visibility and the audit row in one transaction.
- **Apply the schema once** before the apply scripts will run: paste `database/schema/listing.sql` into the Supabase
  SQL editor (it is idempotent), or run `npm run db:apply`.
- Closing a place sets `archived = true` and `published = false`. Every public read already filters on `published`,
  so the place leaves search, the map, day trips, route suggestions, daily picks and community features together.
  People who saved it see "This place is no longer listed" and can remove it; saved day trips show the same note.

## Politeness

Pages are fetched by `scripts/lib/source-fetch.ts`: it identifies itself as `MadaToursSourceCheck`, obeys
`robots.txt` (and any `Crawl-delay`), talks to one host at a time with at least a second between requests, and caches
every page in `.data/sources/` (24 hours) so reviewing results never re-fetches. A site that blocks automated access is
reported as "blocked", never as "closed".

## 1. Extract facts from the cited sources

```sh
npm run sources:extract                       # five-place review sample
npm run sources:extract -- --ids=361,1,5      # chosen places
npm run sources:extract -- --all              # everything
```

Writes `.data/extraction/*.json`: per place, each field with the source that stated it, conflicts with our data, and
flags (dead or mismatched pages, expired prices, hours kept as the source's own words, labels not yet understood).

Rules built into the extractor (each covered by `tests/sources.test.ts`):

- Only what a page states. A field no source gives is left out and the page shows no empty slot.
- A tourism directory's header, footer and social links belong to the directory, never to a venue.
- Free-text hours are kept verbatim and labelled "as listed by the source"; only schema.org hours are turned into a
  schedule, and overnight or malformed ones are not guessed.
- A price list that the page itself dates to a past period is not shown.
- Conflicts (address, town, telephone, map point) are listed for a person; our data is never silently overwritten.

Descriptions are written by a person, in their own words, into a file such as
`supabase/catalogue/descriptions-<date>.json`: `{ "361": { "en": "...", "fr": "...", "basedOn": "..." } }`.
The apply step refuses a draft that copies more than nine words in a row from a source. (Place names and plain facts
naturally repeat a few words; ten or more in a row counts as copying.)

```sh
npm run sources:apply -- --from=.data/extraction/all-<date>.json --descriptions=<file>   # preview
npm run sources:apply -- --from=... --descriptions=<file> --apply [--ids=...] [--sync-seed]
```

Each place is compared with how it looked when read; if someone edited it since, it is skipped. Affected rows are
backed up to `.data/backups/` first, and every write is verified afterwards.

The 2026-10-02 run wrote facts for 353 places, structured hours for 136, refreshed 354 source dates and replaced 341
descriptions with the reviewed ones in `supabase/catalogue/descriptions-2026-10-02.json`.

After a live write, mirror it into the bundled seed (used by new databases, the offline fallback and the tests):

```sh
npm run catalogue:sync-seed             # preview
npm run catalogue:sync-seed -- --write  # then review the diff and run npm run db:prepare
```

## 2. Audit every place: keep, update, uncertain or closed

```sh
npm run places:audit                                   # writes reports/listing-audit-<date>.csv and .json
npm run places:audit -- --overrides=reports/manual-review-<date>.json
```

| Result      | Meaning                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| `keep`      | A live page about the place, listed in the tourism board's current sitemap, with no closure wording.     |
| `update`    | Still listed, but its details differ from ours.                                                          |
| `uncertain` | Cannot be confirmed (links dead or blocked, page about something else, only listing older than 3 years). |
| `closed`    | A page about the place says so in clear words (for example "définitivement fermé"). Needs your approval. |

A dead link alone is never "closed". "Keep" is not proof of recent trading: directories rarely remove a page, so
anything the script cannot decide is checked by hand and recorded in `reports/manual-review-<date>.json`, which the
audit then shows as `decided_by = manual` with the reviewer's own evidence link.

Applying (preview first; only `keep` and `update` by default):

```sh
npm run places:apply                                          # preview
npm run places:apply -- --apply                               # keep + update: refreshes source dates
npm run places:apply -- --apply --include=keep,update,uncertain   # also adds the visitor note "could not confirm"
npm run places:apply -- --apply --approve-closed=12,34        # hides exactly the closures you approved
npm run places:apply -- --apply --sync-seed                   # mirror into database/data/places.json
```

## Restoring a place

Nothing is deleted. In the Supabase SQL editor:

```sql
select public.mt_set_listing_status(12, 'active', 'Reopened per official page.', 'https://example.org/proof', current_date);
```

That reverses the hiding (and only that; an unpublished editorial draft stays a draft) and records why.

## Re-running every few months

1. `npm run places:audit -- --refresh`
2. Read `reports/listing-audit-<date>.csv`; research anything `uncertain` or `closed` and record it in a manual review file.
3. Re-run with `--overrides`, preview with `places:apply`, then apply.
