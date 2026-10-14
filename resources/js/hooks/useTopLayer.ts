import { useEffect, useState } from 'react';

/**
 * Where a floating message must render to stay visible: inside the last open modal dialog (dialogs live in the
 * browser's top layer, above anything in the page), or the page body when none is open.
 */
export function useTopLayer(): Element {
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
  return container;
}
