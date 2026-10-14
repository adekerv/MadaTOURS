import { useEffect, useState, type ReactNode } from 'react';
import { History } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import { EmptyState, ListSkeleton, LoadError, SectionHeader, useDateFormat } from './AdminKit';

type Ranked = {
  id: number;
  name: string;
  saves?: number;
  reviews?: number;
  rating?: number | null;
  published?: boolean;
};
export type Overview = {
  users: number;
  usersThisMonth: number;
  admins: number;
  suspended: number;
  places: number;
  tours: number;
  toursPublished: number;
  meetups: number;
  meetupsThisMonth: number;
  meetupsUpcoming: number;
  requestsPending: number;
  requestsAccepted: number;
  reviews: number;
  reviewsThisMonth: number;
  reviewsHidden: number;
  submissionsPending: number;
  messagesNew: number;
  eventReports: number;
  mostSaved: Ranked[];
  mostReviewed: Ranked[];
  popularTours: Ranked[];
  recentUsers: { id: string; email: string; name: string; created_at: string }[];
  recentActivity: { id: number; actor_email: string; summary: string; created_at: string }[];
};

function Tile({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: number;
  detail?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className="mt-1 block text-3xl font-semibold text-slate-900">
        {value.toLocaleString()}
      </span>
      {detail && <span className="mt-1 block text-sm text-slate-600">{detail}</span>}
    </>
  );
  const className = 'block rounded-2xl border border-slate-200 bg-white p-4';
  return href ? (
    <a href={href} className={`${className} hover:border-orange-300`}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function RankedList({
  rows,
  value,
  empty,
}: {
  rows: Ranked[];
  value: (row: Ranked) => string;
  empty: string;
}) {
  const { t } = useI18n();
  if (!rows.length) return <p className="text-sm text-slate-600">{t(empty)}</p>;
  return (
    <ol className="space-y-1">
      {rows.map((row, index) => (
        <li
          key={row.id}
          className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm"
        >
          <span className="min-w-0 truncate">
            <span className="mr-2 text-slate-500">{index + 1}.</span>
            {row.name}
          </span>
          <span className="shrink-0 font-semibold text-slate-700">{value(row)}</span>
        </li>
      ))}
    </ol>
  );
}

/** The dashboard's front page: headline figures, what is popular, and what happened recently. */
export function AdminOverview() {
  const { t } = useI18n();
  const date = useDateFormat();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api<Overview>('/admin/overview', { signal: controller.signal })
      .then((result) => !controller.signal.aborted && setData(result))
      .catch((failure) => !controller.signal.aborted && setError(errorMessage(failure)));
    return () => controller.abort();
  }, [revision]);
  return (
    <>
      <SectionHeader
        title={t('Overview')}
        description={t('How MadaTours is doing, and what needs your attention.')}
      />
      {error && <LoadError error={error} onRetry={() => setRevision((value) => value + 1)} />}
      {!data && !error && <ListSkeleton rows={6} />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <Tile
              label={t('Users')}
              value={data.users}
              detail={t('{count} new this month', { count: data.usersThisMonth })}
              href="#admin/users"
            />
            <Tile
              label={t('Meet-ups')}
              value={data.meetups}
              detail={t('{count} created this month · {upcoming} upcoming', {
                count: data.meetupsThisMonth,
                upcoming: data.meetupsUpcoming,
              })}
              href="#admin/meetups"
            />
            <Tile
              label={t('Join requests waiting')}
              value={data.requestsPending}
              detail={t('{count} accepted in total', { count: data.requestsAccepted })}
              href="#admin/meetups"
            />
            <Tile
              label={t('Reviews')}
              value={data.reviews}
              detail={t('{count} this month · {hidden} hidden', {
                count: data.reviewsThisMonth,
                hidden: data.reviewsHidden,
              })}
              href="#admin/reviews"
            />
            <Tile label={t('New messages')} value={data.messagesNew} href="#admin/messages" />
            <Tile
              label={t('Place submissions waiting')}
              value={data.submissionsPending}
              href="#admin/submissions"
            />
            <Tile label={t('Published places')} value={data.places} href="#admin/places" />
            <Tile
              label={t('Tours')}
              value={data.tours}
              detail={t('{count} published', { count: data.toursPublished })}
              href="#admin/tours"
            />
          </div>
          <p className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">
            {t(
              'Revenue is not tracked: tours are free, and meet-up prices are paid to the host in person.',
            )}
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title={t('Most popular tours')}>
              <RankedList
                rows={data.popularTours}
                empty="No tours yet."
                value={(row) => t('{count} saves', { count: row.saves ?? 0 })}
              />
              <p className="mt-2 text-xs text-slate-500">
                {t('Ranked by how many people saved the tour’s stops.')}
              </p>
            </Panel>
            <Panel title={t('Most saved places')}>
              <RankedList
                rows={data.mostSaved}
                empty="Nobody has saved a place yet."
                value={(row) => t('{count} saves', { count: row.saves ?? 0 })}
              />
            </Panel>
            <Panel title={t('Most reviewed places')}>
              <RankedList
                rows={data.mostReviewed}
                empty="No reviews yet."
                value={(row) => t('{count} reviews', { count: row.reviews ?? 0 })}
              />
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t('Recent sign-ups')}>
              {data.recentUsers.length ? (
                <ul className="space-y-1">
                  {data.recentUsers.map((user) => (
                    <li
                      key={user.id}
                      className="flex flex-wrap justify-between gap-2 px-2 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold">{user.name}</span>{' '}
                        <span className="text-slate-600">{user.email}</span>
                      </span>
                      <span className="text-slate-500">{date(user.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">{t('No accounts yet.')}</p>
              )}
            </Panel>
            <Panel title={t('Recent admin activity')}>
              {data.recentActivity.length ? (
                <ul className="space-y-1">
                  {data.recentActivity.map((entry) => (
                    <li key={entry.id} className="px-2 py-2 text-sm">
                      <p className="break-words">{entry.summary}</p>
                      <p className="break-all text-xs text-slate-500">
                        {entry.actor_email} · {date(entry.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<History size={22} />} title={t('No admin activity yet')} />
              )}
              <a
                href="#admin/log"
                className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-orange-800 underline"
              >
                {t('Open the activity log')}
              </a>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
