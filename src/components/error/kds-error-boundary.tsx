"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  countdown: number;
};

const AUTO_RELOAD_SECONDS = 10;

export class KdsErrorBoundary extends Component<Props, State> {
  private reloadTimer: ReturnType<typeof setInterval> | null = null;

  state: State = { hasError: false, countdown: AUTO_RELOAD_SECONDS };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      tags: { boundary: "kds" },
      extra: {
        componentStack: info.componentStack,
        route:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      },
    });
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (this.state.hasError && !prevState.hasError) {
      this.reloadTimer = setInterval(() => {
        this.setState((s) => {
          if (s.countdown <= 1) {
            if (this.reloadTimer) clearInterval(this.reloadTimer);
            window.location.reload();
            return s;
          }
          return { ...s, countdown: s.countdown - 1 };
        });
      }, 1000);
    }
  }

  componentWillUnmount() {
    if (this.reloadTimer) clearInterval(this.reloadTimer);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black p-8 text-center text-zinc-100">
          <h1 className="text-3xl font-bold">KDS-Fehler</h1>
          <p className="max-w-lg text-lg text-zinc-400">
            Die Küchenanzeige ist abgestürzt. Seite wird in{" "}
            {this.state.countdown}s neu geladen…
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-12 rounded-lg border border-zinc-600 px-6 text-lg font-semibold hover:bg-zinc-900"
          >
            Jetzt neu laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
