import { useMemo, useState, type FormEvent } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import type { Place } from '../../types';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import type { AdminPlaceList } from './AdminLayout';
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

const PER_PAGE = 20;

/** The catalogue: every published place, searchable, with adding and deleting. */
export function AdminPlaces({
  places,
  onChanged,
}: {
  places: AdminPlaceList;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Place | null>(null);
  useResetPage(setPage, search, type, sort);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return places.places
      .filter((place) => !type || place.type === type)
      .filter(
        (place) =>
          !needle ||
          place.name.toLocaleLowerCase().includes(needle) ||
          place.location.toLocaleLowerCase().includes(needle),
      )
      .sort((a, b) =>
        sort === 'town'
          ? a.location.localeCompare(b.location) || a.name.localeCompare(b.name)
          : sort === 'rating'
            ? (b.rating ?? 0) - (a.rating ?? 0)
            : sort === 'newest'
              ? b.id - a.id
              : a.name.localeCompare(b.name),
      );
  }, [places.places, search, type, sort]);
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  async function remove(place: Place) {
    try {
      await api(`/places/${place.id}`, { method: 'DELETE' });
      toast(t('{name} was deleted.', { name: place.name }));
      onChanged();
    } catch (failure) {
      toast(errorMessage(failure), 'error');
      return false;
    }
  }
  return (
    <>
      <SectionHeader
        title={t('Places')}
        description={t(
          'Every place in the guide. Added places appear in search and on the map straight away.',
        )}
        actions={
          <button
            className="primary-button flex items-center gap-2"
            onClick={() => setAdding(true)}
          >
            <Plus size={17} aria-hidden />
            {t('Add a place')}
          </button>
        }
      />
      <ListToolbar search={search} onSearch={setSearch} placeholder={t('Search by name or town')}>
        <Choice
          label={t('Category')}
          value={type}
          onChange={setType}
          options={[
            ['', t('All')],
            ['activity', t('Activity')],
            ['restaurant', t('Restaurant')],
          ]}
        />
        <Choice
          label={t('Sort by')}
          value={sort}
          onChange={setSort}
          options={[
            ['name', t('Name')],
            ['town', t('Town')],
            ['rating', t('Highest rating')],
            ['newest', t('Newest first')],
          ]}
        />
      </ListToolbar>
      {places.error && <LoadError error={places.error} onRetry={places.reload} />}
      {places.loading && !places.places.length && <ListSkeleton />}
      {!places.loading && !places.error && !filtered.length && (
        <EmptyState
          icon={<MapPin size={22} />}
          title={t(places.places.length ? 'No places match' : 'No places yet')}
        >
          {t(
            places.places.length
              ? 'Try another search or clear the filters.'
              : 'Add the first place to start the guide.',
          )}
        </EmptyState>
      )}
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((place) => (
            <li
              key={place.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{place.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} aria-hidden />
                    {place.location}
                  </span>
                  <Badge tone="slate">
                    {t(place.type === 'restaurant' ? 'Restaurant' : 'Activity')}
                  </Badge>
                  {place.access === 'restricted' && (
                    <Badge tone="red">{t('Restricted access')}</Badge>
                  )}
                </p>
              </div>
              <button
                onClick={() => setDeleting(place)}
                aria-label={t('Delete {name}', { name: place.name })}
                className="icon-button shrink-0 text-red-700"
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} perPage={PER_PAGE} total={filtered.length} onPage={setPage} />
      {adding && (
        <AddPlace
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={t('Delete this place?')}
          confirmLabel={t('Confirm deletion')}
          onConfirm={() => remove(deleting)}
          onClose={() => setDeleting(null)}
        >
          {t('Delete {name}? This also removes it from everyone’s saved lists.', {
            name: deleting.name,
          })}
        </ConfirmDialog>
      )}
    </>
  );
}

const emptyForm = {
  name: '',
  type: 'activity',
  location: '',
  description: '',
  description_fr: '',
  lat: '',
  lng: '',
  rating: '',
  hours: '',
  tags: '',
  image: '',
};

function AddPlace({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (field: keyof typeof form, value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));
  async function add(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api<Place>('/places', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          lat: Number(form.lat),
          lng: Number(form.lng),
          rating: form.rating ? Number(form.rating) : undefined,
          tags: [
            ...new Set(
              form.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            ),
          ],
          image: form.image || undefined,
        }),
      });
      toast('Place added. It is now available in search and on the map.');
      onAdded();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={t('Add a place')} onClose={onClose} side>
      <form onSubmit={add} className="space-y-4 p-5 sm:p-6">
        <label className="field-label">
          {t('Name')}
          <input
            required
            maxLength={160}
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            className="field-input"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            {t('Category')}
            <select
              value={form.type}
              onChange={(event) => update('type', event.target.value)}
              className="field-input"
            >
              <option value="activity">{t('Activity')}</option>
              <option value="restaurant">{t('Restaurant')}</option>
            </select>
          </label>
          <label className="field-label">
            {t('Town')}
            <input
              required
              maxLength={160}
              value={form.location}
              onChange={(event) => update('location', event.target.value)}
              className="field-input"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="field-label">
            {t('Latitude')}
            <input
              required
              type="number"
              step="any"
              min="-90"
              max="90"
              value={form.lat}
              onChange={(event) => update('lat', event.target.value)}
              className="field-input"
            />
          </label>
          <label className="field-label">
            {t('Longitude')}
            <input
              required
              type="number"
              step="any"
              min="-180"
              max="180"
              value={form.lng}
              onChange={(event) => update('lng', event.target.value)}
              className="field-input"
            />
          </label>
        </div>
        <label className="field-label">
          {t('Description')}
          <textarea
            required
            rows={3}
            maxLength={3000}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          {t('Description in French (optional)')}
          <textarea
            rows={3}
            maxLength={3000}
            value={form.description_fr}
            onChange={(event) => update('description_fr', event.target.value)}
            className="field-input"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            {t('Guide rating (optional)')}
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={form.rating}
              onChange={(event) => update('rating', event.target.value)}
              className="field-input"
            />
          </label>
          <label className="field-label">
            {t('Opening hours (optional)')}
            <input
              maxLength={200}
              value={form.hours}
              onChange={(event) => update('hours', event.target.value)}
              className="field-input"
            />
          </label>
        </div>
        <label className="field-label">
          {t('Tags, separated by commas')}
          <input
            value={form.tags}
            onChange={(event) => update('tags', event.target.value)}
            className="field-input"
            placeholder={t('Hiking, Nature, Family')}
          />
        </label>
        <label className="field-label">
          {t('Image URL (optional)')}
          <input
            type="url"
            pattern="https://.*"
            maxLength={2000}
            value={form.image}
            onChange={(event) => update('image', event.target.value)}
            className="field-input"
            placeholder="https://…"
          />
        </label>
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        <button disabled={busy} className="primary-button w-full">
          {busy ? t('Saving…') : t('Add place')}
        </button>
      </form>
    </Modal>
  );
}
