import { useEffect, useState, type FormEvent } from 'react';
import { Trash2, Plus, MapPin } from 'lucide-react';
import type { Place, User } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { normalizePlace } from '../../lib/places-utils';
import { Modal } from '../ui/Modal';
const emptyForm = {
  name: '',
  type: 'activity',
  location: '',
  description: '',
  lat: '',
  lng: '',
  rating: '',
  hours: '',
  tags: '',
  image: '',
};
export function AdminDashboard({
  user,
  onClose,
  onRefreshPlaces,
}: {
  user: User;
  onClose: () => void;
  onRefreshPlaces: () => void;
}) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletePlace, setDeletePlace] = useState<Place | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<unknown[]>('/places', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setPlaces(data.map(normalizePlace));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  const update = (field: keyof typeof form, value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));
  async function add(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const place = await api<Place>('/places', {
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
      setPlaces((previous) => [...previous, normalizePlace(place)]);
      setForm(emptyForm);
      setNotice('Place added. It is now available in search and on the map.');
      onRefreshPlaces();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deletePlace || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/places/${deletePlace.id}`, { method: 'DELETE' });
      setPlaces((previous) => previous.filter((place) => place.id !== deletePlace.id));
      setNotice('Place deleted.');
      setDeletePlace(null);
      onRefreshPlaces();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Manage places" onClose={onClose} wide>
      <div className="space-y-7 p-5 sm:p-7">
        <p className="break-all text-sm text-slate-600">Signed in as {user.email}</p>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
            {notice}
          </p>
        )}
        <section>
          <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
            <Plus size={21} />
            Add a place
          </h3>
          <form onSubmit={add} className="space-y-4">
            <label className="field-label">
              Name
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
                Category
                <select
                  value={form.type}
                  onChange={(event) => update('type', event.target.value)}
                  className="field-input"
                >
                  <option value="activity">Activity</option>
                  <option value="restaurant">Restaurant</option>
                </select>
              </label>
              <label className="field-label">
                Town
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
                Latitude
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
                Longitude
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
              Description
              <textarea
                required
                rows={3}
                maxLength={3000}
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                className="field-input"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                Guide rating (optional)
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
                Opening hours (optional)
                <input
                  maxLength={200}
                  value={form.hours}
                  onChange={(event) => update('hours', event.target.value)}
                  className="field-input"
                />
              </label>
            </div>
            <label className="field-label">
              Tags, separated by commas
              <input
                value={form.tags}
                onChange={(event) => update('tags', event.target.value)}
                className="field-input"
                placeholder="Hiking, Nature, Family"
              />
            </label>
            <label className="field-label">
              Image URL (optional)
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
            <button disabled={busy} className="primary-button w-full">
              {busy ? 'Saving…' : 'Add place'}
            </button>
          </form>
        </section>
        <section className="border-t border-slate-200 pt-6">
          <h3 className="mb-4 text-xl font-bold">Places ({places.length})</h3>
          {loading && <p role="status">Loading places…</p>}
          {deletePlace && (
            <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-900">
                Delete <strong>{deletePlace.name}</strong>? This also removes it from everyone’s
                saved lists.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => void remove()}
                  disabled={busy}
                  className="primary-button bg-red-700"
                >
                  Confirm deletion
                </button>
                <button
                  onClick={() => setDeletePlace(null)}
                  disabled={busy}
                  className="secondary-button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <ul className="space-y-2">
            {places.map((place) => (
              <li
                key={place.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{place.name}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                    <MapPin size={13} />
                    {place.location}
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => {
                    setDeletePlace(place);
                    setError('');
                  }}
                  aria-label={`Delete ${place.name}`}
                  className="icon-button shrink-0 text-red-700"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
