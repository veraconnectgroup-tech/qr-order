"use client";

import { useMemo, useState } from "react";
import { DenisTurnInspector } from "@/components/dashboard/denis-turn-inspector";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  recentSessionIds?: string[];
};

export function DenisTurnDebugPanel({ recentSessionIds = [] }: Props) {
  const uniqueSessions = useMemo(
    () =>
      [...new Set(recentSessionIds.filter((id) => id && id !== "unknown"))].slice(
        0,
        12
      ),
    [recentSessionIds]
  );

  const [selectedSessionId, setSelectedSessionId] = useState(
    uniqueSessions[0] ?? ""
  );
  const [manualSessionId, setManualSessionId] = useState("");

  const activeSessionId = manualSessionId.trim() || selectedSessionId;

  return (
    <QrCard>
      <QrCardTitle>Zašto je Denis to rekao?</QrCardTitle>
      <QrCardDescription>
        Turn inspector — phase timings, tier, tokens i cart akcije po sesiji.
        Podaci se čuvaju 7 dana (GDPR).
      </QrCardDescription>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        {uniqueSessions.length > 0 ? (
          <div className="min-w-0 flex-1">
            <label
              htmlFor="denis-session-select"
              className="mb-1 block text-xs font-medium text-dash-text-muted"
            >
              Recent sessions
            </label>
            <select
              id="denis-session-select"
              value={selectedSessionId}
              onChange={(event) => {
                setManualSessionId("");
                setSelectedSessionId(event.target.value);
              }}
              className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
            >
              {uniqueSessions.map((sessionId) => (
                <option key={sessionId} value={sessionId}>
                  {sessionId.slice(0, 8)}…{sessionId.slice(-4)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <label
            htmlFor="denis-session-manual"
            className="mb-1 block text-xs font-medium text-dash-text-muted"
          >
            Session ID
          </label>
          <Input
            id="denis-session-manual"
            value={manualSessionId}
            onChange={(event) => setManualSessionId(event.target.value)}
            placeholder="Paste ai_session_id…"
            className="h-10 bg-dash-surface"
          />
        </div>

        {uniqueSessions.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => {
              setManualSessionId("");
              setSelectedSessionId(uniqueSessions[0] ?? "");
            }}
          >
            Reset
          </Button>
        ) : null}
      </div>

      {activeSessionId ? (
        <div className="mt-6">
          <DenisTurnInspector sessionId={activeSessionId} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-dash-text-muted">
          Nema nedavnih sesija — unesi session ID ručno nakon prvog Denis chata.
        </p>
      )}
    </QrCard>
  );
}
