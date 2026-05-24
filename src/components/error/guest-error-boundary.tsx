"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class GuestErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      tags: { boundary: "guest" },
      extra: {
        componentStack: info.componentStack,
        route:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="guest-theme flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Etwas ist schiefgelaufen
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Bitte laden Sie die Seite neu, um fortzufahren.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-12 rounded-lg bg-[#f97316] px-6 text-base font-semibold text-white"
          >
            Seite neu laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
