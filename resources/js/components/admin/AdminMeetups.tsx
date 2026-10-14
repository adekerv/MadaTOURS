import { useEffect, useState } from 'react';
import { CalendarDays, Download } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import type { Place } from '../../types';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
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

type Row = {
  id: number;
  title: string;
  location: string;
  place_name: string | null;
  starts_at: string;
  price: number;
  capacity: number;
  status: 'live' | 'expired' | 'cancelled';
  host: string;
  host_email: string;
  accepted: number;
  pending: number;
  reports: number;
};
type Detail = Omit<Row, 'reports'> & {
  description: string;
  expires_at: string;
  requests: {
    user_id: string;
    status: 'pending' | 'accepted' | 'declined';
    created_at: string;
    name: string;
    email: string;
  }[];
  reports: { reason: string; created_at: string; reporter: string }[];
};

const statusTone = { live: 'green', expired: 'slate', cancelled: 'red' } as const;
const statusLabel = { live: 'Open for requests', expired: 'Finished', cancelled: 'Cancelled' };
const requestLabel = {
  pending: 'Waiting for the host',
  accepted: 'Accepted',
  declined: 'Declined',
};

/**
 * Meet-ups are the app's bookings: a date, a price paid to the host in person, a capacity and join requests.
 * There is no payment in the app, so nothing here is revenue.
 */
