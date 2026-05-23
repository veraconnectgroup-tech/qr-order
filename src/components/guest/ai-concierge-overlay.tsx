"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Sparkles, Volume2, X } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { MenuCategory } from "@/components/guest/menu-grid";
import {
  ProductRecommendationCard,
  type ProductRecommendation,
} from "@/components/guest/product-recommendation-card";
import type { AiChatRecommendation } from "@/lib/ai/parse-response";
import {
  clearAiSessionId,
  completeAiSession,
  readAiSessionId,
  writeAiSessionId,
} from "@/lib/ai/guest-session-storage";
import { inferMenuSection, type MenuSection } from "@/lib/menu-section";
import type { ProductWithModifiers } from "@/types";

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  message: string;
  recommendations?: ProductRecommendation[];
};

export function AiConciergeOverlay({
  open,
  onOpenChange,
  orgName,
  locationId,
  tableId,
  sessionToken,
  currency,
  categories,
  orderingDisabled = false,
  onOpenProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  locationId: string;
  tableId: string;
  sessionToken: string | null;
  currency: string;
  categories: MenuCategory[];
  orderingDisabled?: boolean;
  onOpenProduct?: (product: ProductWithModifiers) => void;
}) {
  const { tUI, menuLocale, isEnglish } = useAppLocale();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const language = isEnglish ? "en" : menuLocale;

  const productById = useMemo(() => {
    const map = new Map<string, ProductWithModifiers>();
    for (const category of categories) {
      for (const product of category.products) {
        map.set(product.id, product);
      }
    }
    return map;
  }, [categories]);

  const menuSectionByProductId = useMemo(() => {
    const map = new Map<string, MenuSection>();
    for (const category of categories) {
      const section = inferMenuSection(category);
      for (const product of category.products) {
        map.set(product.id, section);
      }
    }
    return map;
  }, [categories]);

  useEffect(() => {
    if (!open || !sessionToken) return;
    const stored = readAiSessionId(locationId, sessionToken);
    setAiSessionId(stored);
  }, [open, locationId, sessionToken]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [entries, loading, open]);

  const handleClose = useCallback(() => {
    if (aiSessionId && sessionToken) {
      void completeAiSession({
        sessionId: aiSessionId,
        locationId,
        tableId,
        sessionToken,
      });
      clearAiSessionId(locationId, sessionToken);
      setAiSessionId(null);
    }
    onOpenChange(false);
  }, [
    aiSessionId,
    locationId,
    onOpenChange,
    sessionToken,
    tableId,
  ]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || !sessionToken) return;

    const userEntry: ChatEntry = {
      id: `u-${Date.now()}`,
      role: "user",
      message: text,
    };

    setEntries((prev) => [...prev, userEntry]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          tableId,
          sessionToken,
          message: text,
          language,
          sessionId: aiSessionId ?? undefined,
          includeOrderContext: true,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const errMsg =
          json.error ??
          (res.status === 402
            ? tUI("ai.overlay.noCredits")
            : res.status === 503
              ? tUI("ai.overlay.unavailable")
              : tUI("ai.overlay.error"));
        setEntries((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            message: errMsg,
          },
        ]);
        return;
      }

      const data = json.data as {
        message: string;
        recommendations: AiChatRecommendation[];
        sessionId: string;
      };

      if (data.sessionId) {
        writeAiSessionId(locationId, sessionToken, data.sessionId);
        setAiSessionId(data.sessionId);
      }

      setEntries((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          message: data.message,
          recommendations: data.recommendations,
        },
      ]);
    } catch {
      setEntries((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          message: tUI("ai.overlay.error"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isEnglish ? "en-US" : `${menuLocale}-${menuLocale.toUpperCase()}`;
    window.speechSynthesis.speak(utterance);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {tUI("ai.intro.title")}
          </p>
          <p className="truncate text-xs text-zinc-500">{orgName}</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex size-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          aria-label={tUI("common.close")}
        >
          <X className="size-5" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {entries.length === 0 && (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
            {tUI("ai.overlay.welcome")}
          </p>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            className={
              entry.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div
              className={
                entry.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-orange-500 px-4 py-2.5 text-sm text-white"
                  : "max-w-full space-y-3"
              }
            >
              {entry.role === "assistant" && (
                <div className="flex items-start gap-2">
                  <p className="flex-1 rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100">
                    {entry.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => speak(entry.message)}
                    className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                    aria-label={tUI("ai.overlay.listen")}
                  >
                    <Volume2 className="size-4" />
                  </button>
                </div>
              )}
              {entry.role === "user" && entry.message}

              {entry.recommendations && entry.recommendations.length > 0 && (
                <div className="space-y-3">
                  {entry.recommendations.map((rec) => {
                    const product = productById.get(rec.productId);
                    const hasModifiers =
                      (product?.modifier_groups?.length ?? 0) > 0;
                    return (
                      <ProductRecommendationCard
                        key={`${entry.id}-${rec.productId}`}
                        recommendation={rec}
                        currency={currency}
                        menuSection={
                          menuSectionByProductId.get(rec.productId) ?? "food"
                        }
                        productTaxRate={
                          product?.tax_rate != null
                            ? Number(product.tax_rate)
                            : null
                        }
                        orderingDisabled={orderingDisabled}
                        onOpenDetail={
                          hasModifiers && onOpenProduct && product
                            ? () => onOpenProduct(product)
                            : undefined
                        }
                        aiSessionId={aiSessionId}
                        conversionContext={
                          aiSessionId && sessionToken
                            ? {
                                sessionId: aiSessionId,
                                locationId,
                                tableId,
                                sessionToken,
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            {tUI("ai.overlay.thinking")}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 bg-zinc-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tUI("ai.overlay.placeholder")}
            maxLength={500}
            disabled={loading || !sessionToken}
            className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-700"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || !sessionToken}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600 disabled:opacity-50"
            aria-label={tUI("ai.overlay.send")}
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
