import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, Route, ExternalLink } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { useDayTrips } from '../../hooks/useDayTrips';
import { legDirections, moveStop, tripSummary, type DayTrip } from '../../lib/trips';
import type { Place } from '../../types';
export function DayPlanner({
  places,
  savedPlaces,
  onClose,
}: {
  places: Place[];
  savedPlaces: Place[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { trips, saveTrips, storageError } = useDayTrips();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const trip = trips.find((item) => item.id === selected);
  const update = (next: DayTrip) =>
    saveTrips(
      trips.map((item) =>
        item.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : item,
      ),
    );
  const create = () => {
    if (trips.length >= 20) return;
    const next: DayTrip = {
      id: crypto.randomUUID(),
      name: t('New day trip'),
      date: '',
      notes: '',
      stops: [],
      updatedAt: new Date().toISOString(),
    };
    saveTrips([...trips, next]);
    setSelected(next.id);
    setConfirmDelete(false);
  };
  const savedIds = new Set(savedPlaces.map((place) => place.id));
  const choices = places
    .filter(
      (place) => place.access !== 'restricted' && !trip?.stops.some((s) => s.placeId === place.id),
    )
    .sort(
      (a, b) =>
        Number(savedIds.has(b.id)) - Number(savedIds.has(a.id)) || a.name.localeCompare(b.name),
    );
  const summary = trip ? tripSummary(trip, places) : null;
  return (
    <Modal title={t('Your day trips')} onClose={onClose} wide>
      <div className="space-y-5 p-5 sm:p-7">
        <p className="text-sm text-slate-600">
          {t('Arrange your stops, add notes, and keep your plan on this device.')}
        </p>
        {storageError && (
          <p role="alert" className="error-message">
            {t('Device storage is unavailable. Changes will be lost when you close the app.')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {trips.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelected(item.id);
                setConfirmDelete(false);
              }}
              aria-pressed={selected === item.id}
              className={
                selected === item.id
                  ? 'primary-button max-w-full break-words'
                  : 'secondary-button max-w-full break-words'
              }
            >
              {item.name || t('New day trip')}
            </button>
          ))}
          <button
            disabled={trips.length >= 20}
            onClick={create}
            className="secondary-button flex items-center gap-2"
          >
            <Plus size={18} />
            {t('New day trip')}
          </button>
        </div>
        {trips.length >= 20 && (
          <p className="text-sm text-slate-600">
            {t('You can keep up to 20 day trips on this device.')}
          </p>
        )}
        {!trips.length && (
          <div className="rounded-2xl bg-orange-50 p-6">
            <Route className="mb-3 text-orange-700" />
            <h3 className="font-bold">{t('No day trips yet')}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {t('Create your first plan, then add places in the order you want to visit.')}
            </p>
          </div>
        )}
        {trip && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                {t('Trip name')}
                <input
                  className="field-input"
                  maxLength={100}
                  value={trip.name}
                  onChange={(e) => {
                    update({ ...trip, name: e.target.value });
                  }}
                />
              </label>
              <label className="field-label">
                {t('Date (optional)')}
                <input
                  className="field-input min-w-0"
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  value={trip.date}
                  onChange={(e) => {
                    if (e.target.validity.valid) update({ ...trip, date: e.target.value });
                  }}
                />
              </label>
            </div>
            <label className="field-label">
              {t('Notes (optional)')}
              <textarea
                className="field-input"
                maxLength={2000}
                rows={3}
                value={trip.notes}
                onChange={(e) => update({ ...trip, notes: e.target.value })}
              />
            </label>
            <label className="field-label">
              {t('Add a stop')}
              <select
                className="field-input"
                aria-label={t('Add a stop')}
                aria-describedby="planner-stop-hint"
                value=""
                disabled={trip.stops.length >= 20 || !choices.length}
                onChange={(e) => {
                  const place = choices.find((p) => p.id === Number(e.target.value));
                  if (place)
                    update({ ...trip, stops: [...trip.stops, { placeId: place.id, minutes: 60 }] });
                }}
              >
                <option value="">{t('Choose a place')}</option>
                {choices.map((place) => (
                  <option key={place.id} value={place.id}>
                    {savedIds.has(place.id) ? '♥ ' : ''}
                    {place.name} · {place.location}
                  </option>
                ))}
              </select>
              <span id="planner-stop-hint" className="text-xs font-normal text-slate-500">
                {t('Saved places first')}
              </span>
            </label>
            {trip.stops.length >= 20 && (
              <p className="text-sm text-slate-600">
                {t('A maximum of 20 stops keeps each day manageable.')}
              </p>
            )}
            {!trip.stops.length && (
              <p className="rounded-2xl bg-slate-50 p-5 text-slate-600">
                {t('No stops yet. Add a place to begin.')}
              </p>
            )}
            <ol className="space-y-3">
              {trip.stops.map((stop, index) => {
                const place = places.find((p) => p.id === stop.placeId);
                const previous = places.find((p) => p.id === trip.stops[index - 1]?.placeId);
                const name = place?.name ?? t('Place no longer available');
                return (
                  <li key={stop.placeId} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold break-words">
                          {index + 1}. {name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">{place?.location}</p>
                      </div>
                      <div className="flex">
                        <button
                          className="icon-button"
                          disabled={index === 0}
                          aria-label={t('Move {name} up', { name })}
                          onClick={() => update(moveStop(trip, index, -1))}
                        >
                          <ArrowUp size={18} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={index === trip.stops.length - 1}
                          aria-label={t('Move {name} down', { name })}
                          onClick={() => update(moveStop(trip, index, 1))}
                        >
                          <ArrowDown size={18} />
                        </button>
                        <button
                          className="icon-button text-red-700"
                          aria-label={t('Remove {name}', { name })}
                          onClick={() =>
                            update({
                              ...trip,
                              stops: trip.stops.filter((s) => s.placeId !== stop.placeId),
                            })
                          }
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <label className="field-label mt-3">
                      {t('Visit duration (minutes)')}
                      <select
                        className="field-input"
                        value={stop.minutes}
                        onChange={(e) =>
                          update({
                            ...trip,
                            stops: trip.stops.map((s) =>
                              s.placeId === stop.placeId
                                ? { ...s, minutes: Number(e.target.value) }
                                : s,
                            ),
                          })
                        }
                      >
                        {[15, 30, 45, 60, 90, 120, 180, 240, 360].map((n) => (
                          <option value={n} key={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    {place && place.access !== 'restricted' && (
                      <a
                        href={legDirections(place, previous)}
                        rel="noopener noreferrer"
                        target="_blank"
                        className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 underline"
                      >
                        {t(previous ? 'Directions from previous stop' : 'Get directions')}
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
            {summary && trip.stops.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-orange-50 p-4">
                <p className="font-semibold">
                  {t('Visit time: {minutes} min', { minutes: summary.minutes })}
                </p>
                <p className="text-sm">
                  {t('Straight-line distance: {distance} km', {
                    distance: summary.distance.toFixed(1),
                  })}
                </p>
                <p className="text-sm text-slate-600">
                  {t(
                    'Travel time is not included. Open directions for road routes and current estimates.',
                  )}
                </p>
              </div>
            )}
            <p role="status" className="text-xs text-slate-500">
              {storageError ? '' : t('Saved on this device')}
            </p>
            {confirmDelete ? (
              <div className="space-y-3 rounded-2xl bg-red-50 p-4">
                <p>{t('Delete this trip from this device?')}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="primary-button bg-red-700"
                    onClick={() => {
                      saveTrips(trips.filter((item) => item.id !== trip.id));
                      setSelected(null);
                      setConfirmDelete(false);
                    }}
                  >
                    {t('Delete this trip')}
                  </button>
                  <button className="secondary-button" onClick={() => setConfirmDelete(false)}>
                    {t('Keep trip')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="secondary-button text-red-700"
                onClick={() => setConfirmDelete(true)}
              >
                {t('Delete this trip')}
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
