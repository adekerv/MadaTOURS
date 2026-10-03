import { useState, type FormEvent } from 'react';
import type { User } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
export function DeleteAccount({ user, onDeleted }: { user: User; onDeleted: () => void }) {
  const { t } = useI18n();
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const needsPassword = user.hasPassword !== false;
  const matches = confirmation.trim().toLowerCase() === user.email.toLowerCase();
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (!matches) return;
    setBusy(true);
    setError('');
    try {
      await api('/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation: confirmation.trim(), password }),
      });
      onDeleted();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby="delete-account-title"
      className="rounded-3xl border border-red-200 bg-red-50 p-5 sm:p-6"
    >
      <h2 id="delete-account-title" className="text-xl font-bold text-red-800">
        {t('Delete your account')}
      </h2>
      <p className="mt-3 font-semibold text-red-800">
        {t('This permanently deletes your account and cannot be undone.')}
      </p>
      <p className="mt-4 text-sm font-semibold text-slate-900">{t('We will delete:')}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>{t('Your profile and display name')}</li>
        <li>{t('Your favorites and places to revisit')}</li>
        <li>{t('Your reviews, comments and check-ins')}</li>
        <li>{t('Your follows, blocks and meet-ups, including the ones you created')}</li>
        <li>{t('Your place suggestions and their photos')}</li>
        <li>{t('Your notifications and every signed-in session')}</li>
      </ul>
      <p className="mt-4 text-sm font-semibold text-slate-900">{t('What stays:')}</p>
      <p className="mt-2 text-sm text-slate-700">
        {t(
          'Places you suggested that were already published stay in the catalogue, without your name. Day plans saved on this device stay on this device.',
        )}
      </p>
      <form onSubmit={remove} className="mt-6 space-y-4 border-t border-red-200 pt-5">
        <label className="field-label">
          {t('Type {email} to confirm', { email: user.email })}
          <input
            className="field-input"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        {needsPassword ? (
          <label className="field-label">
            {t('Password')}
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
        ) : (
          <p className="text-sm text-slate-700">
            {t('You signed in with Google, so no password is needed.')}
          </p>
        )}
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        <button
          disabled={busy || !matches || (needsPassword && !password)}
          className="primary-button w-full bg-red-700 sm:w-auto"
        >
          {busy ? t('Deleting…') : t('Permanently delete my account')}
        </button>
      </form>
    </section>
  );
}
