import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import { RecoveryCodes } from '../account/RecoveryCodes';
type Status = { remaining: number; total: number };
export function RecoverySection({ user }: { user: User }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const google = user.hasPassword === false;
  useEffect(() => {
    if (google) return;
    const controller = new AbortController();
    api<Status>('/account/recovery-codes', { signal: controller.signal })
      .then(setStatus)
      .catch(() => {
        if (!controller.signal.aborted) setStatus(null);
      });
    return () => controller.abort();
  }, [google, revision]);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api<{ codes: string[] }>('/account/recovery-codes', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setCodes(data.codes);
      setPassword('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-bold">{t('Account recovery')}</h2>
      {google ? (
        <p className="mt-3 text-sm text-slate-600">
          {t('You sign in with Google, so you do not need recovery codes.')}
        </p>
      ) : codes ? (
        <div className="mt-4">
          <RecoveryCodes
            codes={codes}
            email={user.email}
            onDone={() => {
              setCodes(null);
              setRevision((value) => value + 1);
            }}
          />
        </div>
      ) : (
        <>
          {status && (
            <p
              role="status"
              className={`mt-3 font-semibold ${status.remaining <= 2 ? 'text-red-700' : 'text-slate-900'}`}
            >
              {t('{remaining} of {total} recovery codes left', {
                remaining: String(status.remaining),
                total: String(status.total),
              })}
              {status.remaining <= 2 && ` ${t('Create a new set soon.')}`}
            </p>
          )}
          <form onSubmit={create} className="mt-4 space-y-4">
            <p className="text-sm text-slate-600">
              {t('Creating new codes replaces every old code. Enter your password to continue.')}
            </p>
            <label className="field-label">
              {t('Current password')}
              <input
                type="password"
                className="field-input"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {t(error)}
              </p>
            )}
            <button disabled={busy} className="primary-button w-full sm:w-auto">
              {busy ? t('Creating…') : t('Create new recovery codes')}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
