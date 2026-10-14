import { useEffect, useState } from 'react';
import { Copy, KeyRound, Shield, ShieldOff, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import { useSession } from '../../lib/session';
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
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  verified: boolean;
  suspended: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  providers: string[];
};
type Detail = {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  verified: boolean;
  suspended: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  providers: string[];
  commentBlock: { reason: string } | null;
  meetups: { id: number; title: string; starts_at: string; status: string }[];
  requests: { event_id: number; title: string; starts_at: string; status: string }[];
  reviews: { id: number; rating: number; body: string; hidden: boolean; place_name: string }[];
  counts: { reviews: number; comments: number; saved: number; submissions: number };
};
type Pending = 'promote' | 'demote' | 'suspend' | 'reactivate' | 'password' | 'delete';

export function AdminUsers() {
  const { t } = useI18n();
  const date = useDateFormat();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const query = useDebounced(search);
  useResetPage(setPage, query, role, status, sort);
  const list = useAdminList<Row>('/admin/users', { search: query, role, status, sort, page });
  return (
    <>
      <SectionHeader
        title={t('Users')}
        description={t(
          'Find accounts, change roles, suspend or reactivate them, reset a password or delete an account.',
        )}
      />
      <ListToolbar search={search} onSearch={setSearch} placeholder={t('Search by name or email')}>
        <Choice
          label={t('Role')}
          value={role}
          onChange={setRole}
          options={[
            ['', t('All roles')],
            ['user', t('Users')],
            ['admin', t('Administrators')],
          ]}
        />
        <Choice
          label={t('Status')}
          value={status}
          onChange={setStatus}
          options={[
            ['', t('All')],
            ['active', t('Active')],
            ['suspended', t('Suspended')],
          ]}
        />
        <Choice
          label={t('Sort by')}
          value={sort}
          onChange={setSort}
          options={[
            ['newest', t('Newest first')],
            ['oldest', t('Oldest first')],
            ['name', t('Name')],
            ['email', t('Email')],
            ['active', t('Last sign-in')],
          ]}
        />
      </ListToolbar>
      {list.error && <LoadError error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <ListSkeleton />}
      {list.data && !list.data.rows.length && (
        <EmptyState icon={<Users size={22} />} title={t('No accounts match')}>
          {t('Try another search or clear the filters.')}
        </EmptyState>
      )}
      {list.data && list.data.rows.length > 0 && (
        <div
          className={`relative overflow-x-auto rounded-2xl border border-slate-200 bg-white ${list.loading ? 'opacity-60' : ''}`}
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('Account')}</th>
                <th>{t('Role')}</th>
                <th>{t('Status')}</th>
                <th className="hidden md:table-cell">{t('Joined')}</th>
                <th className="hidden lg:table-cell">{t('Last sign-in')}</th>
                <th>
                  <span className="sr-only">{t('Actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.rows.map((row) => (
                <tr key={row.id}>
                  <td className="max-w-[16rem]">
                    <p className="truncate font-semibold">{row.name}</p>
                    <p className="truncate text-slate-600">{row.email}</p>
                  </td>
                  <td>
                    <Badge tone={row.role === 'admin' ? 'orange' : 'slate'}>
                      {t(row.role === 'admin' ? 'Administrator' : 'User')}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={row.suspended ? 'red' : 'green'}>
                      {t(row.suspended ? 'Suspended' : 'Active')}
                    </Badge>
                  </td>
                  <td className="hidden whitespace-nowrap md:table-cell">
                    {date(row.created_at, false)}
                  </td>
                  <td className="hidden whitespace-nowrap lg:table-cell">
                    {date(row.last_sign_in_at)}
                  </td>
                  <td className="text-right">
                    <button
                      className="secondary-button"
                      onClick={() => setOpen(row.id)}
                      aria-label={t('Open {name}', { name: row.email })}
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
      {open && <UserPanel id={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </>
  );
}

function UserPanel({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const date = useDateFormat();
  const { user: me } = useSession();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [password, setPassword] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api<Detail>(`/admin/users/${id}`, { signal: controller.signal })
      .then((data) => !controller.signal.aborted && setDetail(data))
      .catch((failure) => !controller.signal.aborted && setError(errorMessage(failure)));
    return () => controller.abort();
  }, [id]);
  const self = me?.id === id;
  async function run(action: Pending) {
    try {
      if (action === 'delete') {
        await api(`/admin/users/${id}`, { method: 'DELETE' });
        toast('The account was deleted.');
        onChanged();
        onClose();
        return;
      }
      if (action === 'password') {
        const result = await api<{ password: string }>(`/admin/users/${id}/password`, {
          method: 'POST',
        });
        setPassword(result.password);
        toast('A new password was set and the account was signed out everywhere.');
        return;
      }
      const path = {
        promote: 'role',
        demote: 'role',
        suspend: 'suspend',
        reactivate: 'reactivate',
      }[action];
      const next = await api<Detail>(`/admin/users/${id}/${path}`, {
        method: 'POST',
        body:
          action === 'promote' || action === 'demote'
            ? JSON.stringify({ role: action === 'promote' ? 'admin' : 'user' })
            : undefined,
      });
      setDetail((previous) => (previous ? { ...previous, ...next } : previous));
      toast(
        {
          promote: 'The account is now an administrator.',
          demote: 'Administrator access was removed.',
          suspend: 'The account was suspended and signed out.',
          reactivate: 'The account was reactivated.',
        }[action],
      );
      onChanged();
    } catch (failure) {
      toast(errorMessage(failure), 'error');
      return false;
    }
  }
  const confirmCopy: Record<
    Pending,
    { title: string; body: string; label: string; danger: boolean }
  > = {
    promote: {
      title: 'Make this account an administrator?',
      body: 'They will be able to change places, tours, accounts and site content.',
      label: 'Make administrator',
      danger: false,
    },
    demote: {
      title: 'Remove administrator access?',
      body: 'They keep their account but lose access to this dashboard.',
      label: 'Remove access',
      danger: true,
    },
    suspend: {
      title: 'Suspend this account?',
      body: 'They are signed out everywhere and cannot sign in until you reactivate the account. Nothing is deleted.',
      label: 'Suspend account',
      danger: true,
    },
    reactivate: {
      title: 'Reactivate this account?',
      body: 'They can sign in again straight away.',
      label: 'Reactivate',
      danger: false,
    },
    password: {
      title: 'Reset this account’s password?',
      body: 'A new password replaces the current one and every session ends. You will see the new password once, to pass on to the owner.',
      label: 'Reset password',
      danger: true,
    },
    delete: {
      title: 'Delete this account?',
      body: 'The account, its saved places, reviews, comments and meet-ups are removed for good. This cannot be undone.',
      label: 'Delete account',
      danger: true,
    },
  };
  return (
    <Modal title={detail?.name ?? t('Account')} onClose={onClose} side>
      <div className="space-y-6 p-5 sm:p-6">
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        {!detail && !error && <ListSkeleton rows={4} />}
        {detail && (
          <>
            <div>
              <p className="break-all font-semibold">{detail.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={detail.role === 'admin' ? 'orange' : 'slate'}>
                  {t(detail.role === 'admin' ? 'Administrator' : 'User')}
                </Badge>
                <Badge tone={detail.suspended ? 'red' : 'green'}>
                  {t(detail.suspended ? 'Suspended' : 'Active')}
                </Badge>
                {detail.verified && <Badge tone="blue">{t('Email verified')}</Badge>}
                {detail.commentBlock && <Badge tone="red">{t('Cannot comment')}</Badge>}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">{t('Joined')}</dt>
                  <dd>{date(detail.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('Last sign-in')}</dt>
                  <dd>{date(detail.lastSignInAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('Signs in with')}</dt>
                  <dd>
                    {detail.providers
                      .map((provider) =>
                        provider === 'google' ? 'Google' : t('Email and password'),
                      )
                      .join(', ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('Activity')}</dt>
                  <dd>
                    {t('{reviews} reviews · {saved} saved places', {
                      reviews: detail.counts.reviews,
                      saved: detail.counts.saved,
                    })}
                  </dd>
                </div>
              </dl>
            </div>
            {password && (
              <div
                role="status"
                className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm"
              >
                <p className="font-semibold">{t('New password, shown only once:')}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="rounded-lg bg-white px-2 py-1 font-mono text-base">
                    {password}
                  </code>
                  <button
                    className="secondary-button flex items-center gap-2"
                    onClick={() =>
                      navigator.clipboard
                        ?.writeText(password)
                        .then(() => toast('Password copied.'))
                        .catch(() =>
                          toast('Copy it by hand: the clipboard is not available.', 'error'),
                        )
                    }
                  >
                    <Copy size={16} aria-hidden />
                    {t('Copy')}
                  </button>
                </p>
                <p className="mt-2 text-slate-700">
                  {t('Give it to the owner privately and ask them to change it from My account.')}
                </p>
              </div>
            )}
            <section>
              <h3 className="mb-2 font-bold">{t('Actions')}</h3>
              {self && (
                <p className="mb-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                  {t(
                    'This is your account. You cannot change your own role, suspend or delete yourself here.',
                  )}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  disabled={self}
                  className="secondary-button flex items-center justify-center gap-2"
                  onClick={() => setPending(detail.role === 'admin' ? 'demote' : 'promote')}
                >
                  {detail.role === 'admin' ? (
                    <ShieldOff size={17} aria-hidden />
                  ) : (
                    <Shield size={17} aria-hidden />
                  )}
                  {t(
                    detail.role === 'admin' ? 'Remove administrator access' : 'Make administrator',
                  )}
                </button>
                <button
                  disabled={self || (!detail.suspended && detail.role === 'admin')}
                  className="secondary-button flex items-center justify-center gap-2"
                  onClick={() => setPending(detail.suspended ? 'reactivate' : 'suspend')}
                >
                  {detail.suspended ? (
                    <UserCheck size={17} aria-hidden />
                  ) : (
                    <UserX size={17} aria-hidden />
                  )}
                  {t(detail.suspended ? 'Reactivate account' : 'Suspend account')}
                </button>
                <button
                  disabled={self}
                  className="secondary-button flex items-center justify-center gap-2"
                  onClick={() => setPending('password')}
                >
                  <KeyRound size={17} aria-hidden />
                  {t('Reset password')}
                </button>
                <button
                  disabled={self || detail.role === 'admin'}
                  className="secondary-button flex items-center justify-center gap-2 text-red-700"
                  onClick={() => setPending('delete')}
                >
                  <Trash2 size={17} aria-hidden />
                  {t('Delete account')}
                </button>
              </div>
              {!self && detail.role === 'admin' && (
                <p className="mt-2 text-xs text-slate-500">
                  {t('Remove administrator access before suspending or deleting an administrator.')}
                </p>
              )}
            </section>
            <section>
              <h3 className="mb-2 font-bold">{t('Meet-ups')}</h3>
              {detail.meetups.length + detail.requests.length === 0 ? (
                <p className="text-sm text-slate-600">{t('No meet-ups yet.')}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {detail.meetups.map((meetup) => (
                    <li key={`host-${meetup.id}`}>
                      <a href="#admin/meetups" className="font-semibold underline">
                        {meetup.title}
                      </a>{' '}
                      <span className="text-slate-600">
                        · {t('Host')} · {date(meetup.starts_at)}
                      </span>
                    </li>
                  ))}
                  {detail.requests.map((request) => (
                    <li key={`request-${request.event_id}`}>
                      <span className="font-semibold">{request.title}</span>{' '}
                      <span className="text-slate-600">
                        · {t(statusText[request.status] ?? request.status)} ·{' '}
                        {date(request.starts_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="mb-2 font-bold">{t('Reviews')}</h3>
              {detail.reviews.length === 0 ? (
                <p className="text-sm text-slate-600">{t('No reviews yet.')}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {detail.reviews.map((review) => (
                    <li key={review.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold">
                        {review.place_name} · {t('{rating} / 5', { rating: review.rating })}
                        {review.hidden && (
                          <span className="ml-2">
                            <Badge tone="slate">{t('Hidden')}</Badge>
                          </span>
                        )}
                      </p>
                      <p className="mt-1 line-clamp-2 text-slate-600">{review.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
      {pending && (
        <ConfirmDialog
          title={t(confirmCopy[pending].title)}
          confirmLabel={t(confirmCopy[pending].label)}
          danger={confirmCopy[pending].danger}
          onConfirm={() => run(pending)}
          onClose={() => setPending(null)}
        >
          <p>{t(confirmCopy[pending].body)}</p>
          {detail && <p className="mt-2 break-all font-semibold">{detail.email}</p>}
        </ConfirmDialog>
      )}
    </Modal>
  );
}

const statusText: Record<string, string> = {
  pending: 'Waiting for the host',
  accepted: 'Accepted',
  declined: 'Declined',
};
