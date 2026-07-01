"use client";

import { useState, useTransition } from "react";
import { FlaskConical, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  applyDenisConfigPatchAction,
  clearDenisConfigShadowAction,
  enableDenisConfigShadowAction,
  previewDenisConfigPatchAction,
  rollbackDenisConfigAction,
} from "@/lib/admin/denis-config-versioning-actions";
import type { ConfigChangeLogEntry } from "@/lib/admin/load-config-change-history";
import type { ConfigShadowRecord } from "@/lib/denis/config/config-shadow";
import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLE_PATCH = `{
  "proactive": {
    "enabled": true,
    "maxNudgesPerSession": 3
  }
}`;

export function DenisConfigVersioningPanel({
  history,
  shadow,
  canEdit,
}: {
  history: ConfigChangeLogEntry[];
  shadow: ConfigShadowRecord | null;
  canEdit: boolean;
}) {
  const [patchText, setPatchText] = useState("");
  const [diffLines, setDiffLines] = useState<string[]>([]);
  const [shadowActive, setShadowActive] = useState(shadow);
  const [pending, startTransition] = useTransition();

  function parsePatch(): PartialConciergeConfig | null {
    try {
      return JSON.parse(patchText || "{}") as PartialConciergeConfig;
    } catch {
      toast.error("Invalid JSON patch.");
      return null;
    }
  }

  function onPreview() {
    const patch = parsePatch();
    if (!patch) return;

    startTransition(async () => {
      const result = await previewDenisConfigPatchAction(patch);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setDiffLines(result.diffLines ?? []);
      toast.success("Preview ready — review diff before applying.");
    });
  }

  function onShadowTest() {
    const patch = parsePatch();
    if (!patch) return;

    startTransition(async () => {
      const result = await enableDenisConfigShadowAction({
        patch,
        changeNote: "Owner shadow test",
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setShadowActive(result.shadow ?? null);
      toast.success("Shadow mode enabled for 30 minutes — live config unchanged.");
    });
  }

  function onClearShadow() {
    startTransition(async () => {
      const result = await clearDenisConfigShadowAction();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setShadowActive(null);
      toast.success("Shadow mode cleared.");
    });
  }

  function onApply() {
    const patch = parsePatch();
    if (!patch) return;

    startTransition(async () => {
      const result = await applyDenisConfigPatchAction({
        patch,
        changeNote: "Owner config editor apply",
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setDiffLines(result.diffLines ?? []);
      setShadowActive(null);
      setPatchText("");
      toast.success("Config applied.");
    });
  }

  function onRollback(logId: string) {
    startTransition(async () => {
      const result = await rollbackDenisConfigAction(logId);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setShadowActive(null);
      toast.success("Config rolled back.");
    });
  }

  return (
    <AdminPanel
      className="max-w-2xl"
      title="Denis config versioning"
      description="Preview diffs, shadow-test without saving, apply patches, or roll back."
    >
      <div className="mt-4 space-y-4">
        {shadowActive && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">
                  Shadow mode active
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Denis uses this patch for guest turns until{" "}
                  {new Date(shadowActive.expiresAt).toLocaleString()}. DB config
                  is unchanged.
                </p>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={onClearShadow}
                >
                  Clear shadow
                </Button>
              )}
            </div>
          </div>
        )}

        {canEdit && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Partial JSON patch
            </p>
            <Textarea
              className="min-h-[140px] font-mono text-xs"
              placeholder={EXAMPLE_PATCH}
              value={patchText}
              onChange={(event) => setPatchText(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={onPreview}
              >
                Preview diff
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || !patchText.trim()}
                onClick={onShadowTest}
              >
                <FlaskConical className="mr-1 size-3.5" />
                Shadow test (30 min)
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || !patchText.trim()}
                onClick={onApply}
              >
                Apply patch
              </Button>
            </div>
          </div>
        )}

        {diffLines.length > 0 && (
          <div className="rounded-md border border-border/80 bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap">
            {diffLines.join("\n")}
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="size-4 text-orange-500" />
            Change history
          </div>
          <ul className="space-y-2">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {entry.changedBy} ·{" "}
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {entry.reason ?? entry.configPath ?? "config change"}
                  </p>
                </div>
                {canEdit && entry.oldValue && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onRollback(entry.id)}
                  >
                    <RotateCcw className="mr-1 size-3.5" />
                    Rollback
                  </Button>
                )}
              </li>
            ))}
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No config changes logged yet.
              </p>
            )}
          </ul>
        </div>
      </div>
    </AdminPanel>
  );
}
