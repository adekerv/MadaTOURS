import { useId, useState, type FormEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { Eye, EyeOff } from 'lucide-react';
import type { User } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
export function AuthModal({
  onClose,
  onLoginSuccess,
  initialMode = 'login',
}: {
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onLoginSuccess: (user: User, created: boolean) => void;
}) {
  const { t, language } = useI18n();
  const hint = useId();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            token,
            ...(mode === 'register' ? { name, language } : {}),
          }),
        },
      );
      if (result.user) {
        onLoginSuccess(result.user, mode === 'register');
        onClose();
        return;
      }
      if (mode === 'register' && result.verificationRequired) {
        // Supabase sends a code when email confirmation is on. The same reply is used for
        // an address that is already registered, so this never reveals whether it exists.
        change('verify');
        setMessage('Check your email and enter the verification code.');
      } else if (mode === 'register') {
        setError('Could not finish signup. Try signing in or resetting your password.');
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
  // Google blocks sign-in inside embedded web views, so native apps keep email sign-in for now.
  const showGoogle = (mode === 'login' || mode === 'register') && !Capacitor.isNativePlatform();
  return (
    <Modal title={t(titles[mode])} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
        <p className="text-sm text-slate-600">
          {t('Save your favorite places and keep a list of places to visit again.')}
        </p>
        {showGoogle && (
          <>
            <a
              href="/api/auth/google"
              aria-disabled={busy}
              className="secondary-button flex w-full items-center justify-center gap-3"
              onClick={(event) => {
                if (busy) event.preventDefault();
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
                <path
                  fill="#FFC107"
                  d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
                />
                <path
                  fill="#FF3D00"
                  d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
                />
              </svg>
              {t('Continue with Google')}
            </a>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="h-px flex-1 bg-slate-200" />
              {t('or use your email')}
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}
        {mode === 'register' && (
          <>
            <label className="field-label">
              {t('Your name')}
              <input
                type="text"
                autoComplete="name"
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field-input"
                disabled={busy}
              />
            </label>
            <p className="text-sm text-slate-600">
              {t('Explore freely. Verify your email when you want to join meet-ups.')}
            </p>
          </>
        )}
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
            <span className="relative block">
              <input
                aria-label={t(mode === 'reset' ? 'New password' : 'Password')}
                aria-describedby={mode !== 'login' ? hint : undefined}
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'login' ? 1 : 12}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input pr-14"
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={t(showPassword ? 'Hide password' : 'Show password')}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded-r-xl px-3 text-slate-600 hover:text-orange-800"
              >
                {showPassword ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
              </button>
            </span>
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
        {(mode === 'forgot' || mode === 'reset' || mode === 'verify') && (
          <p className="text-sm text-slate-600">
            {t('Having trouble receiving a code?')}{' '}
            <a
              href="mailto:adejkervin@protonmail.com"
              className="font-semibold text-orange-800 underline"
            >
              {t('Contact support')}
            </a>
          </p>
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
