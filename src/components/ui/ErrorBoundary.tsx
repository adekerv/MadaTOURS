import { Component, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
        <h1 className="text-2xl font-bold">Let’s try that again</h1>
        <p className="text-slate-600">
          MadaTours could not open this screen. Reload to return to the app.
        </p>
        <button className="primary-button" onClick={() => window.location.reload()}>
          Reload app
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
