import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { api, errorMessage } from '../../lib/api';
import { formatRoute, parseTours, type Tour } from '../../lib/tours';
import type { Place } from '../../types';

type Stop = { placeId: number; minutes: number };
const emptyForm = { name: '', nameFr: '', description: '', descriptionFr: '', published: false };

/**
 * Administrators curate tours here. Saving asks the server for the road route between the stops once; if that
 * fails the tour is still saved, and the map falls back to straight lines until the route is recalculated.
 */
export function TourManager({ places }: { places: Place[] }) {
  const { t } = useI18n();
  const [tours, setTours] = useState<Tour[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [stops, setStops] = useState<Stop[]>([]);
  const [pick, setPick] = useState('');
  const [deleting, setDeleting] = useState<Tour | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const choices = useMemo(
    () =>
      places
        .filter((place) => !stops.some((stop) => stop.placeId === place.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [places, stops],
  );
  useEffect(() => {
    const controller = new AbortController();
    api<unknown>('/moderation/tours', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setTours(parseTours(data));
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      });
    return () => controller.abort();
  }, []);
  const reset = () => {
    setEditing(null);
    setForm(emptyForm);
    setStops([]);
    setPick('');
  };
  const edit = (tour: Tour) => {
    setEditing(tour.id);
    setForm({
      name: tour.name,
      nameFr: tour.nameFr ?? '',
      description: tour.description,
      descriptionFr: tour.descriptionFr ?? '',
      published: tour.published,
    });
    setStops(tour.stops);
    setError('');
    setNotice('');
  };
  const move = (index: number, direction: -1 | 1) =>
    setStops((previous) => {
      const next = [...previous];
      const target = index + direction;
      if (target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const routeNotice = (tour: Tour) => {
    const facts = formatRoute(tour);
    return tour.routeSource === 'road' && facts
      ? t('Tour saved. The road route is {km} km long.', { km: facts.km })
      : t(
          'Tour saved, but no road route could be worked out, so the map shows straight lines. Check the OpenRouteService key, then use Recalculate route.',
        );
  };
  const replace = (tour: Tour) =>
    setTours((previous) =>
      previous.some((item) => item.id === tour.id)
        ? previous.map((item) => (item.id === tour.id ? tour : item))
        : [...previous, tour],
    );
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (stops.length < 2) {
      setError('Choose at least two stops.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = parseTours([
        await api<unknown>(editing ? `/tours/${editing}` : '/tours', {
          method: 'POST',
          body: JSON.stringify({ ...form, stops }),
        }),
      ])[0];
      if (!saved) throw new Error('Unexpected tour');
      replace(saved);
      setNotice(routeNotice(saved));
      reset();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function recalculate(tour: Tour) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = parseTours([
        await api<unknown>(`/tours/${tour.id}/route`, { method: 'POST' }),
      ])[0];
      if (!saved) throw new Error('Unexpected tour');
      replace(saved);
      setNotice(
        saved.routeSource === 'road'
          ? t('Road route updated.')
          : t(
              'No road route could be worked out, so the map shows straight lines. Check the OpenRouteService key and try again.',
            ),
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/tours/${deleting.id}`, { method: 'DELETE' });
      setTours((previous) => previous.filter((tour) => tour.id !== deleting.id));
      if (editing === deleting.id) reset();
      setNotice(t('Tour deleted.'));
      setDeleting(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const update = (field: keyof typeof emptyForm, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [field]: value }));
  return (
    <div className="mt-4 space-y-5">
      {error && (
        <p role="alert" className="error-message">
          {t(error)}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </p>
      )}
      <form
        onSubmit={save}
        className="space-y-4"
        aria-label={t(editing ? 'Edit tour' : 'Add a tour')}
      >
        <h4 className="text-lg font-bold">{t(editing ? 'Edit tour' : 'Add a tour')}</h4>
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
                  onClick={() => move(index, -1)}
                  aria-label={t('Move stop {number} up', { number: index + 1 })}
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === stops.length - 1}
                  onClick={() => move(index, 1)}
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
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className="primary-button">
            {busy ? t('Saving…') : t(editing ? 'Save tour' : 'Add tour')}
          </button>
          {editing && (
            <button type="button" disabled={busy} className="secondary-button" onClick={reset}>
              {t('Cancel')}
            </button>
          )}
        </div>
      </form>
      {deleting && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">
            {t('Delete the tour {name}?', { name: deleting.name })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void remove()}
              disabled={busy}
              className="primary-button bg-red-700"
            >
              {t('Confirm deletion')}
            </button>
            <button onClick={() => setDeleting(null)} disabled={busy} className="secondary-button">
              {t('Cancel')}
            </button>
          </div>
        </div>
      )}
      <ul className="space-y-2">
        {tours.map((tour) => {
          const facts = formatRoute(tour);
          return (
            <li
              key={tour.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
            >
              <div className="min-w-0">
                <p className="font-semibold">{tour.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {t('{count} stops', { count: tour.stops.length })} ·{' '}
                  {tour.published ? t('Published') : t('Draft')} ·{' '}
                  {facts ? t('Road route: {km} km', { km: facts.km }) : t('Straight lines only')}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  disabled={busy}
                  className="icon-button"
                  onClick={() => edit(tour)}
                  aria-label={t('Edit {name}', { name: tour.name })}
                >
                  <Pencil size={18} />
                </button>
                <button
                  disabled={busy}
                  className="icon-button"
                  onClick={() => void recalculate(tour)}
                  aria-label={t('Recalculate route for {name}', { name: tour.name })}
                >
                  <RefreshCw size={18} />
                </button>
                <button
                  disabled={busy}
                  className="icon-button text-red-700"
                  onClick={() => {
                    setDeleting(tour);
                    setError('');
                  }}
                  aria-label={t('Delete {name}', { name: tour.name })}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
