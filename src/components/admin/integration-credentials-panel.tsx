"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  storeIntegrationCredential,
  listIntegrationCredentials,
  deleteIntegrationCredential,
} from "@/lib/denis/integrations/secrets/secrets-actions";
import type { CredentialMetadata } from "@/lib/denis/integrations/secrets/secrets-manager";
import { CONNECTOR_CATALOG } from "@/lib/integrations/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ENVIRONMENT_LABELS: Record<CredentialMetadata["environment"], string> = {
  sandbox: "Sandbox",
  production: "Produkcija",
};

const CREDENTIAL_TYPE_LABELS: Record<
  CredentialMetadata["credentialType"],
  string
> = {
  api_key: "API ključ",
  basic_auth: "Basic Auth",
  oauth2_client_credentials: "OAuth2 Client Credentials",
  bearer_token: "Bearer token",
  hmac_secret: "HMAC secret",
  webhook_secret: "Webhook secret",
  mtls_cert: "mTLS sertifikat",
};

export function IntegrationCredentialsPanel() {
  const [providerId, setProviderId] = useState(CONNECTOR_CATALOG[0]?.id ?? "");
  const [environment, setEnvironment] =
    useState<CredentialMetadata["environment"]>("sandbox");
  const [credentialType, setCredentialType] =
    useState<CredentialMetadata["credentialType"]>("api_key");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rows, setRows] = useState<CredentialMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (pid: string) => {
    if (!pid) return;
    const data = await listIntegrationCredentials(pid);
    setRows(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    queueMicrotask(async () => {
      try {
        await reload(providerId);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Kredencijali nisu mogli da se učitaju."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [providerId, reload]);

  async function handleStore() {
    if (!providerId || !value.trim()) return;
    setPending(true);
    try {
      const result = await storeIntegrationCredential({
        providerId,
        environment,
        credentialType,
        value: value.trim(),
      });
      if (!result.ok) {
        toast.error("Čuvanje nije uspelo: " + result.error);
        return;
      }
      toast.success("Kredencijal sačuvan (šifrovan).");
      setValue("");
      await reload(providerId);
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      const ok = await deleteIntegrationCredential(id);
      if (!ok) {
        toast.error("Brisanje nije uspelo.");
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h2 className="mb-1 text-sm font-semibold">Dodaj kredencijal</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Vrednost se odmah šifruje (pgcrypto) i nikad se ne prikazuje ovde
          ponovo — LLM je nikad ne vidi direktno, samo referencu.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Provider</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTOR_CATALOG.map((connector) => (
                  <SelectItem key={connector.id} value={connector.id}>
                    {connector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Okruženje</Label>
            <Select
              value={environment}
              onValueChange={(v) =>
                setEnvironment(v as CredentialMetadata["environment"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ENVIRONMENT_LABELS) as Array<
                  CredentialMetadata["environment"]
                >).map((key) => (
                  <SelectItem key={key} value={key}>
                    {ENVIRONMENT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tip</Label>
            <Select
              value={credentialType}
              onValueChange={(v) =>
                setCredentialType(v as CredentialMetadata["credentialType"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CREDENTIAL_TYPE_LABELS) as Array<
                  CredentialMetadata["credentialType"]
                >).map((key) => (
                  <SelectItem key={key} value={key}>
                    {CREDENTIAL_TYPE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Vrednost</Label>
            <Input
              type="password"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="npr. sk_live_..."
            />
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={handleStore}
          disabled={pending || !providerId || !value.trim()}
        >
          {pending ? "Čuvam…" : "Sačuvaj"}
        </Button>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-sm font-semibold">
          Sačuvani kredencijali za ovog provajdera
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Učitavam…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nema sačuvanih kredencijala za ovog provajdera.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">
                    {CREDENTIAL_TYPE_LABELS[row.credentialType]}
                  </span>
                  <span className="ml-2 rounded-full bg-muted/50 px-2 py-0.5 text-xs">
                    {ENVIRONMENT_LABELS[row.environment]}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    dodato{" "}
                    {formatDistanceToNow(new Date(row.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busyId === row.id}
                  onClick={() => handleDelete(row.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
