import { useI18n } from '../../i18n/I18nProvider';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}
export function Modal({ title, onClose, children, wide = false }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const closeRef = useRef(onClose);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  closeRef.current = onClose;
  const close = () => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(
      () => closeRef.current(),
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150,
    );
  };
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      if (timer.current) clearTimeout(timer.current);
      dialog?.close();
      document.body.style.overflow = before;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close();
        }
      }}
      className={`app-dialog ${wide ? 'app-dialog-wide' : ''} ${closing ? 'dialog-closing' : ''}`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3">
        <h2 id={id} className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label={t('Close {title}', { title })}
          className="icon-button shrink-0"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
