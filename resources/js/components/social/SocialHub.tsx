import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { api, errorMessage } from '../../lib/api';
import type { User, Place } from '../../types';
import { Modal } from '../ui/Modal';
import { VerifiedEmailNotice } from '../account/VerifiedEmailNotice';
import { Connections } from './Connections';
import { Events } from './Events';
import { CreateEvent } from './CreateEvent';
import type { SocialData } from './types';
export function SocialHub({
  user,
  places,
  onClose,
}: {
  user: User;
  places: Place[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'connections' | 'events'>('connections');
  const [data, setData] = useState<SocialData>();
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api<SocialData>(`/social?q=${encodeURIComponent(query)}&offset=${offset}`, {
      signal: controller.signal,
    })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [query, offset, revision, user.emailVerified]);
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, [onClose]);
  async function act(action: string, payload: object) {
    if (busy) return false;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/social/${action}`, { method: 'POST', body: JSON.stringify(payload) });
      setRevision((n) => n + 1);
      setNotice('Changes saved.');
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={t('Community and meet-ups')} wide onClose={onClose}>
      <div className="space-y-5 p-5 sm:p-7">
        <div className="grid grid-cols-2 gap-2">
          {(['connections', 'events'] as const).map((value) => (
            <button
              key={value}
              aria-pressed={tab === value}
              className={tab === value ? 'primary-button' : 'secondary-button'}
              onClick={() => setTab(value)}
            >
              {t(value === 'connections' ? 'Connections' : 'Meet-ups')}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="error-message">
            {t(error)}{' '}
            <button className="underline" onClick={() => setRevision((n) => n + 1)}>
              {t('Retry')}
            </button>
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-green-800">
            {t(notice)}
          </p>
        )}
        {!data && !error && (
          <div className="skeleton h-52 rounded-2xl" role="status">
            <span className="sr-only">{t('Loading community…')}</span>
          </div>
        )}
        {data &&
          (tab === 'connections' ? (
            <Connections
              data={data}
              user={user}
              act={act}
              busy={busy}
              onSearch={(q) => {
                setOffset(0);
                setQuery(q);
              }}
            />
          ) : (
            <>
              <VerifiedEmailNotice user={user} />
              <CreateEvent places={places} act={act} busy={busy} />
              <Events events={data.events} user={user} act={act} busy={busy} />
              {user.role === 'admin' && (
                <section>
                  <h3 className="font-bold">{t('Reported meet-ups')}</h3>
                  {data.reports.map((report) => (
                    <div
                      key={`${report.event_id}:${report.user_id}`}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <p>{t('Meet-up #{id}', { id: report.event_id })}</p>
                      <p className="text-sm">{report.reason}</p>
                      <button
                        disabled={busy}
                        className="secondary-button"
                        onClick={() => void act('cancel-event', { eventId: report.event_id })}
                      >
                        {t('Cancel meet-up')}
                      </button>
                    </div>
                  ))}
                </section>
              )}
            </>
          ))}
        <div className="flex gap-2">
          {offset > 0 && (
            <button
              className="secondary-button"
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              {t('Previous')}
            </button>
          )}
          {data && Object.values(data).some((rows) => rows.length === 20) && (
            <button className="secondary-button" onClick={() => setOffset(offset + 20)}>
              {t('Next')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
