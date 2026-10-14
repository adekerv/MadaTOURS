import { useEffect, useState } from 'react';
import { CheckCheck, Inbox, Mail, MailOpen, Reply, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
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

type Message = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'handled';
  created_at: string;
  handled_at: string | null;
};
const tone = { new: 'orange', read: 'slate', handled: 'green' } as const;
const label = { new: 'New', read: 'Read', handled: 'Handled' };

/** Messages sent from the contact page. Opening one marks it as read. */
export function AdminMessages() {
  const { t } = useI18n();
  const date = useDateFormat();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Message | null>(null);
  const query = useDebounced(search);
  useResetPage(setPage, query, status, sort);
  const list = useAdminList<Message>('/admin/messages', { search: query, status, sort, page });
  const replace = (message: Message) =>
    list.setData((previous) =>
      previous
        ? { ...previous, rows: previous.rows.map((row) => (row.id === message.id ? message : row)) }
        : previous,
    );
  return (
    <>
      <SectionHeader
        title={t('Messages')}
        description={t(
          'Messages sent from the contact page. Reply by email, then mark them as handled.',
        )}
      />
      <ListToolbar search={search} onSearch={setSearch} placeholder={t('Search messages')}>
        <Choice
          label={t('Status')}
          value={status}
          onChange={setStatus}
          options={[
            ['', t('All')],
            ['new', t('New')],
            ['read', t('Read')],
            ['handled', t('Handled')],
          ]}
        />
        <Choice
          label={t('Sort by')}
          value={sort}
          onChange={setSort}
          options={[
            ['newest', t('Newest first')],
            ['oldest', t('Oldest first')],
            ['status', t('New first')],
          ]}
        />
      </ListToolbar>
      {list.error && <LoadError error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <ListSkeleton />}
      {list.data && !list.data.rows.length && (
        <EmptyState icon={<Inbox size={22} />} title={t('No messages yet')}>
          {t('Messages people send from the contact page appear here.')}
        </EmptyState>
      )}
      {list.data && list.data.rows.length > 0 && (
        <ul
          className={`divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white ${list.loading ? 'opacity-60' : ''}`}
        >
          {list.data.rows.map((message) => (
            <li key={message.id}>
              <button
                onClick={() => setOpen(message)}
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50"
              >
                {message.status === 'new' ? (
                  <Mail size={18} aria-hidden className="mt-0.5 shrink-0 text-orange-700" />
                ) : (
                  <MailOpen size={18} aria-hidden className="mt-0.5 shrink-0 text-slate-500" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`truncate ${message.status === 'new' ? 'font-bold' : 'font-semibold'}`}
                    >
                      {message.subject}
                    </span>
                    <Badge tone={tone[message.status]}>{t(label[message.status])}</Badge>
                  </span>
                  <span className="mt-1 block truncate text-sm text-slate-600">
                    {message.name} · {message.email} · {date(message.created_at)}
                  </span>
                  <span className="mt-1 block truncate text-sm text-slate-500">
                    {message.message}
                  </span>
                </span>
              </button>
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
      {open && (
        <MessagePanel
          message={open}
          onClose={() => setOpen(null)}
          onChanged={(message) => {
            replace(message);
            setOpen(message);
          }}
          onDeleted={() => {
            setOpen(null);
            list.reload();
          }}
        />
      )}
    </>
  );
}

function MessagePanel({
  message,
  onClose,
  onChanged,
  onDeleted,
}: {
  message: Message;
  onClose: () => void;
  onChanged: (message: Message) => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const date = useDateFormat();
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const setStatus = async (status: Message['status'], quiet = false) => {
    setBusy(true);
    try {
      onChanged(
        await api<Message>(`/admin/messages/${message.id}`, {
          method: 'POST',
          body: JSON.stringify({ status }),
        }),
      );
      if (!quiet) toast(status === 'handled' ? 'Marked as handled.' : 'Marked as unread.');
    } catch (failure) {
      if (!quiet) toast(errorMessage(failure), 'error');
    } finally {
      setBusy(false);
    }
  };
  // Opening a new message marks it as read, once.
  useEffect(() => {
    if (message.status === 'new') void setStatus('read', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);
  return (
    <Modal title={message.subject} onClose={onClose} side>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="text-sm">
          <p className="font-semibold">{message.name}</p>
          <a href={`mailto:${message.email}`} className="break-all underline">
            {message.email}
          </a>
          <p className="mt-1 text-slate-500">{date(message.created_at)}</p>
          {message.handled_at && (
            <p className="text-slate-500">
              {t('Handled on {date}', { date: date(message.handled_at) })}
            </p>
          )}
        </div>
        <p className="whitespace-pre-line rounded-2xl bg-slate-50 p-4 text-slate-800">
          {message.message}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            className="primary-button inline-flex items-center gap-2"
            href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}
          >
            <Reply size={17} aria-hidden />
            {t('Reply by email')}
          </a>
          {message.status !== 'handled' ? (
            <button
              disabled={busy}
              className="secondary-button flex items-center gap-2"
              onClick={() => void setStatus('handled')}
            >
              <CheckCheck size={17} aria-hidden />
              {t('Mark as handled')}
            </button>
          ) : (
            <button
              disabled={busy}
              className="secondary-button flex items-center gap-2"
              onClick={() => void setStatus('new')}
            >
              <Mail size={17} aria-hidden />
              {t('Mark as unread')}
            </button>
          )}
          <button
            className="secondary-button flex items-center gap-2 text-red-700"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={17} aria-hidden />
            {t('Delete')}
          </button>
        </div>
      </div>
      {deleting && (
        <ConfirmDialog
          title={t('Delete this message?')}
          confirmLabel={t('Delete message')}
          onConfirm={async () => {
            try {
              await api(`/admin/messages/${message.id}`, { method: 'DELETE' });
              toast('The message was deleted.');
              onDeleted();
            } catch (failure) {
              toast(errorMessage(failure), 'error');
              return false;
            }
          }}
          onClose={() => setDeleting(false)}
        >
          {t('It is removed for good.')}
        </ConfirmDialog>
      )}
    </Modal>
  );
}
