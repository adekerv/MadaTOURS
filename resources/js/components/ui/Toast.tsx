import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useTopLayer } from '../../hooks/useTopLayer';

type Tone = 'success' | 'error';
type Item = { id: number; message: string; tone: Tone };
const context = createContext<(message: string, tone?: Tone) => void>(() => {});

/** Short confirmations after an action. Errors stay until dismissed; successes leave after a few seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(0);
  const container = useTopLayer();
  const dismiss = useCallback((id: number) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);
  const show = useCallback(
    (message: string, tone: Tone = 'success') => {
      const id = ++next.current;
      setItems((previous) => [...previous.slice(-2), { id, message, tone }]);
      if (tone === 'success') setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  return (
    <context.Provider value={show}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite">
          {items.map((item) => (
            <div
              key={item.id}
              role={item.tone === 'error' ? 'alert' : 'status'}
              className={`toast ${item.tone === 'error' ? 'toast-error' : 'toast-success'}`}
            >
              {item.tone === 'error' ? (
                <AlertTriangle size={20} aria-hidden className="shrink-0" />
              ) : (
                <CheckCircle2 size={20} aria-hidden className="shrink-0" />
              )}
              <span className="min-w-0 flex-1">{t(item.message)}</span>
              <button
                onClick={() => dismiss(item.id)}
                aria-label={t('Dismiss message')}
                className="icon-button shrink-0"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>,
        container,
      )}
    </context.Provider>
  );
}

export const useToast = () => useContext(context);
