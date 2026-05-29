"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  loadDenisManifestAdminState,
  promoteVenueManifest,
  rollbackVenueManifest,
  runManifestPromoteGateCheck,
} from "@/lib/admin/denis-manifest-actions";
import type { DenisDebugSessionRow } from "@/lib/admin/denis-debug";
import type { ManifestPromoteGateResult } from "@/lib/denis/cognition/manifest/manifest-promote-gate";
import type { DenisManifestAdminState } from "@/lib/admin/denis-manifest-actions";
import { Button } from "@/components/ui/button";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";

const SAMPLE_MANIFEST = `{
  "manifestVersion": 1,
  "capabilities": {
    "relational": 3,
    "transactional": 4,
    "catalogRag": 2,
    "guestMemory": 2,
    "anticipation": 2
  },
  "policy": {
    "requireExplicitConfirm": true,
    "rushSkipUpsell": true,
    "maxUpsellsPerSession": 1
  },
  "qualityContract": {
    "refusalRateMax": 0,
    "evalPassMin": 1,
    "shadowParityMin": 0.99,
    "llmInvocationMax": 0.35
  }
}`;

type Props = {
  initial: DenisManifestAdminState;
  sessions: DenisDebugSessionRow[];
};

export function DenisManifestPromotePanel({ initial, sessions }: Props) {
  const [manifestText, setManifestText] = useState(
    initial.activeManifest
      ? JSON.stringify(initial.activeManifest, null, 2)
      : SAMPLE_MANIFEST
  );
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [gate, setGate] = useState<ManifestPromoteGateResult | null>(null);
  const [history, setHistory] = useState(initial.history);
  const [activeVersion, setActiveVersion] = useState(initial.activeVersion);
  const [pending, startTransition] = useTransition();

  function parseManifestInput(): unknown | null {
    try {
      return JSON.parse(manifestText) as unknown;
    } catch {
      toast.error("Manifest JSON is invalid.");
      return null;
    }
  }

  function runGate() {
    const manifestRaw = parseManifestInput();
    if (manifestRaw === null) return;

    startTransition(async () => {
      const result = await runManifestPromoteGateCheck({
        manifestRaw,
        sessionId: sessionId || undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        setGate(null);
        return;
      }

      setGate(result.gate);
      if (result.gate.ok) {
        toast.success("Sim gate PASS — safe to promote.");
      } else {
        toast.error("Sim gate blocked promote.");
      }
    });
  }

  function promote() {
    const manifestRaw = parseManifestInput();
    if (manifestRaw === null) return;

    startTransition(async () => {
      const result = await promoteVenueManifest({
        manifestRaw,
        sessionId: sessionId || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
        if (result.violations?.length) {
          console.error(result.violations);
        }
        return;
      }

      toast.success(`Manifest promoted as v${result.version}.`);
      const refreshed = await loadDenisManifestAdminState();
      if (!("error" in refreshed)) {
        setHistory(refreshed.history);
        setActiveVersion(refreshed.activeVersion);
        if (refreshed.activeManifest) {
          setManifestText(JSON.stringify(refreshed.activeManifest, null, 2));
        }
      }
      setGate(null);
    });
  }

  function rollback() {
    startTransition(async () => {
      const result = await rollbackVenueManifest();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`Rolled back to manifest v${result.version}.`);
      const refreshed = await loadDenisManifestAdminState();
      if (!("error" in refreshed)) {
        setHistory(refreshed.history);
        setActiveVersion(refreshed.activeVersion);
        if (refreshed.activeManifest) {
          setManifestText(JSON.stringify(refreshed.activeManifest, null, 2));
        }
      }
      setGate(null);
    });
  }

  return (
    <QrCard className="border-border/80 bg-card/80">
      <QrCardTitle>Manifest promote (sim gate)</QrCardTitle>
      <QrCardDescription>
        ADR-031 C5 / MR-8 — promote venue manifest only after quality contract +
        timeline sim pass. Rollback restores the previous version.
      </QrCardDescription>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Active version</span>
          <p className="font-medium text-foreground">
            {activeVersion != null ? `v${activeVersion}` : "none"}
          </p>
        </div>
        <label className="block text-sm">
          <span className="font-medium text-foreground/90">Replay session</span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          >
            <option value="">No session (eval-only gate)</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.tableName ?? session.tableId.slice(0, 8)} ·{" "}
                {session.timelineEventCount} events
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm">
        <span className="font-medium text-foreground/90">Proposed manifest JSON</span>
        <textarea
          className="mt-1 min-h-[220px] w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          value={manifestText}
          onChange={(e) => {
            setManifestText(e.target.value);
            setGate(null);
          }}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={runGate}>
          Run sim gate
        </Button>
        <Button
          type="button"
          disabled={pending || !gate?.ok}
          onClick={promote}
        >
          Promote manifest
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || history.length < 2}
          onClick={rollback}
        >
          Rollback
        </Button>
      </div>

      {gate ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3 text-sm">
          <p
            className={
              gate.ok
                ? "font-medium text-emerald-400"
                : "font-medium text-amber-400"
            }
          >
            Gate {gate.ok ? "PASS" : "BLOCKED"}
            {gate.requiresTimelineSim ? " · timeline sim required" : ""}
          </p>
          {gate.violations.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-300/90">
              {gate.violations.map((violation) => (
                <li key={violation}>{violation}</li>
              ))}
            </ul>
          ) : null}
          {gate.simReport ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Sim: {gate.simReport.baselineLabel} → {gate.simReport.counterfactualLabel}
              · Δ conflicts {gate.simReport.metrics.delta.conflictTurns} · planner
              changed {gate.simReport.metrics.delta.plannerChangedTurns}
            </p>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="mt-4 text-xs text-muted-foreground">
          History:{" "}
          {history
            .slice(0, 5)
            .map((row) => `v${row.version} (${row.promotedAt.slice(0, 10)})`)
            .join(" · ")}
        </div>
      ) : null}
    </QrCard>
  );
}
