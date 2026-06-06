"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  createOperatorApiKeyAction,
  revokeOperatorApiKeyAction,
} from "@/lib/admin/operator-api-actions";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OperatorApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export function OperatorApiKeysPanel({
  keys,
  canEdit,
}: {
  keys: OperatorApiKeyRow[];
  canEdit: boolean;
}) {
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const activeKeys = keys.filter((k) => !k.revoked_at);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setPending(true);
    const fd = new FormData();
    fd.set("name", name);
    const result = await createOperatorApiKeyAction(fd);
    setPending(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    if ("data" in result && result.data) {
      setCreatedKey((result.data as { rawKey: string }).rawKey);
      setName("");
      toast.success("Operator API key created — copy it now.");
    }
  }

  async function handleRevoke(id: string) {
    const result = await revokeOperatorApiKeyAction(id);
    if ("error" in result && result.error) toast.error(result.error);
    else toast.success("Operator API key revoked");
  }

  return (
    <AdminPanel
      className="max-w-2xl"
      title="Operator API keys (Viktor)"
      description={
        <>
          Za Viktor / operator AI integraciju. Bearer{" "}
          <code className="rounded bg-muted px-1 text-foreground">dns_op_live_*</code>{" "}
          · scope <code className="rounded bg-muted px-1">operator:read</code>
        </>
      }
    >
      {createdKey && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-200">Copy your new key (shown once)</p>
          <code className="mt-2 block break-all text-xs text-amber-100">{createdKey}</code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => {
              void navigator.clipboard.writeText(createdKey);
              toast.success("Copied");
            }}
          >
            Copy
          </Button>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Viktor quick start</p>
        <p className="mt-1">
          Header: <code>X-Denis-Operator-Api-Version: 1</code> · Base:{" "}
          <code>/api/operator/v1/</code>
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-muted/30 p-2 text-[11px] text-foreground">
{`curl -H "Authorization: Bearer dns_op_live_…" \\
  -H "X-Denis-Org-Id: {orgId}" \\
  https://your-domain/api/operator/v1/locations`}
        </pre>
      </div>

      {canEdit && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="operator-key-name">Key name</Label>
            <Input
              id="operator-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Viktor production"
              className="mt-1"
              required
            />
          </div>
          <Button type="submit" disabled={pending || !name.trim()}>
            Create operator key
          </Button>
        </form>
      )}

      <ul className="mt-6 space-y-2">
        {activeKeys.map((key) => (
          <li
            key={key.id}
            className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium text-foreground">{key.name}</p>
              <p className="text-xs text-muted-foreground">
                {key.key_prefix}… · {key.scopes.join(", ")}
                {key.last_used_at &&
                  ` · last used ${new Date(key.last_used_at).toLocaleDateString()}`}
              </p>
            </div>
            {canEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleRevoke(key.id)}
              >
                Revoke
              </Button>
            )}
          </li>
        ))}
        {activeKeys.length === 0 && (
          <p className="text-sm text-muted-foreground">No active operator API keys.</p>
        )}
      </ul>
    </AdminPanel>
  );
}
