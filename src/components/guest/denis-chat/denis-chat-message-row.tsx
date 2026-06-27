"use client";

import { useState, type KeyboardEvent } from "react";
import { DenisChip } from "@/components/design-system/denis-chip";
import { DenisMessageBlock } from "@/components/design-system/denis-message-block";
import {
  ProductRecommendationCard,
  type ProductRecommendation,
} from "@/components/guest/product-recommendation-card";
import type { ChatMessage, QuickPickOption } from "@/components/guest/denis-chat/types";

export function DenisChatRecommendations({
  recommendations,
  currency,
  orderingDisabled,
  addedIds,
  onAdd,
}: {
  recommendations: ProductRecommendation[];
  currency: string;
  orderingDisabled: boolean;
  addedIds: Set<string>;
  onAdd: (rec: ProductRecommendation) => void;
}) {
  if (!recommendations.length) return null;

  return (
    <div className="mt-4 divide-y divide-[var(--qr-elevated)]/80">
      {recommendations.map((rec) => (
        <ProductRecommendationCard
          key={rec.productId}
          recommendation={rec}
          currency={currency}
          compact
          orderingDisabled={orderingDisabled || addedIds.has(rec.productId)}
          onAddClick={() => onAdd(rec)}
        />
      ))}
    </div>
  );
}

function DenisChatQuickPicks({
  options,
  mode,
  confirmed,
  onConfirm,
  continueLabel,
}: {
  options: QuickPickOption[];
  mode: "multi" | "single";
  confirmed: boolean;
  onConfirm: (ids: string[]) => void;
  continueLabel: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    if (confirmed) return;
    if (mode === "single") {
      setSelected((prev) => (prev.includes(id) ? [] : [id]));
      return;
    }
    if (id === "keine") {
      setSelected(["keine"]);
      return;
    }
    setSelected((prev) => {
      const withoutKeine = prev.filter((item) => item !== "keine");
      if (withoutKeine.includes(id)) {
        return withoutKeine.filter((item) => item !== id);
      }
      return [...withoutKeine, id];
    });
  }

  const canContinue = mode === "multi" || selected.length === 1;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <DenisChip
              key={option.id}
              label={option.label}
              disabled={confirmed}
              selected={isSelected}
              onClick={() => toggle(option.id)}
            />
          );
        })}
      </div>
      {!confirmed && (
        <button
          type="button"
          disabled={!canContinue}
          onClick={() =>
            onConfirm(
              selected.length > 0
                ? selected
                : mode === "multi"
                  ? ["keine"]
                  : selected
            )
          }
          className="mt-4 text-sm text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {continueLabel}
        </button>
      )}
    </div>
  );
}

function DenisChatQuickReplies({
  options,
  used,
  onSelect,
  toolbarLabel,
}: {
  options: string[];
  used: boolean;
  onSelect: (label: string) => void;
  toolbarLabel: string;
}) {
  const [focusIndex, setFocusIndex] = useState(0);

  function handleKeyDown(e: KeyboardEvent, index: number) {
    if (used) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((index + 1) % options.length);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((index - 1 + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(options[index]!);
    }
  }

  return (
    <div
      role="toolbar"
      aria-label={toolbarLabel}
      className="mt-3 flex flex-wrap gap-2"
    >
      {options.map((option, index) => (
        <button
          key={option}
          type="button"
          role="option"
          aria-selected={index === focusIndex}
          tabIndex={index === focusIndex ? 0 : -1}
          disabled={used}
          aria-label={option}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onFocus={() => setFocusIndex(index)}
          onClick={() => onSelect(option)}
          className="touch-target rounded-full border border-[var(--qr-elevated)] bg-[var(--qr-surface)] px-3 py-1.5 text-sm text-[var(--qr-ivory)] transition hover:border-[var(--qr-ember)] disabled:opacity-40"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function DenisChatMessageRow({
  message,
  currency,
  orderingDisabled,
  addedIds,
  onQuickPickConfirm,
  onQuickReply,
  onAddRecommendation,
  continueLabel,
  markState = "idle",
  tUI,
}: {
  message: ChatMessage;
  currency: string;
  orderingDisabled: boolean;
  addedIds: Set<string>;
  onQuickPickConfirm?: (messageId: string, ids: string[]) => void;
  onQuickReply?: (messageId: string, label: string) => void;
  onAddRecommendation: (rec: ProductRecommendation) => void;
  continueLabel: string;
  markState?: "idle" | "listen" | "think";
  tUI: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (message.role === "user") {
    return (
      <div role="article" aria-label={tUI("a11y.chatYouSaid")}>
        <DenisMessageBlock role="user">{message.content}</DenisMessageBlock>
      </div>
    );
  }

  return (
    <div role="article" aria-label={tUI("a11y.chatDenisSays")}>
      <DenisMessageBlock role="assistant" markState={markState}>
        <p className="whitespace-pre-wrap text-[15px] leading-[1.65] text-[var(--qr-ivory)]">
          {message.content}
        </p>
        {message.quickPicks && onQuickPickConfirm && (
          <DenisChatQuickPicks
            options={message.quickPicks.options}
            mode={message.quickPicks.mode}
            confirmed={message.quickPicks.confirmed}
            continueLabel={continueLabel}
            onConfirm={(ids) => onQuickPickConfirm(message.id, ids)}
          />
        )}
        {message.quickReplies?.length && onQuickReply && (
          <DenisChatQuickReplies
            options={message.quickReplies}
            used={message.quickRepliesUsed ?? false}
            toolbarLabel={tUI("a11y.quickReplies")}
            onSelect={(label) => onQuickReply(message.id, label)}
          />
        )}
        {message.recommendations && (
          <DenisChatRecommendations
            recommendations={message.recommendations}
            currency={currency}
            orderingDisabled={orderingDisabled}
            addedIds={addedIds}
            onAdd={onAddRecommendation}
          />
        )}
      </DenisMessageBlock>
    </div>
  );
}
