import { Component, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/**
 * Last line of defence: if drawing the screen throws, say so instead of showing a
 * blank page. Autosave runs every few seconds, so reloading offers the latest
 * autosaved changes back.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-error">
        <section className="banner banner-locked" role="alert" aria-labelledby="app-error-heading">
          <h2 id="app-error-heading">Something went wrong</h2>
          <p>
            The Load Sheet hit a problem it could not recover from. Reload to carry on: you will be offered your
            last autosaved changes. If you saved the show to a file, that file is unaffected.
          </p>
          <div className="banner-actions">
            <button type="button" className="button primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </section>
      </main>
    );
  }
}
