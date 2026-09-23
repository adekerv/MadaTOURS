import { useI18n } from '../../i18n/I18nProvider';
import { useState, type FormEvent } from 'react';
import type { User } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { Modal } from '../ui/Modal';
export function AccountModal({
  user,
  onClose,
  onDeleted,
}: {
  user: User;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function remove(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/account', { method: 'DELETE', body: JSON.stringify({ password }) });
      onDeleted();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={t('Your account')} onClose={onClose}>
      <div className="space-y-5 p-6">
        <p className="break-all text-slate-700">{user.email}</p>
        <p className="text-sm text-slate-600">
          {t('Your favorites and revisit list are linked to this account.')}
        </p>
        {confirm ? (
          <form onSubmit={remove} className="space-y-4">
            <p className="text-sm text-red-700">
              {t(
                'This permanently deletes your account, saved places, and all active sessions. Enter your password to confirm.',
              )}
            </p>
            <label className="field-label">
              {t('Password')}
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {t(error)}
              </p>
            )}
            <button disabled={busy} className="primary-button bg-red-700 w-full">
              {busy ? t('Deleting…') : t('Permanently delete my account')}
            </button>
            <button
              type="button"
              className="secondary-button w-full"
              onClick={() => setConfirm(false)}
            >
              {t('Cancel')}
            </button>
          </form>
        ) : (
          <button className="secondary-button text-red-700" onClick={() => setConfirm(true)}>
            {t('Delete account')}
          </button>
        )}
      </div>
    </Modal>
  );
}
