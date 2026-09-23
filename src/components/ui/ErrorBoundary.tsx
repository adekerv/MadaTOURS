import { useI18n } from '../../i18n/I18nProvider';
import { Component, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <ErrorFallback /> : this.props.children;
  }
}

function ErrorFallback() {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-bold">{t('Let’s try that again')}</h1>
      <p className="text-slate-600">
        {t('MadaTours could not open this screen. Reload to return to the app.')}
      </p>
      <button className="primary-button" onClick={() => window.location.reload()}>
        {t('Reload app')}
      </button>
    </main>
  );
}
