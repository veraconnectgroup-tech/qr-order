"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  userRole?: string;
};

type State = {
  hasError: boolean;
};

export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      tags: { boundary: "dashboard" },
      extra: {
        componentStack: info.componentStack,
        userRole: this.props.userRole,
        route:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dashboard-theme flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Etwas ist schiefgelaufen
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Ein unerwarteter Fehler ist aufgetreten. Bitte laden Sie die Seite
            neu.
          </p>
          <Button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-12"
          >
            Seite neu laden
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
