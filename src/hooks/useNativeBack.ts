import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
export function useNativeBack() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const subscription = App.addListener('backButton', () => {
      const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
      const dialog = dialogs.item(dialogs.length - 1);
      if (dialog) {
        dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
        return;
      }
      if (location.hash.startsWith('#explore')) location.hash = '';
      else void App.minimizeApp();
    });
    return () => {
      void subscription.then((handle) => handle.remove());
    };
  }, []);
}