export function AdminMeetups({ places }: { places: Place[] }) {
  const { t } = useI18n();
  const date = useDateFormat();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [place, setPlace] = useState('');
  const [sort, setSort] = useState('soonest');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const query = useDebounced(search);
  useResetPage(setPage, query, status, from, to, place, sort);
  const filters = { search: query, status, from, to, place };
  const list = useAdminList<Row>('/admin/meetups', { ...filters, sort, page });
  const exportUrl = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/admin/meetups/export?${new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value) as [string, string][],
  )}`;
  return (
    <>
      <SectionHeader
        title={t('Meet-ups')}
        description={t(
          'Meet-ups are the bookings of MadaTours: people ask to join, and the host or you accept them.',
        )}
        actions={
          <a href={exportUrl} className="secondary-button flex items-center gap-2" download>
            <Download size={17} aria-hidden />
            {t('Export to CSV')}
          </a>
        }
      />
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder={t('Search by title, place or host')}
      >
        <Choice
          label={t('Status')}
          value={status}
          onChange={setStatus}
          options={[
            ['', t('All')],
            ['live', t('Open for requests')],
            ['expired', t('Finished')],
            ['cancelled', t('Cancelled')],
          ]}
        />
        <label className="field-label w-[calc(50%-0.4rem)] min-[480px]:w-auto">
          <span className="text-xs uppercase tracking-wide text-slate-500">{t('From')}</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label w-[calc(50%-0.4rem)] min-[480px]:w-auto">
          <span className="text-xs uppercase tracking-wide text-slate-500">{t('To')}</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
            className="field-input"
          />
        </label>
        <Choice
          label={t('Place')}
          value={place}
          onChange={setPlace}
          options={[
            ['', t('All places')],
            ...[...places]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((item) => [String(item.id), item.name] as [string, string]),
          ]}
        />
        <Choice
          label={t('Sort by')}
          value={sort}
          onChange={setSort}
          options={[
            ['soonest', t('Date, soonest first')],
            ['latest', t('Date, latest first')],
            ['created', t('Newest first')],
            ['price', t('Price')],
          ]}
        />
      </ListToolbar>
      {list.error && <LoadError error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <ListSkeleton />}
      {list.data && !list.data.rows.length && (
        <EmptyState icon={<CalendarDays size={22} />} title={t('No meet-ups yet')}>
          {t('Meet-ups people create in Community and meet-ups appear here.')}
        </EmptyState>
      )}
      {list.data && list.data.rows.length > 0 && (
        <div
          className={`relative overflow-x-auto rounded-2xl border border-slate-200 bg-white ${list.loading ? 'opacity-60' : ''}`}
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('Meet-up')}</th>
                <th>{t('Date')}</th>
                <th className="hidden md:table-cell">{t('Host')}</th>
                <th className="hidden sm:table-cell">{t('Places taken')}</th>
                <th>{t('Status')}</th>
                <th>
                  <span className="sr-only">{t('Actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.rows.map((row) => (
                <tr key={row.id}>
                  <td className="max-w-[16rem]">
                    <p className="truncate font-semibold">{row.title}</p>
                    <p className="truncate text-slate-600">
                      {row.place_name ?? row.location} ·{' '}
                      {row.price > 0 ? t('{price} €', { price: row.price }) : t('Free')}
                    </p>
                  </td>
                  <td className="whitespace-nowrap">{date(row.starts_at)}</td>
                  <td className="hidden max-w-[12rem] truncate md:table-cell">{row.host}</td>
                  <td className="hidden whitespace-nowrap sm:table-cell">
                    {t('{taken} of {capacity}', {
                      taken: row.accepted + 1,
                      capacity: row.capacity,
                    })}
                    {row.pending > 0 && (
                      <span className="ml-2">
                        <Badge tone="orange">{t('{count} waiting', { count: row.pending })}</Badge>
                      </span>
                    )}
                  </td>
                  <td>
                    <Badge tone={statusTone[row.status]}>{t(statusLabel[row.status])}</Badge>
                    {row.reports > 0 && (
                      <span className="ml-1">
                        <Badge tone="red">{t('{count} reports', { count: row.reports })}</Badge>
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      className="secondary-button"
                      onClick={() => setOpen(row.id)}
                      aria-label={t('Open {name}', { name: row.title })}
                    >
                      {t('Open')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && (
        <Pagination
          page={page}
          perPage={list.data.perPage}
          total={list.data.total}
          onPage={setPage}
        />
      )}
      {open !== null && (
        <MeetupPanel id={open} onClose={() => setOpen(null)} onChanged={list.reload} />
      )}
    </>
  );
}

function MeetupPanel({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const date = useDateFormat();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'cancelled' | 'live' | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api<Detail>(`/admin/meetups/${id}`, { signal: controller.signal })
      .then((data) => !controller.signal.aborted && setDetail(data))
      .catch((failure) => !controller.signal.aborted && setError(errorMessage(failure)));
    return () => controller.abort();
  }, [id]);
  async function setStatus(status: 'cancelled' | 'live') {
    try {
      setDetail(
        await api<Detail>(`/admin/meetups/${id}/status`, {
          method: 'POST',
          body: JSON.stringify({ status }),
        }),
      );
      toast(status === 'cancelled' ? 'The meet-up was cancelled.' : 'The meet-up is open again.');
      onChanged();
    } catch (failure) {
      toast(errorMessage(failure), 'error');
      return false;
    }
  }
  async function decide(member: string, status: string) {
    setBusy(member);
    try {
      setDetail(
        await api<Detail>(`/admin/meetups/${id}/requests/${member}`, {
          method: 'POST',
          body: JSON.stringify({ status }),
        }),
      );
      toast('The request was updated.');
      onChanged();
    } catch (failure) {
      toast(errorMessage(failure), 'error');
    } finally {
      setBusy('');
    }
  }
  return (
    <Modal title={detail?.title ?? t('Meet-up')} onClose={onClose} side>
      <div className="space-y-6 p-5 sm:p-6">
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        {!detail && !error && <ListSkeleton rows={4} />}
        {detail && (
          <>
            <div className="space-y-2 text-sm">
              <Badge tone={statusTone[detail.status]}>{t(statusLabel[detail.status])}</Badge>
              <p>
                <span className="font-semibold">{date(detail.starts_at)}</span> ·{' '}
                {detail.place_name ?? detail.location}
              </p>
              <p>
                {detail.price > 0
                  ? t('{price} €, paid to the host', { price: detail.price })
                  : t('Free')}{' '}
                ·{' '}
                {t('{taken} of {capacity} places taken', {
                  taken:
                    detail.requests.filter((request) => request.status === 'accepted').length + 1,
                  capacity: detail.capacity,
                })}
              </p>
              <p>
                {t('Host')}: <span className="font-semibold">{detail.host}</span>{' '}
                <a href={`mailto:${detail.host_email}`} className="break-all underline">
                  {detail.host_email}
                </a>
              </p>
              <p className="whitespace-pre-line text-slate-700">{detail.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {detail.status === 'live' ? (
                <button
                  className="secondary-button text-red-700"
                  onClick={() => setConfirm('cancelled')}
                >
                  {t('Cancel the meet-up')}
                </button>
              ) : (
                new Date(detail.starts_at) > new Date() && (
                  <button className="secondary-button" onClick={() => setConfirm('live')}>
                    {t('Open the meet-up again')}
                  </button>
                )
              )}
            </div>
            <section>
              <h3 className="mb-2 font-bold">{t('Join requests')}</h3>
              {detail.requests.length === 0 ? (
                <p className="text-sm text-slate-600">{t('Nobody has asked to join yet.')}</p>
              ) : (
                <ul className="space-y-2">
                  {detail.requests.map((request) => (
                    <li
                      key={request.user_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">{request.name}</span>
                        <a
                          href={`mailto:${request.email}`}
                          className="break-all text-slate-600 underline"
                        >
                          {request.email}
                        </a>
                        <span className="block text-xs text-slate-500">
                          {t('Asked on {date}', { date: date(request.created_at) })}
                        </span>
                      </span>
                      <label className="field-label">
                        <span className="sr-only">
                          {t('Request from {name}', { name: request.name })}
                        </span>
                        <select
                          value={request.status}
                          disabled={busy === request.user_id}
                          onChange={(event) => void decide(request.user_id, event.target.value)}
                          className="field-input w-auto"
                        >
                          {(['pending', 'accepted', 'declined'] as const).map((value) => (
                            <option key={value} value={value}>
                              {t(requestLabel[value])}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {detail.reports.length > 0 && (
              <section>
                <h3 className="mb-2 font-bold">{t('Reports')}</h3>
                <ul className="space-y-2 text-sm">
                  {detail.reports.map((report, index) => (
                    <li key={index} className="rounded-xl bg-red-50 p-3 text-red-800">
                      <p>{report.reason}</p>
                      <p className="mt-1 text-xs">
                        {report.reporter} · {date(report.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={t(confirm === 'cancelled' ? 'Cancel this meet-up?' : 'Open this meet-up again?')}
          confirmLabel={t(confirm === 'cancelled' ? 'Cancel the meet-up' : 'Open again')}
          danger={confirm === 'cancelled'}
          onConfirm={() => setStatus(confirm)}
          onClose={() => setConfirm(null)}
        >
          {t(
            confirm === 'cancelled'
              ? 'People who asked to join will see that it is cancelled. You can open it again before it starts.'
              : 'It will show in Community and meet-ups again.',
          )}
        </ConfirmDialog>
      )}
    </Modal>
  );
}
