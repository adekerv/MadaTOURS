import { useEffect, useState, type ReactNode } from 'react';
import { Star, MapPin, MessageCircle } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { preparePhoto } from '../../lib/upload-photo';
import { useI18n } from '../../i18n/I18nProvider';
import type { User } from '../../types';
import { ReviewPhotos, type ReviewPhoto } from './ReviewPhotos';
const maxPhotos = 3;
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
  extraActions,
}: {
  placeId: number;
  user: User | null;
  onLogin: () => void;
  onRatingChanged: () => void;
  /** Further visit actions shown beside "I've been here". */
  extraActions?: ReactNode;
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
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [fileInput, setFileInput] = useState(0);
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
  useEffect(() => {
    // Photos are for signed-in people: guests never ask for them and are never sent any.
    if (!userId) {
      setPhotos([]);
      return;
    }
    const controller = new AbortController();
    api<{ photos: ReviewPhoto[] }>(`/places/${placeId}/review-photos?offset=${offset}`, {
      signal: controller.signal,
    })
      .then((data) => setPhotos(data.photos))
      .catch(() => {
        // Photos are an extra; the reviews themselves still show.
        if (!controller.signal.aborted) setPhotos([]);
      });
    return () => controller.abort();
  }, [userId, placeId, offset, revision]);
  const ownReview = feed?.reviews.find((review) => review.user_id === userId);
  const room = Math.max(0, maxPhotos - photos.filter((p) => p.reviewId === ownReview?.id).length);
  /** One action at a time: clears the last message, and shows any error the action throws. */
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function submitReview() {
    if (!user) {
      onLogin();
      return;
    }
    await run(async () => {
      const saved = await api<{ id: number }>('/community/review', {
        method: 'POST',
        body: JSON.stringify({ placeId, rating, body }),
      });
      onRatingChanged();
      let failed = '';
      for (const file of files) {
        let photo: string;
        try {
          photo = await preparePhoto(file);
        } catch (e) {
          failed =
            e instanceof Error ? e.message : 'This photo could not be read. Choose another photo.';
          break;
        }
        try {
          await api(`/reviews/${saved.id}/photos`, {
            method: 'POST',
            body: JSON.stringify({ photo }),
          });
        } catch (e) {
          failed = errorMessage(e);
          break;
        }
      }
      setFiles([]);
      setFileInput((v) => v + 1);
      setRevision((v) => v + 1);
      if (failed) {
        setNotice('Your review is live, but some photos could not be added.');
        setError(failed);
      } else
        setNotice(
          files.length
            ? 'Your review and photos are live. You can edit them here at any time.'
            : 'Your review is live. You can edit it here at any time.',
        );
    });
  }
  const removePhoto = (photo: ReviewPhoto) =>
    run(async () => {
      await api(`/review-photos/${photo.id}`, { method: 'DELETE' });
      setNotice('Photo removed.');
      setRevision((v) => v + 1);
    });
  async function write(action: string, data: object, success: string) {
    if (!user) {
      onLogin();
      return;
    }
    await run(async () => {
      await api(`/community/${action}`, {
        method: 'POST',
        body: JSON.stringify({ placeId, ...data }),
      });
      setNotice(success);
      setRevision((v) => v + 1);
      if (action === 'delete-review') {
        onRatingChanged();
        setBody('');
        setRating(5);
      }
      if (action === 'comment') setComment('');
    });
  }
  const hasReviews = !!feed?.reviews.length;
  const hasComments = !!feed?.comments.length;
  return (
    <section
      id="community"
      aria-labelledby="community-title"
      className="space-y-4 border-t border-slate-200 pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="community-title" className="text-xl font-bold">
          {t('MadaTours community')}
        </h3>
        {!!feed?.count && !!feed.rating && (
          <span className="flex items-center gap-1 font-semibold text-orange-800">
            <Star size={18} aria-hidden="true" />
            {Number(feed.rating).toFixed(1)} / 5 ({feed.count})
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
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
        {extraActions}
      </div>
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
          {t(notice)}
        </p>
      )}
      {error && (
        <div role="alert" className="error-message">
          {t(error)}{' '}
          <button
            className="underline"
            onClick={() => {
              setRevision((v) => v + 1);
              setOwnRetry((v) => v + 1);
            }}
          >
            {t('Retry')}
          </button>
        </div>
      )}
      {user ? (
        <form
          className="space-y-3 rounded-2xl bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitReview();
          }}
        >
          <fieldset disabled={!ownLoaded || busy} className="space-y-3">
            <legend className="font-semibold">{t('Rate this place')}</legend>
            <p className="text-sm text-slate-600">
              {t('Reviews are public and linked to your display name. Share your own experience.')}
            </p>
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
            <label className="field-label">
              {t('Photos (optional)')}
              <input
                key={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={room === 0}
                className="field-input"
                onChange={(e) => {
                  const chosen = Array.from(e.target.files ?? []);
                  if (chosen.length > room) setError('A review can have up to 3 photos.');
                  setFiles(chosen.slice(0, room));
                }}
              />
              <span className="text-xs font-normal text-slate-600">
                {t('Up to 3 photos. Only signed-in people can see photos on reviews.')}
              </span>
            </label>
            {files.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-slate-700">
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}`} className="break-all">
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
            <button className="primary-button" disabled={busy}>
              {t('Publish or update review')}
            </button>
          </fieldset>
        </form>
      ) : (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm text-slate-800">
            {t('Sign in to rate this place, check in, comment or save it.')}
          </p>
          <button className="primary-button mt-3" onClick={onLogin}>
            {t('Sign in')}
          </button>
        </div>
      )}
      {!feed && !error && (
        <div role="status" className="skeleton h-28 rounded-2xl">
          <span className="sr-only">{t('Loading reviews…')}</span>
        </div>
      )}
      {feed && !hasReviews && !hasComments && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-700">
          <MessageCircle size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-orange-700" />
          <p>{t('No reviews or comments yet. Be the first to share how your visit went.')}</p>
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
          <ReviewPhotos
            photos={photos.filter((photo) => photo.reviewId === review.id)}
            author={review.display_name}
            canRemove={user?.id === review.user_id || user?.role === 'admin'}
            disabled={busy}
            onRemove={(photo) => void removePhoto(photo)}
          />
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
      {(hasComments || user) && <h4 className="font-semibold">{t('Comments')}</h4>}
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
