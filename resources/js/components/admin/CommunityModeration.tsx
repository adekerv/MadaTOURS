import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
type Item = {
  id: number;
  user_id: string;
  place_id: number;
  body: string;
  rating?: number;
  reason?: string;
};
export function CommunityModeration({ onRatingChanged }: { onRatingChanged: () => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<{ reviews: Item[]; comments: Item[]; blocked: Item[] }>();
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [blocking, setBlocking] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api<typeof data>(`/moderation/community?offset=${offset}`, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [offset, revision]);
  async function act(action: string, payload: object) {
    setBusy(true);
    setError('');
    try {
      await api(`/community/${action}`, { method: 'POST', body: JSON.stringify(payload) });
      setEditing(null);
      setBlocking(null);
      setRevision((v) => v + 1);
      if (action === 'moderate-review' || action === 'delete-review') onRatingChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 border-t border-slate-200 pt-5">
      <h3 className="text-xl font-bold">{t('Community moderation')}</h3>
      {error && (
        <p role="alert" className="error-message">
          {t(error)}
        </p>
      )}
      {editing && (
        <form
          className="space-y-3 rounded-xl bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act('moderate-review', {
              id: editing.id,
              body: editing.body,
              rating: editing.rating,
            });
          }}
        >
          <label className="field-label">
            {t('Review text')}
            <textarea
              className="field-input"
              required
              minLength={10}
              maxLength={2000}
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            />
          </label>
          <label className="field-label">
            {t('Rating')}
            <input
              className="field-input"
              type="number"
              min={1}
              max={5}
              required
              value={editing.rating}
              onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })}
            />
          </label>
          <button disabled={busy} className="primary-button">
            {t('Save moderation')}
          </button>
          <button type="button" className="secondary-button" onClick={() => setEditing(null)}>
            {t('Cancel')}
          </button>
        </form>
      )}
      {blocking && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void act('block-comments', { userId: blocking, reason });
          }}
        >
          <label className="field-label">
            {t('Reason for restricting comments')}
            <input
              className="field-input"
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button disabled={busy} className="primary-button">
            {t('Confirm restriction')}
          </button>
          <button type="button" className="secondary-button" onClick={() => setBlocking(null)}>
            {t('Cancel')}
          </button>
        </form>
      )}
      {(['reviews', 'comments'] as const).map((kind) => (
        <div key={kind} className="space-y-3">
          <h4 className="font-semibold">{t(kind === 'reviews' ? 'Reviews' : 'Place comments')}</h4>
          {data?.[kind].map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="break-all text-xs text-slate-500">
                {t('Place #{id}', { id: item.place_id })} · {item.user_id}
              </p>
              <p className="my-2 whitespace-pre-wrap">{item.body}</p>
              <div className="flex flex-wrap gap-2">
                {kind === 'reviews' && (
                  <button className="secondary-button" onClick={() => setEditing(item)}>
                    {t('Edit review')}
                  </button>
                )}
                <button
                  disabled={busy}
                  className="secondary-button text-red-700"
                  onClick={() =>
                    void act(kind === 'reviews' ? 'delete-review' : 'delete-comment', {
                      id: item.id,
                    })
                  }
                >
                  {t('Delete')}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setReason('');
                    setBlocking(item.user_id);
                  }}
                >
                  {t('Restrict comments')}
                </button>
              </div>
            </article>
          ))}
        </div>
      ))}
      <h4 className="font-semibold">{t('Blocked commenters')}</h4>
      {data?.blocked.map((item) => (
        <div className="rounded-xl bg-slate-50 p-3" key={item.user_id}>
          <p className="break-all text-xs">{item.user_id}</p>
          <p className="text-sm">{item.reason}</p>
          <button
            disabled={busy}
            className="secondary-button mt-2"
            onClick={() => void act('unblock-comments', { userId: item.user_id })}
          >
            {t('Restore commenting')}
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        {offset > 0 && (
          <button className="secondary-button" onClick={() => setOffset(Math.max(0, offset - 20))}>
            {t('Previous')}
          </button>
        )}
        {data && Object.values(data).some((rows) => rows.length === 20) && (
          <button className="secondary-button" onClick={() => setOffset(offset + 20)}>
            {t('Next')}
          </button>
        )}
      </div>
    </section>
  );
}
