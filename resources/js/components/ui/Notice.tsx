import { useI18n } from '../../i18n/I18nProvider';
import { createPortal } from 'react-dom';
import { useTopLayer } from '../../hooks/useTopLayer';
export function Notice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const { t } = useI18n();
  const container = useTopLayer();
  return createPortal(
    <div role="status" className="app-notice">
      <span>{t(message)}</span>
      <button
        onClick={onDismiss}
        aria-label={t('Dismiss message')}
        className="icon-button shrink-0"
      >
        ×
      </button>
    </div>,
    container,
  );
}
