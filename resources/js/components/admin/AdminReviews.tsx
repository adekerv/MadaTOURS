import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Pencil, Star, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { CommunityModeration } from './CommunityModeration';
import {
  Badge,
  Choice,
  EmptyState,
  ListSkeleton,
  ListToolbar,
  LoadError,
  Pagination,
  SectionHeader,
  useAdminList,
  useDateFormat,
  useDebounced,
  useResetPage,
} from './AdminKit';

type Review = {
  id: number;
  place_id: number;
  place_name: string;
  author: string;
  author_email: string;
  rating: number;
  body: string;
  hidden: boolean;
  moderated: boolean;
  created_at: string;
  photos: number;
};

/**
 * Reviews publish at once, so there is nothing to approve. Hiding takes a review off the place page and out of the
 * community rating without deleting it; editing fixes wording; deleting removes it for good.
 */
export function AdminReviews({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const date = useDateFormat();
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState('');
  const [visibility, setVisibility] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState<Review | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const query = useDebounced(search);
  useResetPage(setPage, query, rating, visibility, sort);
  const list = useAdminList<Review>('/admin/reviews', {
    search: query,
    rating,
    visibility,
    sort,
    page,
  });
  const replace = (id: number, changes: Partial<Review>) =>
    list.setData((previous) =>
      previous
        ? {
            ...previous,
            rows: previous.rows.map((row) => (row.id === id ? { ...row, ...changes } : row)),
          }
        : previous,
    );
  async function toggle(review: Review) {
    setBusy(review.id);
    try {
      await api(`/admin/reviews/${review.id}/${review.hidden ? 'show' : 'hide'}`, {
        method: 'POST',
      });
      replace(review.id, { hidden: !review.hidden });
      toast(review.hidden ? 'The review is visible again.' : 'The review is hidden.');
      onChanged();
    } catch (failure) {
      toast(errorMessage(failure), 'error');
    } finally {
      setBusy(null);
    }
  }
  async function remove(review: Review) {
    try {
      await api(`/admin/reviews/${review.id}`, { method: 'DELETE' });
      toast('The review was deleted.');
      list.reload();
      onChanged();
    } catch (failure) {
      toast(errorMessage(failure), 'error');
      return false;
    }
  }
  return (
    <>
      <SectionHeader
        title={t('Reviews')}
        description={t(
          'Reviews appear as soon as they are written. Hide, edit or delete the ones that break the rules.',
        )}
      />
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder={t('Search reviews, places or authors')}
      >
        <Choice
          label={t('Rating')}
          value={rating}
          onChange={setRating}
          options={[
            ['', t('All ratings')],
            ...[5, 4, 3, 2, 1].map(
              (value) => [String(value), t('{rating} / 5', { rating: value })] as [string, string],
            ),
          ]}
        />
        <Choice
          label={t('Visibility')}
          value={visibility}
          onChange={setVisibility}
          options={[
            ['', t('All')],
            ['visible', t('Visible')],
            ['hidden', t('Hidden')],
          ]}
        />
        <Choice
          label={t('Sort by')}
          value={sort}
          onChange={setSort}
          options={[
            ['newest', t('Newest first')],
            ['oldest', t('Oldest first')],
            ['lowest', t('Lowest rating')],
            ['highest', t('Highest rating')],
          ]}
        />
      </ListToolbar>
      {list.error && <LoadError error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <ListSkeleton />}
      {list.data && !list.data.rows.length && (
        <EmptyState icon={<Star size={22} />} title={t('No reviews yet')}>
          {t('Reviews visitors write on place pages appear here.')}
        </EmptyState>
      )}
      {list.data && list.data.rows.length > 0 && (
        <ul className={`space-y-3 ${list.loading ? 'opacity-60' : ''}`}>
          {list.data.rows.map((review) => (
            <li key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {review.place_name}{' '}
                    <span
                      className="text-orange-800"
                      aria-label={t('{rating} / 5', { rating: review.rating })}
                    >
                      {'★'.repeat(review.rating)}
                      <span className="text-slate-300">{'★'.repeat(5 - review.rating)}</span>
                    </span>
                  </p>
                  <p className="text-sm text-slate-600">
                    {review.author} · <span className="break-all">{review.author_email}</span> ·{' '}
                    {date(review.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {review.hidden && <Badge tone="slate">{t('Hidden')}</Badge>}
                  {review.moderated && <Badge tone="blue">{t('Edited by a moderator')}</Badge>}
                  {review.photos > 0 && (
                    <Badge tone="slate">{t('{count} photos', { count: review.photos })}</Badge>
                  )}
                </div>
              </div>
              {editing?.id === review.id ? (
                <EditReview
                  review={review}
                  onCancel={() => setEditing(null)}
                  onSaved={(changes) => {
                    replace(review.id, { ...changes, moderated: true });
                    setEditing(null);
                    onChanged();
                  }}
                />
              ) : (
                <p
                  className={`mt-3 whitespace-pre-line text-sm ${review.hidden ? 'text-slate-500' : 'text-slate-800'}`}
                >
                  {review.body}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={busy === review.id}
                  className="secondary-button flex items-center gap-2"
                  onClick={() => void toggle(review)}
                >
                  {review.hidden ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
                  {t(review.hidden ? 'Show' : 'Hide')}
                </button>
                <button
                  className="secondary-button flex items-center gap-2"
                  onClick={() => setEditing(review)}
                >
                  <Pencil size={16} aria-hidden />
                  {t('Edit')}
                </button>
                <button
                  className="secondary-button flex items-center gap-2 text-red-700"
                  onClick={() => setDeleting(review)}
                >
                  <Trash2 size={16} aria-hidden />
                  {t('Delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.data && (
        <Pagination
          page={page}
          perPage={list.data.perPage}
          total={list.data.total}
          onPage={setPage}
        />
      )}
      <details className="mt-8 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
          {t('Comments and comment restrictions')}
        </summary>
        <CommunityModeration onRatingChanged={onChanged} />
      </details>
      {deleting && (
        <ConfirmDialog
          title={t('Delete this review?')}
          confirmLabel={t('Delete review')}
          onConfirm={() => remove(deleting)}
          onClose={() => setDeleting(null)}
        >
          <p>
            {t(
              'It is removed for good, with its photos. Hiding it instead keeps it in case you change your mind.',
            )}
          </p>
          <p className="mt-2 font-semibold">
            {deleting.place_name} · {deleting.author}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

function EditReview({
  review,
  onCancel,
  onSaved,
}: {
  review: Review;
  onCancel: () => void;
  onSaved: (changes: { rating: number; body: string }) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [rating, setRating] = useState(review.rating);
  const [body, setBody] = useState(review.body);
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/community/moderate-review', {
        method: 'POST',
        body: JSON.stringify({ id: review.id, rating, body }),
      });
      toast('The review was updated.');
      onSaved({ rating, body });
    } catch (failure) {
      toast(errorMessage(failure), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
      <label className="field-label">
        {t('Rating')}
        <select
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          className="field-input w-auto"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {t('{rating} / 5', { rating: value })}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        {t('Review')}
        <textarea
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="field-input"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className="primary-button">
          {busy ? t('Saving…') : t('Save changes')}
        </button>
        <button type="button" disabled={busy} className="secondary-button" onClick={onCancel}>
          {t('Cancel')}
        </button>
      </div>
    </form>
  );
}
