"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  createWebhookAction,
  deleteWebhookAction,
  testWebhookAction,
  toggleWebhookAction,
} from "@/lib/admin/api-integration-actions";
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  type WebhookEvent,
} from "@/lib/webhooks/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  failure_count: number;
  created_at: string;
};

export function WebhooksPanel({
  webhooks,
  canEdit,
}: {
  webhooks: WebhookRow[];
  canEdit: boolean;
}) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["order.created", "order.paid"]);
  const [pending, setPending] = useState(false);

  function toggleEvent(event: WebhookEvent) {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setPending(true);
    const fd = new FormData();
    fd.set("url", url);
    fd.set("events", events.join(","));
    const result = await createWebhookAction(fd);
    setPending(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    setUrl("");
    toast.success("Webhook added");
  }

  return (
    <div className="max-w-2xl rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Webhooks</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Outbound HTTPS notifications with HMAC-SHA256 signatures. Auto-disabled after
        10 failures.
      </p>

      {canEdit && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/qr-order"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label>Events</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <button
                  key={event}
                  type="button"
                  onClick={() => toggleEvent(event)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    events.includes(event)
                      ? "bg-violet-600 text-white"
                      : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {WEBHOOK_EVENT_LABELS[event]}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={pending || !url.trim() || !events.length}>
            Add webhook
          </Button>
        </form>
      )}

      <ul className="mt-6 space-y-3">
        {webhooks.map((hook) => (
          <li
            key={hook.id}
            className="rounded-lg border border-neutral-100 px-3 py-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{hook.url}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {hook.events.join(", ")}
                </p>
                {!hook.is_active && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    Auto-disabled ({hook.failure_count} failures)
                  </p>
                )}
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const result = await testWebhookAction(hook.id);
                      if ("error" in result && result.error) toast.error(result.error);
                      else toast.success("Test webhook sent");
                    }}
                  >
                    Test
                  </Button>
                  {hook.is_active ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await toggleWebhookAction(hook.id, false);
                        toast.success("Webhook disabled");
                      }}
                    >
                      Disable
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await toggleWebhookAction(hook.id, true);
                        toast.success("Webhook enabled");
                      }}
                    >
                      Enable
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await deleteWebhookAction(hook.id);
                      toast.success("Webhook removed");
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
        {webhooks.length === 0 && (
          <p className="text-sm text-neutral-500">No webhooks configured.</p>
        )}
      </ul>
    </div>
  );
}
