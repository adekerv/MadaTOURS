import { useState } from 'react';
import type { User } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
export function EmailVerification({
  user,
  onVerified,
  codeSent = false,
}: {
  user: User;
  onVerified: (user: User) => void;
  codeSent?: boolean;
}) {
  const { t } = useI18n();
  const [sent, setSent] = useState(codeSent);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    setError('');
    try {
      await api('/account/verification/send', { method: 'POST' });
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ user: User }>('/account/verification/confirm', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      onVerified(result.user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (user.emailVerified)
    return (
      <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{t('Email verified')}</p>
    );
  return (
    <section className="space-y-3 rounded-2xl bg-orange-50 p-4">
      <h3 className="font-bold">{t('Verify your email for meet-ups')}</h3>
      <p className="text-sm text-slate-700">
        {t('Confirm that you own {email} before browsing or joining meet-ups.', {
          email: user.email,
        })}
      </p>
      {error && (
        <p role="alert" className="error-message">
          {t(error)}
        </p>
      )}
      {sent && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <p role="status" className="text-sm">
            {t('Check your inbox for the verification code.')}
          </p>
          <label className="field-label">
            {t('Verification code')}
            <input
              className="field-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,8}"
              minLength={6}
              maxLength={8}
              required
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <button disabled={busy} className="primary-button">
            {t('Verify email')}
          </button>
        </form>
      )}
      <button disabled={busy} className="secondary-button" onClick={() => void send()}>
        {t(sent ? 'Send another code' : 'Send verification code')}
      </button>
    </section>
  );
}
