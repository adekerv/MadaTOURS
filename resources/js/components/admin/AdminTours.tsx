import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ImageUp,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { api, errorMessage } from '../../lib/api';
import { moveItem } from '../../lib/trips';
import { formatRoute, parseTours, type Tour } from '../../lib/tours';
import { preparePhoto } from '../../lib/upload-photo';
import type { Place } from '../../types';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { photoError } from './AdminSettings';
import {
  Badge,
  Choice,
  EmptyState,
  ListSkeleton,
  ListToolbar,
  LoadError,
  Pagination,
  SectionHeader,
  useResetPage,
} from './AdminKit';

type Stop = { placeId: number; minutes: number };
const PER_PAGE = 20;

/**
 * Tours are free, self-guided routes an administrator curates, so they have no price, dates or capacity (meet-ups
 * have those). Saving asks for the road route once; if routing fails the tour is still saved with straight lines.
 */
export function AdminTours({ places }: { places: Place[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Tour | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Tour | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  useResetPage(setPage, search, status, sort);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api<unknown>('/moderation/tours', { signal: controller.signal })
      .then((data) => !controller.signal.aborted && setTours(parseTours(data)))
      .catch((failure) => !controller.signal.aborted && setError(errorMessage(failure)));
    return () => controller.abort();
  }, [revision]);
  const replace = (tour: Tour) =>
    setTours((previous) =>
      previous?.some((item) => item.id === tour.id)
        ? previous.map((item) => (item.id === tour.id ? tour : item))
        : [...(previous ?? []), tour],
    );
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (tours ?? [])
      .filter((tour) =>
        status === 'published'
          ? tour.published
          : status === 'draft'
            ? !tour.published
            : status === 'featured'
              ? tour.featured
              : true,
      )
      .filter(
        (tour) =>
          !needle || `${tour.name} ${tour.nameFr ?? ''}`.toLocaleLowerCase().includes(needle),
      )
      .sort((a, b) =>
        sort === 'newest'
          ? b.id - a.id
          : sort === 'stops'
            ? b.stops.length - a.stops.length
            : a.name.localeCompare(b.name),
      );
  }, [tours, search, status, sort]);
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  async function save(tour: Tour, changes: Partial<Tour>, message: string) {
    setBusy(tour.id);
    try {
      const next = { ...tour, ...changes };
      const saved = parseTours([
        await api<unknown>(`/tours/${tour.id}`, {
          method: 'POST',
          body: JSON.stringify({
            name: next.name,
            nameFr: next.nameFr ?? '',
            description: next.description,
            descriptionFr: next.descriptionFr ?? '',
            published: next.published,
            featured: next.featured,
            image: next.image ?? '',
            stops: next.stops,
          }),
        }),
      ])[0];
      if (saved) replace(saved);
      toast(message);
    } catch (failure) {
      toast(errorMessage(failure), 'error');
    } finally {
      setBusy(null);
    }
  }
  async function duplicate(tour: Tour) {
    setBusy(tour.id);
    try {
      const copy = parseTours([
        await api<unknown>(`/tours/${tour.id}/duplicate`, { method: 'POST' }),
      ])[0];
      if (copy) replace(copy);
      toast('A draft copy was created.');
    } catch (failure) {
      toast(errorMessage(failure), 'error');
    } finally {
      setBusy(null);
    }
  }
  async function recalculate(tour: Tour) {
    setBusy(tour.id);
    try {
      const saved = parseTours([
        await api<unknown>(`/tours/${tour.id}/route`, { method: 'POST' }),
      ])[0];
      if (saved) replace(saved);
      toast(
        saved?.routeSource === 'road'
          ? 'Road route updated.'
          : 'No road route could be worked out, so the map shows straight lines. Check the OpenRouteService key and try again.',
        saved?.routeSource === 'road' ? 'success' : 'error',
      );
    } catch (failure) {
      toast(errorMessage(failure), 'error');
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <SectionHeader
        title={t('Tours')}
        description={t(
          'Free, self-guided routes between places. Publish them for visitors and feature the best ones first on the homepage.',
        )}
        actions={
          <button
            className="primary-button flex items-center gap-2"
            onClick={() => setEditing('new')}
          >
            <Plus size={17} aria-hidden />
            {t('Add a tour')}
          </button>
        }
      />
      <ListToolbar search={search} onSearch={setSearch} placeholder={t('Search tours')}>
        <Choice
          label={t('Status')}
          value={status}
          onChange={setStatus}
          options={[
            ['', t('All')],
            ['published', t('Published')],
            ['draft', t('Draft')],
            ['featured', t('Featured')],
          ]}
        />
        <Choice
          label={t('Sort by')}
          value={sort}
          onChange={setSort}
          options={[
            ['name', t('Name')],
            ['newest', t('Newest first')],
            ['stops', t('Most stops')],
          ]}
        />
      </ListToolbar>
      {error && <LoadError error={error} onRetry={() => setRevision((value) => value + 1)} />}
      {!tours && !error && <ListSkeleton />}
      {tours && !filtered.length && (
        <EmptyState
          icon={<Route size={22} />}
          title={t(tours.length ? 'No tours match' : 'No tours yet')}
        >
          {t(
            tours.length
              ? 'Try another search or clear the filters.'
              : 'Add a tour to suggest a route between places.',
          )}
        </EmptyState>
      )}
      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((tour) => {
            const facts = formatRoute(tour);
            return (
              <li
                key={tour.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
              >
                {tour.image ? (
                  <img
                    src={tour.image}
                    alt=""
                    className="size-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-700">
                    <Route size={24} aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{tour.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <Badge tone={tour.published ? 'green' : 'slate'}>
                      {t(tour.published ? 'Published' : 'Draft')}
                    </Badge>
                    {tour.featured && <Badge tone="orange">{t('Featured')}</Badge>}
                    <span>{t('{count} stops', { count: tour.stops.length })}</span>
                    <span>
                      ·{' '}
                      {facts
                        ? t('Road route: {km} km', { km: facts.km })
                        : t('Straight lines only')}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <label className="flex min-h-11 items-center gap-2 px-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={tour.published}
                      disabled={busy === tour.id}
                      onChange={(event) =>
                        void save(
                          tour,
                          { published: event.target.checked },
                          event.target.checked
                            ? 'The tour is published.'
                            : 'The tour is back to draft.',
                        )
                      }
                    />
                    {t('Published')}
                  </label>
                  <button
                    disabled={busy === tour.id}
                    className={`icon-button ${tour.featured ? 'text-orange-700' : ''}`}
                    aria-pressed={tour.featured}
                    onClick={() =>
                      void save(
                        tour,
                        { featured: !tour.featured },
                        tour.featured
                          ? 'The tour is no longer featured.'
                          : 'The tour is featured on the homepage.',
                      )
                    }
                    aria-label={t('Feature {name} on the homepage', { name: tour.name })}
                  >
                    <Star size={18} fill={tour.featured ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    disabled={busy === tour.id}
                    className="icon-button"
                    onClick={() => setEditing(tour)}
                    aria-label={t('Edit {name}', { name: tour.name })}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    disabled={busy === tour.id}
                    className="icon-button"
                    onClick={() => void duplicate(tour)}
                    aria-label={t('Duplicate {name}', { name: tour.name })}
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    disabled={busy === tour.id}
                    className="icon-button"
                    onClick={() => void recalculate(tour)}
                    aria-label={t('Recalculate route for {name}', { name: tour.name })}
                  >
                    <RefreshCw size={18} />
                  </button>
                  <button
                    disabled={busy === tour.id}
                    className="icon-button text-red-700"
                    onClick={() => setDeleting(tour)}
                    aria-label={t('Delete {name}', { name: tour.name })}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} perPage={PER_PAGE} total={filtered.length} onPage={setPage} />
      {editing && (
        <TourEditor
          tour={editing === 'new' ? null : editing}
          places={places}
          onClose={() => setEditing(null)}
          onSaved={(tour) => {
            replace(tour);
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={t('Delete this tour?')}
          confirmLabel={t('Confirm deletion')}
          onConfirm={async () => {
            try {
              await api(`/tours/${deleting.id}`, { method: 'DELETE' });
              setTours((previous) => previous?.filter((tour) => tour.id !== deleting.id) ?? null);
              toast('Tour deleted.');
            } catch (failure) {
              toast(errorMessage(failure), 'error');
              return false;
            }
          }}
          onClose={() => setDeleting(null)}
        >
          {t('Delete the tour {name}?', { name: deleting.name })}
        </ConfirmDialog>
      )}
    </>
  );
}

function TourEditor({
  tour,
  places,
  onClose,
  onSaved,
}: {
  tour: Tour | null;
  places: Place[];
  onClose: () => void;
  onSaved: (tour: Tour) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({
    name: tour?.name ?? '',
    nameFr: tour?.nameFr ?? '',
    description: tour?.description ?? '',
    descriptionFr: tour?.descriptionFr ?? '',
    published: tour?.published ?? false,
    featured: tour?.featured ?? false,
    image: tour?.image ?? '',
  });
  const [stops, setStops] = useState<Stop[]>(tour?.stops ?? []);
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const byId = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const choices = useMemo(
    () =>
      places
        .filter(
          (place) =>
            place.access !== 'restricted' && !stops.some((stop) => stop.placeId === place.id),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [places, stops],
  );
  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) =>
    setForm((previous) => ({ ...previous, [field]: value }));
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const photo = await preparePhoto(file);
      const { url } = await api<{ url: string }>('/admin/images', {
        method: 'POST',
        body: JSON.stringify({ photo, kind: 'tour' }),
      });
      update('image', url);
    } catch (failure) {
      toast(photoError(failure), 'error');
    } finally {
      setUploading(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (stops.length < 2) {
      setError('Choose at least two stops.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = parseTours([
        await api<unknown>(tour ? `/tours/${tour.id}` : '/tours', {
          method: 'POST',
          body: JSON.stringify({ ...form, stops }),
        }),
      ])[0];
      if (!saved) throw new Error('Unexpected tour');
      const facts = formatRoute(saved);
      toast(
        saved.routeSource === 'road' && facts
          ? t('Tour saved. The road route is {km} km long.', { km: facts.km })
          : t(
              'Tour saved, but no road route could be worked out, so the map shows straight lines. Check the OpenRouteService key, then use Recalculate route.',
            ),
        saved.routeSource === 'road' ? 'success' : 'error',
      );
      onSaved(saved);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={t(tour ? 'Edit tour' : 'Add a tour')} onClose={onClose} side>
      <form
        onSubmit={save}
        className="space-y-4 p-5 sm:p-6"
        aria-label={t(tour ? 'Edit tour' : 'Add a tour')}
      >
        <label className="field-label">
          {t('Tour name')}
          <input
            required
            minLength={3}
            maxLength={120}
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          {t('Tour name in French (optional)')}
          <input
            minLength={3}
            maxLength={120}
            value={form.nameFr}
            onChange={(event) => update('nameFr', event.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          {t('Tour description')}
          <textarea
            required
            rows={3}
            minLength={10}
            maxLength={2000}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          {t('Tour description in French (optional)')}
          <textarea
            rows={3}
            minLength={10}
            maxLength={2000}
            value={form.descriptionFr}
            onChange={(event) => update('descriptionFr', event.target.value)}
            className="field-input"
          />
        </label>
        <div className="space-y-2">
          <label className="field-label">
            {t('Cover image address (optional)')}
            <input
              type="url"
              maxLength={2000}
              placeholder="https://…"
              value={form.image}
              onChange={(event) => update('image', event.target.value)}
              className="field-input"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="secondary-button inline-flex cursor-pointer items-center gap-2">
              <ImageUp size={17} aria-hidden />
              {uploading ? t('Uploading…') : t('Upload an image')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(event) => void upload(event.target.files?.[0])}
              />
            </label>
            {form.image && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => update('image', '')}
              >
                {t('Remove the image')}
              </button>
            )}
          </div>
          {form.image && (
            <img
              src={form.image}
              alt={t('Cover image preview')}
              className="h-36 w-full rounded-2xl object-cover"
            />
          )}
        </div>
        <fieldset className="space-y-3">
          <legend className="field-label">{t('Stops, in visiting order')}</legend>
          <ol className="space-y-2">
            {stops.map((stop, index) => (
              <li
                key={stop.placeId}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2"
              >
                <span className="min-w-0 flex-1 font-semibold">
                  {index + 1}. {byId.get(stop.placeId)?.name ?? t('This place is no longer listed')}
                </span>
                <label className="flex items-center gap-2 text-sm">
                  <span>{t('Visit (minutes)')}</span>
                  <input
                    type="number"
                    min={5}
                    max={720}
                    step={5}
                    required
                    value={stop.minutes}
                    aria-label={t('Visit length in minutes for stop {number}', {
                      number: index + 1,
                    })}
                    onChange={(event) =>
                      setStops((previous) =>
                        previous.map((item, position) =>
                          position === index
                            ? { ...item, minutes: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    className="field-input w-24"
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === 0}
                  onClick={() => setStops((previous) => moveItem(previous, index, -1))}
                  aria-label={t('Move stop {number} up', { number: index + 1 })}
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === stops.length - 1}
                  onClick={() => setStops((previous) => moveItem(previous, index, 1))}
                  aria-label={t('Move stop {number} down', { number: index + 1 })}
                >
                  <ArrowDown size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button text-red-700"
                  onClick={() =>
                    setStops((previous) => previous.filter((_, position) => position !== index))
                  }
                  aria-label={t('Remove stop {number}', { number: index + 1 })}
                >
                  <X size={18} />
                </button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <label className="field-label min-w-0 flex-1">
              {t('Add a stop')}
              <select
                value={pick}
                onChange={(event) => setPick(event.target.value)}
                className="field-input"
                disabled={stops.length >= 25}
              >
                <option value="">{t('Choose a place')}</option>
                {choices.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name} — {place.location}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary-button self-end"
              disabled={!pick || stops.length >= 25}
              onClick={() => {
                setStops((previous) => [...previous, { placeId: Number(pick), minutes: 60 }]);
                setPick('');
              }}
            >
              {t('Add stop')}
            </button>
          </div>
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(event) => update('published', event.target.checked)}
            className="size-5"
          />
          {t('Publish this tour on the homepage')}
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(event) => update('featured', event.target.checked)}
            className="size-5"
          />
          {t('Feature it first on the homepage')}
        </label>
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button disabled={busy || uploading} className="primary-button">
            {busy ? t('Saving…') : t(tour ? 'Save tour' : 'Add tour')}
          </button>
          <button type="button" disabled={busy} className="secondary-button" onClick={onClose}>
            {t('Cancel')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
