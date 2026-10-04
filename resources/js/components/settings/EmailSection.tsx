import { useState, type FormEvent } from 'react';
import type { User } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import { VerifiedEmailNotice } from '../account/VerifiedEmailNotice';
export function EmailSection({ user, onChanged }: { user: User; onChanged: (user: User) => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ email: string; verificationLost: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  async function change(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = await api<{ user: User; verificationLost: boolean }>('/account/email', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onChanged(data.user);
      setResult({ email: data.user.email, verificationLost: data.verificationLost });
      setEmail('');
      setPassword('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-bold">{t('Email address')}</h2>
      <p className="mt-3 break-all font-semibold text-slate-900">{user.email}</p>
      <div className="mt-4">
        <VerifiedEmailNotice user={user} />
      </div>
      {result && (
        <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
          {t('Your email address is now {email}.', { email: result.email })}
          {result.verificationLost &&
            ` ${t('It is not confirmed by Google, so meet-ups are paused.')}`}
        </p>
      )}
      {user.hasPassword === false ? (
        <p className="mt-4 text-sm text-slate-600">
          {t('Your email address comes from your Google account, so it cannot be changed here.')}
        </p>
      ) : (
        <form onSubmit={change} className="mt-6 space-y-4 border-t border-slate-200 pt-5">
          <h3 className="font-bold">{t('Change your email address')}</h3>
          <label className="field-label">
            {t('New email address')}
            <input
              type="email"
              className="field-input"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
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
          <p className="text-sm text-slate-600">
            {t('The address changes straight away. We do not send any email.')}
            {user.emailVerified &&
              ` ${t('Changing your email address pauses meet-ups until Google confirms the new one.')}`}
          </p>
          {error && (
            <p role="alert" className="error-message">
              {t(error)}
            </p>
          )}
          <button disabled={busy} className="primary-button w-full sm:w-auto">
            {busy ? t('Changing…') : t('Change email')}
          </button>
        </form>
      )}
    </section>
  );
}
