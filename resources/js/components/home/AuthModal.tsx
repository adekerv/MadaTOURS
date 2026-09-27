import { useId, useState, type FormEvent } from 'react';
import type { User } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
export function AuthModal({
  onClose,
  onLoginSuccess,
}: {
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}) {
  const { t } = useI18n();
  const hint = useId();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const titles: Record<Mode, string> = {
    login: 'Welcome to MadaTours',
    register: 'Create your account',
    verify: 'Verify your email',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  };
  const change = (next: Mode) => {
    setMode(next);
    setPassword('');
    setToken('');
    setError('');
    setMessage('');
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const endpoint =
        mode === 'forgot' ? 'forgot-password' : mode === 'reset' ? 'reset-password' : mode;
      const result = await api<{ user?: User | null; verificationRequired?: boolean }>(
        `/auth/${endpoint}`,
        { method: 'POST', body: JSON.stringify({ email, password, token }) },
      );
      if (result.user) {
        onLoginSuccess(result.user);
        onClose();
        return;
      }
      if (mode === 'register') {
        change('verify');
        setMessage('Check your email and enter the verification code.');
      } else if (mode === 'forgot') {
        change('reset');
        setMessage(
          'If an account exists, a recovery code has been sent. Check your inbox and spam folder.',
        );
      } else if (mode === 'reset') {
        change('login');
        setMessage('Password updated. Sign in with your new password.');
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/auth/resend', { method: 'POST', body: JSON.stringify({ email }) });
      setMessage('Check your email and enter the verification code.');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const needsPassword = mode === 'login' || mode === 'register' || mode === 'reset';
  return (
    <Modal title={t(titles[mode])} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
        <p className="text-sm text-slate-600">
          {t('Save your favorite places and keep a list of places to visit again.')}
        </p>
        <label className="field-label">
          {t('Email')}
          <input
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={254}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
            disabled={busy}
          />
        </label>
        {(mode === 'verify' || mode === 'reset') && (
          <label className="field-label">
            {t('Email code')}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              minLength={6}
              maxLength={10}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
              required
              className="field-input"
              disabled={busy}
            />
          </label>
        )}
        {needsPassword && (
          <label className="field-label">
            {t(mode === 'reset' ? 'New password' : 'Password')}
            <input
              aria-label={t(mode === 'reset' ? 'New password' : 'Password')}
              aria-describedby={mode !== 'login' ? hint : undefined}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? 1 : 12}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
              disabled={busy}
            />
            {mode !== 'login' && (
              <span id={hint} className="text-sm font-normal text-slate-600">
                {t('Use at least 12 characters. A few memorable words work well.')}
              </span>
            )}
          </label>
        )}
        {message && (
          <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
            {t(message)}
          </p>
        )}
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        <button disabled={busy} className="primary-button w-full">
          {t(
            busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'register'
                  ? 'Create account'
                  : mode === 'verify'
                    ? 'Verify email'
                    : mode === 'forgot'
                      ? 'Send recovery code'
                      : 'Update password',
          )}
        </button>
        {mode === 'login' && (
          <>
            <button
              type="button"
              disabled={busy}
              className="w-full text-sm font-semibold text-orange-700"
              onClick={() => change('forgot')}
            >
              {t('Forgot password?')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="w-full text-sm font-semibold text-orange-700"
              onClick={() => change('register')}
            >
              {t('New here? Create an account')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="w-full text-sm text-slate-600"
              onClick={() => change('verify')}
            >
              {t('Already have a verification code?')}
            </button>
          </>
        )}
        {mode === 'verify' && (
          <button
            type="button"
            disabled={busy || !email}
            className="secondary-button w-full"
            onClick={() => void resend()}
          >
            {t('Resend verification code')}
          </button>
        )}
        {mode !== 'login' && (
          <button
            type="button"
            disabled={busy}
            className="w-full text-sm font-semibold text-orange-700"
            onClick={() => change('login')}
          >
            {t('Back to sign in')}
          </button>
        )}
      </form>
    </Modal>
  );
}
