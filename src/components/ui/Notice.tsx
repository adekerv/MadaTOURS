import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
export function Notice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [container, setContainer] = useState<Element>(document.body);
  useEffect(() => {
    const update = () => {
      const dialogs = document.querySelectorAll('dialog[open]');
      setContainer(dialogs.item(dialogs.length - 1) ?? document.body);
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    update();
    return () => observer.disconnect();
  }, []);
  return createPortal(
    <div role="status" className="app-notice">
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss message" className="icon-button shrink-0">
        ×
      </button>
    </div>,
    container,
  );
}
