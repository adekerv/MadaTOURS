import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, LocateFixed, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useDayTrips } from '../../hooks/useDayTrips';
import type { Place, UserLocation } from '../../types';
import { deviceLocation } from '../../lib/geolocation';
import { routeSchedule, suggestRoute, type TravelMode } from '../../lib/route-suggestion';
import { api, errorMessage } from '../../lib/api';
import { Modal } from '../ui/Modal';
export function RouteSuggestion({
  places,
  onClose,
  onSaved,
}: {
  places: Place[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { trips, saveTrips } = useDayTrips();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<UserLocation | null>(null);
  const [mode, setMode] = useState<TravelMode>('drive');
  const [date, setDate] = useState(() =>
    new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10),
  );
  const [start, setStart] = useState('09:00');
  const [stops, setStops] = useState<{ placeId: number; minutes: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [share, setShare] = useState(false);
  const [addId, setAddId] = useState('');
  const day = new Date(`${date}T12:00:00-04:00`).getUTCDay();
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const schedule = useMemo(
    () => (origin ? routeSchedule(stops, places, origin, mode, day, startMinutes) : []),
    [stops, places, origin, mode, day, startMinutes],
  );
  async function suggest() {
    setBusy(true);
    setError('');
    try {
      const location = origin || (await deviceLocation());
      setOrigin(location);
      const next = suggestRoute(places, location, mode, day, startMinutes);
      setStops(next.map(({ placeId, minutes }) => ({ placeId, minutes })));
      if (!next.length)
        setError('No suitable stops nearby. Try driving or choose another starting time.');
    } catch {
      setError(
        'Could not access your location. Check device permissions, choose a point on the map, or browse Martinique without sharing your location.',
      );
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, direction: number) {
    setStops((previous) => {
      const next = [...previous];
      const target = index + direction;
      if (target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function save() {
    setError('');
    if (!savedId && trips.length >= 20) {
      setError('You can save up to 20 day trips. Remove an old trip first.');
      return;
    }
    setBusy(true);
    const tripId = savedId || crypto.randomUUID();
    const stored = saveTrips([
      ...trips.filter((trip) => trip.id !== tripId),
      {
        id: tripId,
        name: t('My suggested day trip'),
        date,
        startTime: start,
        notes: t(
          'Travel times are planning estimates, not live road directions. Confirm opening hours before leaving.',
        ),
        stops,
        updatedAt: new Date().toISOString(),
      },
    ]);
    if (!stored) {
      setError('Device storage is unavailable. Changes will be lost when you close the app.');
      setBusy(false);
      return;
    }
    setSavedId(tripId);
    if (share) {
      try {
        await api('/social/share-plan', {
          method: 'POST',
          body: JSON.stringify({ placeIds: stops.map((s) => s.placeId) }),
        });
      } catch (e) {
        setError(
          t('Trip saved on this device. Sharing failed: {error}', { error: t(errorMessage(e)) }),
        );
        setBusy(false);
        return;
      }
    }
    onSaved();
  }
  const clock = (minutes: number) =>
    `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return (
    <Modal title={t('Suggest a trip route')} wide onClose={onClose}>
      <div className="space-y-5 p-5 sm:p-7">
        <p className="text-sm text-slate-600">
          {t(
            'Use your location to group nearby stops, allow travel time and fit a meal around lunch. Your device coordinates stay on this device.',
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="field-label">
            {t('Travel mode')}
            <select
              className="field-input"
              value={mode}
              onChange={(e) => setMode(e.target.value as TravelMode)}
            >
              <option value="drive">{t('Driving')}</option>
              <option value="walk">{t('Walking')}</option>
            </select>
          </label>
          <label className="field-label">
            {t('Date')}
            <input
              className="field-input"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field-label">
            {t('Start time (Martinique)')}
            <input
              className="field-input"
              type="time"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
        </div>
        <button
          disabled={busy || !date || !start}
          className="primary-button flex items-center gap-2"
          onClick={() => void suggest()}
        >
          <LocateFixed size={18} />
          {t(origin ? 'Suggest another route' : 'Use my location and suggest a route')}
        </button>
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        {schedule.map((stop, index) => {
          const place = places.find((p) => p.id === stop.placeId)!;
          return (
            <article className="rounded-2xl border border-slate-200 p-4" key={stop.placeId}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-orange-800">
                    {clock(stop.arrival)} · {t('{count} min travel', { count: stop.travel })}
                  </p>
                  <h3 className="font-bold">{place.name}</h3>
                  <p className="text-xs text-slate-500">{place.location}</p>
                </div>
                <div className="flex">
                  <button
                    className="icon-button"
                    disabled={index === 0}
                    aria-label={t('Move {name} up', { name: place.name })}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={18} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={index === stops.length - 1}
                    aria-label={t('Move {name} down', { name: place.name })}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={t('Remove {name}', { name: place.name })}
                    onClick={() => setStops(stops.filter((s) => s.placeId !== stop.placeId))}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <p className={`mt-2 text-sm ${stop.closed ? 'text-red-700' : 'text-slate-600'}`}>
                {t(stop.reason)}
              </p>
              {!stop.hoursKnown && (
                <p className="mt-1 text-xs text-slate-500">
                  {t('Hours unknown; confirm with the venue before leaving.')}
                </p>
              )}
              <label className="field-label mt-3">
                {t('Visit duration (minutes)')}
                <input
                  className="field-input"
                  type="number"
                  min={5}
                  max={240}
                  step={5}
                  value={stop.minutes}
                  onChange={(e) =>
                    setStops(
                      stops.map((s) =>
                        s.placeId === stop.placeId
                          ? { ...s, minutes: Math.max(5, Math.min(240, Number(e.target.value))) }
                          : s,
                      ),
                    )
                  }
                />
              </label>
            </article>
          );
        })}
        {origin && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (addId && stops.length < 15) {
                setStops([...stops, { placeId: Number(addId), minutes: 60 }]);
                setAddId('');
              }
            }}
          >
            <label className="field-label flex-1">
              {t('Add a place')}
              <select
                className="field-input"
                required
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
              >
                <option value="">{t('Choose a place')}</option>
                {places
                  .filter(
                    (p) => p.access !== 'restricted' && !stops.some((s) => s.placeId === p.id),
                  )
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name} · {p.location}
                    </option>
                  ))}
              </select>
            </label>
            <button disabled={stops.length >= 15} className="secondary-button">
              {t('Add stop')}
            </button>
          </form>
        )}
        {!!schedule.length && (
          <>
            <p className="font-semibold">
              {t('Estimated finish: {time}', {
                time: clock(schedule.at(-1)!.arrival + schedule.at(-1)!.minutes),
              })}
            </p>
            <p className="text-xs text-slate-500">
              {t(
                'Travel times are planning estimates, not live road directions. Confirm opening hours before leaving.',
              )}
            </p>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={share}
                onChange={(e) => setShare(e.target.checked)}
                className="size-5 accent-orange-700"
              />
              {t('Share these planned stops with accepted followers')}
            </label>
            <button disabled={busy} className="primary-button w-full" onClick={() => void save()}>
              {t('Save to my day planner')}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
