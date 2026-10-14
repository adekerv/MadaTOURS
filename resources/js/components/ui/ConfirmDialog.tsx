import { useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Modal } from './Modal';

/**
 * Asks before something that cannot be undone, or is disruptive. The confirm button stays busy while the action
 * runs; when the action fails the dialog stays open so the person can try again or cancel.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<boolean | void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      <div className="space-y-5 p-5 sm:p-7">
        <div className="text-sm leading-relaxed text-slate-700">{children}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            className={`primary-button ${danger ? 'bg-red-700 hover:bg-red-800' : ''}`}
            onClick={async () => {
              setBusy(true);
              try {
                if ((await onConfirm()) !== false) onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t('Please wait…') : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
