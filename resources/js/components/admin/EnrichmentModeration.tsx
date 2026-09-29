import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { api, errorMessage } from '../../lib/api';
import type { Place } from '../../types';
type Source = {
  place_id: number;
  url: string;
  enabled: boolean;
  checked_at: string | null;
  candidate_photo: { url: string; author?: string; license?: string; source: string } | null;
};
type Match = { place_id: number; status: string; candidate_ids: string[] };
type Log = {
  id: number;
  place_id: number;
  status: string;
  created_at: string;
  hours_updated: boolean;
  photo_found: boolean;
};
type Data = { sources: Source[]; matches: Match[]; logs: Log[] };
const statusLabels: Record<string, string> = {
  pending: 'Waiting for matching',
  matched: 'Google listing linked',
  review: 'Manual review needed',
  unmatched: 'No confident match',
  error: 'Matching failed; retry scheduled',
  excluded: 'Excluded from matching',
  updated: 'Hours updated',
  unchanged: 'No hours change',
  robots_denied: 'Source disallows automated access',
  unavailable: 'Source unavailable',
  no_match: 'No matching structured venue data',
  photo_approved: 'Photo approved',
};
export function EnrichmentModeration({
  places,
  onChanged,
}: {
  places: Place[];
  onChanged: () => void;
}) {
  const { t, language } = useI18n();
  const [data, setData] = useState<Data>();
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [placeId, setPlaceId] = useState('');
  const [url, setUrl] = useState('');
  const [googleId, setGoogleId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<Source | null>(null);
  const [author, setAuthor] = useState('');
  const [license, setLicense] = useState('');
  const [licenseUrl, setLicenseUrl] = useState('');
  const [rights, setRights] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<Data>(`/moderation/enrichment?offset=${offset}`, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [offset, revision]);
  async function write(action: string, values: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      await api(`/moderation/enrichment/${action}`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setRevision((v) => v + 1);
      setPhoto(null);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const name = (id: number) => places.find((p) => p.id === id)?.name || `#${id}`;
  return (
    <section className="space-y-5 pt-4">
      <p className="text-sm text-slate-600">
        {t(
          'Choose an official source for scheduled hours updates. Photos need a rights check before publication. Google matching retains Place IDs only.',
        )}
      </p>
      {error && (
        <p role="alert" className="error-message">
          {t(error)}
        </p>
      )}
      <label className="field-label">
        {t('Choose a place')}
        <select
          className="field-input"
          value={placeId}
          onChange={(e) => {
            setPlaceId(e.target.value);
            const p = places.find((p) => p.id === Number(e.target.value));
            setUrl(
              data?.sources.find((s) => s.place_id === p?.id)?.url || p?.sources?.[0]?.url || '',
            );
            setGoogleId(p?.googlePlaceId || '');
          }}
        >
          <option value="">{t('Choose a place')}</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {placeId && (
        <div className="grid gap-5 sm:grid-cols-2">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void write('source', { placeId: Number(placeId), url, enabled: true });
            }}
          >
            <label className="field-label">
              {t('Official source URL')}
              <input
                className="field-input"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <button disabled={busy} className="secondary-button">
              {t('Enable source updates')}
            </button>
          </form>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void write('google', {
                placeId: Number(placeId),
                placeIdGoogle: googleId || null,
                excluded: false,
              });
            }}
          >
            <label className="field-label">
              {t('Google Place ID')}
              <input
                className="field-input"
                value={googleId}
                pattern="[A-Za-z0-9_-]{10,255}"
                onChange={(e) => setGoogleId(e.target.value)}
              />
            </label>
            <p className="text-xs text-slate-500">
              {t(
                'Leave blank to queue matching. Confirm the business and entrance before linking an ID.',
              )}
            </p>
            <button disabled={busy} className="secondary-button">
              {t('Save Google match')}
            </button>
          </form>
        </div>
      )}
      <h3 className="font-bold">{t('Google matching queue')}</h3>
      {data?.matches.map((m) => (
        <article key={m.place_id} className="rounded-xl border border-slate-200 p-3">
          <p className="font-semibold">{name(m.place_id)}</p>
          <p className="text-sm text-slate-600">{t(statusLabels[m.status] || m.status)}</p>
          <div className="flex flex-wrap gap-2">
            {m.candidate_ids.map((id) => (
              <a
                key={id}
                className="secondary-button break-all text-sm"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name(m.place_id))}&query_place_id=${encodeURIComponent(id)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('Review candidate')} · {id.slice(0, 8)}…
              </a>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="secondary-button"
              onClick={() => {
                setPlaceId(String(m.place_id));
                setGoogleId('');
              }}
            >
              {t('Edit match')}
            </button>
            <button
              disabled={busy}
              className="secondary-button"
              onClick={() => void write('google', { placeId: m.place_id, excluded: true })}
            >
              {t('Exclude from matching')}
            </button>
          </div>
        </article>
      ))}
      <h3 className="font-bold">{t('Official source updates')}</h3>
      {data?.sources.map((s) => (
        <article key={s.place_id} className="rounded-xl border border-slate-200 p-3">
          <p className="font-semibold">{name(s.place_id)}</p>
          <a
            className="inline-flex min-h-11 items-center break-all text-sm underline"
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {s.url}
          </a>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              className="secondary-button"
              onClick={() =>
                void write('source', { placeId: s.place_id, url: s.url, enabled: !s.enabled })
              }
            >
              {t(s.enabled ? 'Pause updates' : 'Enable source updates')}
            </button>
            {s.candidate_photo && (
              <button
                className="secondary-button"
                onClick={() => {
                  setPhoto(s);
                  setAuthor(s.candidate_photo?.author || '');
                  setLicense('');
                  setLicenseUrl(s.candidate_photo?.license || '');
                  setRights(false);
                }}
              >
                {t('Review photo rights')}
              </button>
            )}
          </div>
        </article>
      ))}
      {photo?.candidate_photo && (
        <form
          className="space-y-3 rounded-xl bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void write('photo', { placeId: photo.place_id, author, license, licenseUrl, rights });
          }}
        >
          <a
            className="inline-flex min-h-11 items-center underline"
            href={photo.candidate_photo.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('Open candidate photo')}
          </a>
          <label className="field-label">
            {t('Photo author')}
            <input
              className="field-input"
              required
              maxLength={200}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </label>
          <label className="field-label">
            {t('Photo license')}
            <input
              className="field-input"
              required
              maxLength={100}
              value={license}
              onChange={(e) => setLicense(e.target.value)}
            />
          </label>
          <label className="field-label">
            {t('License or permission URL')}
            <input
              className="field-input"
              required
              type="url"
              value={licenseUrl}
              onChange={(e) => setLicenseUrl(e.target.value)}
            />
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5"
              required
              checked={rights}
              onChange={(e) => setRights(e.target.checked)}
            />
            {t('I verified permission to display this photo and its required attribution.')}
          </label>
          <button disabled={busy} className="primary-button">
            {t('Approve photo')}
          </button>
        </form>
      )}
      <h3 className="font-bold">{t('Recent ingestion results')}</h3>
      {data?.logs.map((log) => (
        <p className="text-sm text-slate-600" key={log.id}>
          {name(log.place_id)} · {t(statusLabels[log.status] || log.status)} ·{' '}
          {new Date(log.created_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB', {
            timeZone: 'America/Martinique',
          })}
        </p>
      ))}
      <div className="flex gap-2">
        {offset > 0 && (
          <button className="secondary-button" onClick={() => setOffset(Math.max(0, offset - 20))}>
            {t('Previous')}
          </button>
        )}
        {data && Math.max(data.sources.length, data.matches.length, data.logs.length) === 20 && (
          <button className="secondary-button" onClick={() => setOffset(offset + 20)}>
            {t('Next')}
          </button>
        )}
      </div>
    </section>
  );
}
