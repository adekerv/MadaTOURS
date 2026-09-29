import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { api, errorMessage } from '../../lib/api';
import type { SubmissionData, Submission } from '../submissions/PlaceSubmissions';
export function SubmissionModeration({ onPublished }: { onPublished: () => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<SubmissionData>();
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Submission | null>(null);
  const [en, setEn] = useState('');
  const [fr, setFr] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api<SubmissionData>(`/submissions?moderation=1&offset=${offset}`, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [offset, revision]);
  async function decide(action: 'approve' | 'reject') {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      await api(`/submissions/${action}`, {
        method: 'POST',
        body: JSON.stringify({ id: editing.id, description: en, descriptionFr: fr, reason }),
      });
      setEditing(null);
      setRevision((v) => v + 1);
      if (action === 'approve') onPublished();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 pt-4">
      <h3 className="text-lg font-bold">{t('Place submissions')}</h3>
      {error && (
        <p role="alert" className="error-message">
          {t(error)}
        </p>
      )}
      {data?.submissions.map((item) => (
        <article key={item.id} className="rounded-xl border border-slate-200 p-4">
          {item.photoUrl && (
            <img
              src={item.photoUrl}
              alt={item.name}
              loading="lazy"
              className="mb-3 h-40 w-full rounded-xl object-cover"
            />
          )}
          <h4 className="font-bold">{item.name}</h4>
          <p className="text-sm">
            {item.address} · {item.lat}, {item.lng}
          </p>
          <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          {item.source_url && (
            <a
              className="inline-flex min-h-11 items-center text-sm text-orange-800 underline"
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('Review source')}
            </a>
          )}
          <button
            className="secondary-button mt-2"
            onClick={() => {
              setEditing(item);
              setEn(item.language === 'en' ? item.description : '');
              setFr(item.language === 'fr' ? item.description : '');
              setReason('');
            }}
          >
            {t('Review submission')}
          </button>
        </article>
      ))}
      {editing && (
        <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
          <h4 className="font-bold">{editing.name}</h4>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void decide('approve');
            }}
          >
            <label className="field-label">
              {t('English description')}
              <textarea
                className="field-input"
                required
                minLength={40}
                maxLength={3000}
                value={en}
                onChange={(e) => setEn(e.target.value)}
              />
            </label>
            <label className="field-label">
              {t('French description')}
              <textarea
                className="field-input"
                required
                minLength={40}
                maxLength={3000}
                value={fr}
                onChange={(e) => setFr(e.target.value)}
              />
            </label>
            <button disabled={busy} className="primary-button">
              {t('Approve and publish')}
            </button>
          </form>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void decide('reject');
            }}
          >
            <label className="field-label">
              {t('Reason for rejection')}
              <textarea
                className="field-input"
                required
                minLength={10}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button disabled={busy} className="secondary-button text-red-700">
              {t('Reject and notify')}
            </button>
          </form>
          <button className="secondary-button" onClick={() => setEditing(null)}>
            {t('Cancel')}
          </button>
        </div>
      )}
      <div className="flex gap-2">
        {offset > 0 && (
          <button className="secondary-button" onClick={() => setOffset(Math.max(0, offset - 20))}>
            {t('Previous')}
          </button>
        )}
        {data?.submissions.length === 20 && (
          <button className="secondary-button" onClick={() => setOffset(offset + 20)}>
            {t('Next')}
          </button>
        )}
      </div>
    </section>
  );
}
