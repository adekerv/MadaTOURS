import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './hooks/useTheme';
import { I18nProvider } from './i18n/I18nProvider';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import '../css/app.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);

// The native package already contains its app shell. Only register web offline support.
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  !Capacitor.isNativePlatform() &&
  (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))
) {
  const registerOfflineShell = () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* App remains usable online. */
    });
  };
  // A deferred/cached module can execute after the page load event.
  if (document.readyState === 'complete') registerOfflineShell();
  else window.addEventListener('load', registerOfflineShell, { once: true });
}
