"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ReaderRow = {
  id: string;
  stripe_reader_id: string;
  label: string;
  status: "online" | "offline";
  last_seen_at: string | null;
};

export function TerminalReadersPanel({
  locationId,
  stripeConnected,
}: {
  locationId: string;
  stripeConnected: boolean;
}) {
  const [readers, setReaders] = useState<ReaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registrationCode, setRegistrationCode] = useState("");
  const [label, setLabel] = useState("Reader Bar");

  const loadReaders = useCallback(async () => {
    if (!stripeConnected) {
      setReaders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/terminal/readers?locationId=${encodeURIComponent(locationId)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load readers.");
      setReaders((json.data.readers ?? []) as ReaderRow[]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load readers."
      );
    } finally {
      setLoading(false);
    }
  }, [locationId, stripeConnected]);

  useEffect(() => {
    void loadReaders();
  }, [loadReaders]);

  async function handleRegister() {
    if (!registrationCode.trim()) {
      toast.error("Enter a registration code.");
      return;
    }

    setRegistering(true);
    try {
      const res = await fetch("/api/terminal/readers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          registrationCode: registrationCode.trim(),
          label: label.trim() || "Reader",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Registration failed.");
      toast.success("Reader registered.");
      setRegistrationCode("");
      await loadReaders();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Registration failed."
      );
    } finally {
      setRegistering(false);
    }
  }

  async function handleRemove(stripeReaderId: string) {
    try {
      const res = await fetch("/api/terminal/readers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, stripeReaderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Remove failed.");
      toast.success("Reader removed.");
      await loadReaders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Remove failed.");
    }
  }

  if (!stripeConnected) {
    return null;
  }

  return (
    <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Stripe Terminal</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Register card readers for in-person payments on staff tablets.
      </p>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="size-4 animate-spin" />
          Loading readers…
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {readers.length === 0 ? (
            <li className="text-sm text-neutral-500">No readers registered yet.</li>
          ) : (
            readers.map((reader) => (
              <li
                key={reader.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{reader.label}</p>
                  <p className="text-xs text-neutral-500">
                    {reader.status === "online" ? "Online" : "Offline"} ·{" "}
                    {reader.stripe_reader_id}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleRemove(reader.stripe_reader_id)}
                  aria-label="Remove reader"
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </li>
            ))
          )}
        </ul>
      )}

      <div className="mt-6 space-y-3 border-t border-neutral-100 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Register new reader
        </p>
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Label (e.g. Reader Bar)"
        />
        <Input
          value={registrationCode}
          onChange={(event) => setRegistrationCode(event.target.value)}
          placeholder="Registration code (test: simulated-wpe)"
        />
        <Button
          type="button"
          className="w-full"
          disabled={registering}
          onClick={() => void handleRegister()}
        >
          {registering ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Registering…
            </>
          ) : (
            <>
              <Plus className="mr-2 size-4" />
              Register reader
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
