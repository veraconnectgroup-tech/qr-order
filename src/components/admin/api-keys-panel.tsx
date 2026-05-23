"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  createApiKeyAction,
  revokeApiKeyAction,
} from "@/lib/admin/api-integration-actions";
import {
  API_SCOPES,
  API_SCOPE_LABELS,
  type ApiScope,
} from "@/lib/api/v1/scopes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export function ApiKeysPanel({
  keys,
  canEdit,
}: {
  keys: ApiKeyRow[];
  canEdit: boolean;
}) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>([
    "orders:read",
    "menu:read",
  ]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const activeKeys = keys.filter((k) => !k.revoked_at);

  function toggleScope(scope: ApiScope) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setPending(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("scopes", selectedScopes.join(","));
    const result = await createApiKeyAction(fd);
    setPending(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    if ("data" in result && result.data) {
      setCreatedKey((result.data as { rawKey: string }).rawKey);
      setName("");
      toast.success("API key created — copy it now, it won't be shown again.");
    }
  }

  async function handleRevoke(id: string) {
    const result = await revokeApiKeyAction(id);
    if ("error" in result && result.error) toast.error(result.error);
    else toast.success("API key revoked");
  }

  return (
    <div className="max-w-2xl rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">API keys</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Authenticate public API requests with the{" "}
        <code className="rounded bg-neutral-100 px-1">X-API-Key</code> header.
      </p>

      {createdKey && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Copy your new key</p>
          <code className="mt-2 block break-all text-xs text-amber-950">{createdKey}</code>
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

      {canEdit && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="key-name">Key name</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="POS integration"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label>Scopes</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {API_SCOPES.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    selectedScopes.includes(scope)
                      ? "bg-blue-600 text-white"
                      : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {API_SCOPE_LABELS[scope]}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={pending || !name.trim()}>
            Create API key
          </Button>
        </form>
      )}

      <ul className="mt-6 space-y-2">
        {activeKeys.map((key) => (
          <li
            key={key.id}
            className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">{key.name}</p>
              <p className="text-xs text-neutral-500">
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
          <p className="text-sm text-neutral-500">No active API keys.</p>
        )}
      </ul>
    </div>
  );
}
