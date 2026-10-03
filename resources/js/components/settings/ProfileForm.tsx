import { useState, type FormEvent } from 'react';
import type { User } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
export function ProfileForm({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  const { language, setLanguage, t } = useI18n();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const result = await api<{ user: User }>('/account/profile', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), language }),
      });
      onSaved(result.user);
      setName(result.user.name);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-bold">{t('Profile')}</h2>
      <form onSubmit={save} className="mt-4 space-y-4">
        <label className="field-label">
          {t('Name')}
          <input
            className="field-input"
            autoComplete="name"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field-label">
          {t('Language')}
          <select
            className="field-input"
            value={language}
            onChange={(event) => setLanguage(event.target.value === 'fr' ? 'fr' : 'en')}
          >
            <option value="en" lang="en">
              English
            </option>
            <option value="fr" lang="fr">
              Français
            </option>
          </select>
        </label>
        <p className="text-sm text-slate-600">
          {t('Your name and language are saved with your account.')}
        </p>
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        {saved && (
          <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
            {t('Your changes have been saved.')}
          </p>
        )}
        <button disabled={busy || !name.trim()} className="primary-button w-full sm:w-auto">
          {busy ? t('Saving…') : t('Save changes')}
        </button>
      </form>
    </section>
  );
}
