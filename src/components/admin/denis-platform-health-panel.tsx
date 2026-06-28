"use client";

import { readApiErrorMessage } from "@/lib/api-error-client";
import { useCallback, useEffect, useState } from "react";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type HealthPayload = {
  status: string;
  checks: {
    database: { ok: boolean; latency_ms: number };
    redis: { ok: boolean; latency_ms?: number };
    openai: { ok: boolean; circuit: string };
    fiskaly: { ok: boolean; circuit: string };
    stripe: { ok: boolean; circuit: string };
  };
  denis: {
    activeSessions: number;
    turnsLast5min: number;
    avgLatencyMs: number;
    t0Percent: number;
    errorRate: number;
  };
};

const REFRESH_MS = 30_000;

function statusDot(ok: boolean) {
  return ok ? "🟢" : "🔴";
}

export function DenisPlatformHealthPanel() {
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/health");
      const json = await res.json();
      if (!res.ok) {
        setError(readApiErrorMessage(json, res.status, "Health check failed"));
        return;
      }
      setPayload(json.data ?? json);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const overall = payload?.status ?? "unknown";

  return (
    <QrCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <QrCardTitle>Denis platform health</QrCardTitle>
          <QrCardDescription>
            Redis, Supabase, circuits + live turn vitals (auto-refresh 30s).
          </QrCardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          disabled={loading}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      ) : loading && !payload ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-dash-border/40" />
      ) : payload ? (
        <>
          <p className="mt-4 text-lg font-semibold text-dash-text">
            {overall === "healthy" ? "🟢 All clear" : "🟡 Degraded"}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ServiceTile
              label="Redis"
              ok={payload.checks.redis.ok}
              detail={
                payload.checks.redis.latency_ms != null
                  ? `${payload.checks.redis.latency_ms}ms`
                  : "n/a"
              }
            />
            <ServiceTile
              label="Supabase"
              ok={payload.checks.database.ok}
              detail={`${payload.checks.database.latency_ms}ms`}
            />
            <ServiceTile
              label="OpenAI"
              ok={payload.checks.openai.ok}
              detail={`circuit: ${payload.checks.openai.circuit}`}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <Metric label="Turns (5m)" value={String(payload.denis.turnsLast5min)} />
            <Metric label="Avg latency" value={`${payload.denis.avgLatencyMs}ms`} />
            <Metric label="T0 rate" value={`${payload.denis.t0Percent}%`} />
            <Metric label="Sessions" value={String(payload.denis.activeSessions)} />
          </div>
        </>
      ) : null}
    </QrCard>
  );
}

function ServiceTile({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-dash-border bg-dash-bg/50 p-3">
      <p className="text-xs text-dash-text-muted">
        {statusDot(ok)} {label}
      </p>
      <p className="mt-1 text-sm font-medium text-dash-text">{detail}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-dash-bg/50 px-3 py-2">
      <p className="text-xs text-dash-text-muted">{label}</p>
      <p className="font-semibold tabular-nums text-dash-text">{value}</p>
    </div>
  );
}
