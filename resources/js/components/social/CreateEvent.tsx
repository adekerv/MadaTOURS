import { useState } from 'react';
import type { Place } from '../../types';
import { useI18n } from '../../i18n/I18nProvider';
import type { SocialAction } from './types';
export function CreateEvent({
  places,
  act,
  busy,
}: {
  places: Place[];
  act: SocialAction;
  busy: boolean;
}) {
  const { t } = useI18n();
  const [placeId, setPlaceId] = useState('');
  return (
    <details className="rounded-2xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-bold">{t('Create a meet-up')}</summary>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          void act('create-event', {
            title: data.get('title'),
            description: data.get('description'),
            placeId: placeId ? Number(placeId) : null,
            location: data.get('location') || null,
            lat: placeId ? null : Number(data.get('lat')),
            lng: placeId ? null : Number(data.get('lng')),
            startsAt: new Date(`${data.get('startsAt')}:00-04:00`).toISOString(),
            price: Number(data.get('price')),
            capacity: Number(data.get('capacity')),
            lifetimeHours: Number(data.get('lifetimeHours')),
          }).then((saved) => {
            if (saved) {
              form.reset();
              setPlaceId('');
            }
          });
        }}
      >
        <label className="field-label">
          {t('Meet-up title')}
          <input name="title" className="field-input" required minLength={3} maxLength={120} />
        </label>
        <label className="field-label">
          {t('Meeting place')}
          <select
            className="field-input"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
          >
            <option value="">{t('Custom meeting location')}</option>
            {places
              .filter((p) => p.access !== 'restricted')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.location}
                </option>
              ))}
          </select>
        </label>
        {!placeId && (
          <>
            <label className="field-label">
              {t('Address')}
              <input
                name="location"
                className="field-input"
                required
                minLength={3}
                maxLength={200}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field-label">
                {t('Latitude')}
                <input
                  name="lat"
                  className="field-input"
                  type="number"
                  step="any"
                  required
                  min="14.35"
                  max="14.95"
                />
              </label>
              <label className="field-label">
                {t('Longitude')}
                <input
                  name="lng"
                  className="field-input"
                  type="number"
                  step="any"
                  required
                  min="-61.3"
                  max="-60.75"
                />
              </label>
            </div>
          </>
        )}
        <label className="field-label">
          {t('Date and time (Martinique)')}
          <input name="startsAt" type="datetime-local" className="field-input" required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field-label">
            {t('Price per person (€)')}
            <input
              name="price"
              type="number"
              min="0"
              max="10000"
              step="0.01"
              defaultValue="0"
              className="field-input"
              required
            />
          </label>
          <label className="field-label">
            {t('Capacity, including you')}
            <input
              name="capacity"
              type="number"
              min="2"
              max="100"
              defaultValue="4"
              className="field-input"
              required
            />
          </label>
        </div>
        <label className="field-label">
          {t('Listing stays live for')}
          <select name="lifetimeHours" defaultValue="24" className="field-input">
            {[3, 6, 24, 168].map((n) => (
              <option key={n} value={n}>
                {t(n === 168 ? 'One week' : n === 24 ? 'One day' : '{count} hours', { count: n })}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          {t('Describe the plan')}
          <textarea
            name="description"
            className="field-input"
            required
            minLength={20}
            maxLength={2000}
            rows={3}
          />
        </label>
        <p className="text-xs text-slate-600">
          {t('MadaTours does not collect event payments. Confirm arrangements with the host.')}
        </p>
        <button disabled={busy} className="primary-button">
          {t('Publish meet-up')}
        </button>
      </form>
    </details>
  );
}
