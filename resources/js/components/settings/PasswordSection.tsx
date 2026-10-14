import { useId, useRef, useState, type FormEvent } from 'react';
import type { User } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import { PasswordInput } from '../ui/PasswordInput';
import { useToast } from '../ui/Toast';

/** Changing the password needs the current one; the new one is typed twice and must match before anything is sent. */
export function PasswordSection({ user }: { user: User }) {
  const { t } = useI18n();
  const toast = useToast();
  const hint = useId();
  const mismatchId = useId();
  const confirmRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mismatch = confirmation !== '' && confirmation !== password;
  async function change(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (confirmation !== password) {
      setTouched(true);
      confirmRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/account/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: current,
          password,
          password_confirmation: confirmation,
        }),
      });
      setCurrent('');
      setPassword('');
      setConfirmation('');
      setTouched(false);
      toast('Your password has been changed. Other devices have been signed out.');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-bold">{t('Password')}</h2>
      {user.hasPassword === false ? (
        <p className="mt-3 text-sm text-slate-600">
          {t('You sign in with Google, so there is no password to change.')}
        </p>
      ) : (
        <form onSubmit={change} className="mt-4 space-y-4">
          <label className="field-label">
            {t('Current password')}
            <PasswordInput
              aria-label={t('Current password')}
              autoComplete="current-password"
              required
              maxLength={128}
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field-label">
            {t('New password')}
            <PasswordInput
              aria-label={t('New password')}
              aria-describedby={hint}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
            />
            <span id={hint} className="text-sm font-normal text-slate-600">
              {t('Use at least 12 characters. A few memorable words work well.')}
            </span>
          </label>
          <label className="field-label">
            {t('Confirm new password')}
            <PasswordInput
              ref={confirmRef}
              aria-label={t('Confirm new password')}
              aria-invalid={mismatch && touched}
              aria-describedby={mismatch && touched ? mismatchId : undefined}
              autoComplete="new-password"
              required
              maxLength={128}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              onBlur={() => setTouched(true)}
              disabled={busy}
            />
            {mismatch && touched && (
              <span id={mismatchId} role="alert" className="text-sm font-semibold text-red-700">
                {t('The passwords do not match.')}
              </span>
            )}
          </label>
          {error && (
            <p role="alert" className="error-message">
              {t(error)}
            </p>
          )}
          <button
            disabled={busy || (mismatch && touched)}
            className="primary-button w-full sm:w-auto"
          >
            {busy ? t('Changing…') : t('Change password')}
          </button>
        </form>
      )}
    </section>
  );
}
