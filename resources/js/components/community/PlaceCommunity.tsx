import { useEffect, useState } from 'react';
import { Star, MapPin } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import type { User } from '../../types';
type Review = {
  id: number;
  user_id: string;
  rating: number;
  body: string;
  display_name: string;
  visits: number;
  moderated: boolean;
};
type Comment = { id: number; user_id: string; body: string; display_name: string };
type Feed = { reviews: Review[]; comments: Comment[]; rating?: number; count: number };
export function PlaceCommunity({
  placeId,
  user,
  onLogin,
  onRatingChanged,
}: {
  placeId: number;
  user: User | null;
  onLogin: () => void;
  onRatingChanged: () => void;
}) {
  const { t } = useI18n();
  const userId = user?.id;
  const [ownRetry, setOwnRetry] = useState(0);
  const [ownLoaded, setOwnLoaded] = useState(!userId);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api<Feed>(`/places/${placeId}/community?offset=${offset}`, { signal: controller.signal })
      .then(setFeed)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [placeId, offset, revision]);
  useEffect(() => {
    if (!userId) return;
    setOwnLoaded(false);
    const controller = new AbortController();
    api<{ review: Review | null }>(`/places/${placeId}/my-review`, { signal: controller.signal })
      .then(({ review }) => {
        setBody(review?.body || '');
        setRating(review?.rating || 5);
        setOwnLoaded(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [userId, placeId, ownRetry]);
  async function write(action: string, data: object, success: string) {
    if (!user) {
      onLogin();
      return;
    }
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/community/${action}`, {
        method: 'POST',
        body: JSON.stringify({ placeId, ...data }),
      });
      setNotice(success);
      setRevision((v) => v + 1);
      if (action === 'review' || action === 'delete-review') onRatingChanged();
      if (action === 'delete-review') {
        setBody('');
        setRating(5);
      }
      if (action === 'comment') setComment('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="community" className="space-y-4 border-t border-slate-200 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold">{t('MadaTours community')}</h3>
        <span className="flex items-center gap-1 font-semibold text-orange-800">
          <Star size={18} />
          {feed?.rating ? `${Number(feed.rating).toFixed(1)} / 5` : t('Be the first to rate')}{' '}
          {feed?.count ? `(${feed.count})` : ''}
        </span>
      </div>
      <p className="text-sm text-slate-600">
        {t('Reviews are public and linked to your display name. Share your own experience.')}
      </p>
      <button
        disabled={busy}
        className="secondary-button flex items-center gap-2"
        onClick={() =>
          void write(
            'checkin',
            {},
            'Visit recorded. Only one check-in per place per day is counted.',
          )
        }
      >
        <MapPin size={18} />
        {t("I've been here")}
      </button>
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
          {t(notice)}
        </p>
      )}
      {error && (
        <div role="alert" className="error-message">
          {t(error)}{' '}
          <button className="underline" onClick={() => { setRevision((v) => v + 1); setOwnRetry(v=>v+1); }}>
            {t('Retry')}
          </button>
        </div>
      )}
      {user ? (
        <form
          className="space-y-3 rounded-2xl bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void write(
              'review',
              { rating, body },
              'Your review is live. You can edit it here at any time.',
            );
          }}
        >
          <fieldset disabled={!ownLoaded || busy} className="space-y-3">
          <label className="field-label">
            {t('Your rating')}
            <select
              className="field-input"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option value={n} key={n}>
                  {t('{count} stars', { count: n })}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            {t('Your review')}
            <textarea
              className="field-input"
              required
              minLength={10}
              maxLength={2000}
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button className="primary-button" disabled={busy}>
            {t('Publish or update review')}
          </button>
          </fieldset>
        </form>
      ) : (
        <button className="primary-button" onClick={onLogin}>
          {t('Sign in to review or check in')}
        </button>
      )}
      {!feed && !error && (
        <div role="status" className="skeleton h-28 rounded-2xl">
          <span className="sr-only">{t('Loading reviews…')}</span>
        </div>
      )}
      {feed?.reviews.map((review) => (
        <article key={review.id} className="rounded-2xl border border-slate-200 p-4">
          <p className="font-semibold">
            {t('{name} rated this {count} stars', {
              name: review.display_name,
              count: review.rating,
            })}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t('Visited {count} times this year', { count: review.visits })}
            {review.moderated ? ` · ${t('Edited by a moderator')}` : ''}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{review.body}</p>
          {user?.id === review.user_id && (
            <button
              disabled={busy}
              className="mt-2 text-sm text-red-700 underline"
              onClick={() => void write('delete-review', { id: review.id }, 'Review deleted.')}
            >
              {t('Delete review')}
            </button>
          )}
        </article>
      ))}
      <h4 className="font-semibold">{t('Place comments')}</h4>
      {feed?.comments.map((item) => (
        <article key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold">{item.display_name}</p>
          <p className="mt-1 whitespace-pre-wrap">{item.body}</p>
          {user?.id === item.user_id && (
            <button
              disabled={busy}
              className="text-red-700 underline"
              onClick={() => void write('delete-comment', { id: item.id }, 'Comment deleted.')}
            >
              {t('Delete comment')}
            </button>
          )}
        </article>
      ))}
      {user && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void write('comment', { body: comment }, 'Comment published.');
          }}
        >
          <label className="field-label">
            {t('Add a comment')}
            <textarea
              className="field-input"
              required
              minLength={2}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <button disabled={busy} className="secondary-button">
            {t('Publish comment')}
          </button>
        </form>
      )}
      <div className="flex gap-3">
        {offset > 0 && (
          <button className="secondary-button" onClick={() => setOffset(Math.max(0, offset - 20))}>
            {t('Previous')}
          </button>
        )}
        {(feed?.reviews.length === 20 || feed?.comments.length === 20) && (
          <button className="secondary-button" onClick={() => setOffset(offset + 20)}>
            {t('Next')}
          </button>
        )}
      </div>
    </section>
  );
}
