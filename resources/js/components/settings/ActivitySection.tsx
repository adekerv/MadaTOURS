import { useEffect, useState } from 'react';
import { CalendarDays, Star } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';

type Meetup = {
  id: number;
  title: string;
  location: string;
  starts_at: string;
  price: number;
  status: string;
  accepted?: number;
  pending?: number;
  meetup_status?: string;
};
type Activity = {
  meetups: Meetup[];
  requests: Meetup[];
  reviews: { id: number; place_name: string; rating: number; body: string; hidden: boolean }[];
};

const statusLabels: Record<string, string> = {
  live: 'Open for requests',
  expired: 'Finished',
  cancelled: 'Cancelled',
  pending: 'Waiting for the host',
  accepted: 'Accepted',
  declined: 'Declined',
};

/** The person's own meet-ups (the app's bookings), the meet-ups they asked to join, and their reviews. */
export function ActivitySection() {
  const { t, language } = useI18n();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api<Activity>('/account/activity', { signal: controller.signal })
      .then((data) => !controller.signal.aborted && setActivity(data))
      .catch((failure) => !controller.signal.aborted && setError(errorMessage(failure)));
    return () => controller.abort();
  }, []);
  const date = (value: string) =>
    new Date(value).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Martinique',
    });
  const empty =
    activity && !activity.meetups.length && !activity.requests.length && !activity.reviews.length;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-bold">{t('My activity')}</h2>
      {error && (
        <p role="alert" className="error-message mt-4">
          {t(error)}
        </p>
      )}
      {!activity && !error && (
        <div role="status" aria-label={t('Loading…')} className="mt-4 space-y-2">
          {[0, 1].map((row) => (
            <div key={row} className="skeleton h-14 rounded-2xl" />
          ))}
        </div>
      )}
      {empty && (
        <p className="mt-3 text-sm text-slate-600">
          {t(
            'No meet-ups or reviews yet. Join a meet-up from Community and meet-ups, or review a place you visited.',
          )}
        </p>
      )}
      {activity && activity.requests.length > 0 && (
        <div className="mt-5">
          <h3 className="flex items-center gap-2 font-bold">
            <CalendarDays size={18} aria-hidden className="text-orange-700" />
            {t('Meet-ups I asked to join')}
          </h3>
          <ul className="mt-3 space-y-2">
            {activity.requests.map((item) => (
              <li key={item.id} className="rounded-2xl border border-slate-200 p-3">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {date(item.starts_at)} · {item.location} ·{' '}
                  {item.price > 0 ? t('{price} €', { price: item.price }) : t('Free')}
                </p>
                <p className="mt-1 text-sm font-semibold text-orange-800">
                  {item.meetup_status === 'cancelled'
                    ? t('Cancelled')
                    : t(statusLabels[item.status] ?? item.status)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {activity && activity.meetups.length > 0 && (
        <div className="mt-5">
          <h3 className="flex items-center gap-2 font-bold">
            <CalendarDays size={18} aria-hidden className="text-orange-700" />
            {t('Meet-ups I host')}
          </h3>
          <ul className="mt-3 space-y-2">
            {activity.meetups.map((item) => (
              <li key={item.id} className="rounded-2xl border border-slate-200 p-3">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {date(item.starts_at)} · {item.location}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {t(statusLabels[item.status] ?? item.status)} ·{' '}
                  {t('{accepted} accepted, {pending} waiting', {
                    accepted: item.accepted ?? 0,
                    pending: item.pending ?? 0,
                  })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {activity && activity.reviews.length > 0 && (
        <div className="mt-5">
          <h3 className="flex items-center gap-2 font-bold">
            <Star size={18} aria-hidden className="text-orange-700" />
            {t('My reviews')}
          </h3>
          <ul className="mt-3 space-y-2">
            {activity.reviews.map((review) => (
              <li key={review.id} className="rounded-2xl border border-slate-200 p-3">
                <p className="font-semibold">
                  {review.place_name}{' '}
                  <span className="text-sm font-normal text-slate-600">
                    {t('{rating} / 5', { rating: review.rating })}
                  </span>
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{review.body}</p>
                {review.hidden && (
                  <p className="mt-1 text-sm font-semibold text-amber-900">
                    {t('Hidden by a moderator')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
