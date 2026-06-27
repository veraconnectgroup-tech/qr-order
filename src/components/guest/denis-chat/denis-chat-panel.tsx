"use client";

import { type FormEvent, type RefObject } from "react";
import { Send, X } from "lucide-react";
import {
  DenisPanel,
  DenisPanelBody,
  DenisPanelFooter,
  DenisPanelHeader,
} from "@/components/design-system/denis-panel";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { DenisMessageThinking } from "@/components/design-system/denis-message-block";
import { DenisCartHeaderLink } from "@/components/guest/denis-cart-tiles";
import { DenisVoiceMicButton } from "@/components/guest/denis-voice-mic-button";
import { DenisWelcome } from "@/components/guest/denis-welcome";
import { DenisFallbackPanel } from "@/components/guest/denis-fallback";
import { DenisChatMessageRow } from "@/components/guest/denis-chat/denis-chat-message-row";
import type { ChatMessage, ChatPhase } from "@/components/guest/denis-chat/types";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import { cn } from "@/lib/utils";

export function DenisChatPanel({
  overlayRef,
  scrollRef,
  footerRef,
  inputRef,
  inputFocused,
  setInputFocused,
  slug,
  token,
  taxPercent,
  currency,
  orderingDisabled,
  onOpenChange,
  tUI,
  tChat,
  markState,
  situationHeadline,
  isTyping,
  thinkingHeadline,
  voiceEnabled,
  voice,
  cartAnnouncement,
  welcomeVisible,
  showDenisFallback,
  fallbackLevel,
  menuLocale,
  isReturning,
  chatLanguage,
  tableName,
  messages,
  addedIds,
  phase,
  input,
  setInput,
  canSend,
  inputEnabled,
  onSend,
  onVoiceTranscript,
  onWelcomeChipSelect,
  scrollToBottom,
  onQuickPickConfirm,
  onQuickReply,
  onAddRecommendation,
  onFallbackBrowseMenu,
  onFallbackCallWaiter,
  onFallbackOrderStandard,
}: {
  overlayRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  footerRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  inputFocused: boolean;
  setInputFocused: (focused: boolean) => void;
  slug: string;
  token: string;
  taxPercent: number;
  currency: string;
  orderingDisabled: boolean;
  onOpenChange: (open: boolean) => void;
  tUI: (key: string, vars?: Record<string, string | number>) => string;
  tChat: (key: string, vars?: Record<string, string | number>) => string;
  markState: "idle" | "listen" | "think";
  situationHeadline: string | null;
  isTyping: boolean;
  thinkingHeadline: string | null;
  voiceEnabled: boolean;
  voice: {
    listening: boolean;
    supported: boolean;
    startListening: (onTranscript: (text: string) => void) => void;
    stopListening: () => void;
  };
  cartAnnouncement: string;
  welcomeVisible: boolean;
  showDenisFallback: boolean;
  fallbackLevel: 1 | 2 | 3 | 4;
  menuLocale: string;
  isReturning: boolean;
  chatLanguage: string;
  tableName: string;
  messages: ChatMessage[];
  addedIds: Set<string>;
  phase: ChatPhase;
  input: string;
  setInput: (value: string) => void;
  canSend: boolean;
  inputEnabled: boolean;
  onSend: (e: FormEvent) => void;
  onVoiceTranscript: (transcript: string) => void;
  onWelcomeChipSelect: (text: string) => void;
  scrollToBottom: () => void;
  onQuickPickConfirm: (messageId: string, ids: string[]) => void;
  onQuickReply: (messageId: string, label: string) => void;
  onAddRecommendation: (rec: ProductRecommendation) => void;
  onFallbackBrowseMenu: () => void;
  onFallbackCallWaiter: () => void;
  onFallbackOrderStandard?: () => void;
}) {
  return (
    <div
      ref={overlayRef}
      className={cn(
        "guest-theme denis-chat-overlay sm:justify-end sm:bg-black/70",
        inputFocused && "denis-chat-overlay--keyboard"
      )}
    >
      <DenisPanel
        className={cn(
          "denis-chat-panel relative mx-0 mb-0 h-full min-h-0 max-h-full flex-1 rounded-none sm:mx-3 sm:mb-3 sm:h-auto sm:max-h-[min(88dvh,720px)] sm:w-auto sm:flex-none sm:rounded-2xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-0.5 before:bg-[var(--qr-ember)] before:content-['']"
        )}
      >
        <DenisPanelHeader
          className={cn(
            "relative shrink-0 border-b border-[var(--qr-elevated)]",
            inputFocused ? "gap-2 py-2 pt-3" : "pt-5"
          )}
        >
          <div className="min-w-0 flex-1 overflow-hidden">
            <DenisBrandMark
              markSize={24}
              markState={
                isTyping ? "think" : voice.listening ? "listen" : markState
              }
              className="max-w-full [&_.text-dash-text-muted]:text-[var(--qr-muted)] [&_.text-dash-text]:text-[var(--qr-ivory)]"
            />
            {(thinkingHeadline || situationHeadline) && !inputFocused ? (
              <p className="mt-1 line-clamp-1 text-[12px] text-[var(--qr-muted)]">
                {thinkingHeadline ?? situationHeadline}
              </p>
            ) : null}
          </div>
          {!orderingDisabled && !inputFocused ? (
            <DenisCartHeaderLink
              slug={slug}
              token={token}
              taxPercent={taxPercent}
              currency={currency}
            />
          ) : null}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="touch-target inline-flex size-9 shrink-0 items-center justify-center text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)]"
            aria-label={tUI("ai.chat.close")}
          >
            <X className="size-5" strokeWidth={1.5} />
          </button>
        </DenisPanelHeader>

        <DenisPanelBody
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label={tUI("a11y.chatConversation")}
        >
          <div aria-live="assertive" aria-atomic="true" className="sr-only">
            {cartAnnouncement}
          </div>
          {welcomeVisible && !showDenisFallback && messages.length === 0 ? (
            <DenisWelcome
              locale={menuLocale}
              isReturning={isReturning}
              onChipSelect={(chipInput) => onWelcomeChipSelect(chipInput)}
              className="px-1 pb-2"
            />
          ) : null}
          {showDenisFallback ? (
            <DenisFallbackPanel
              level={fallbackLevel}
              locale={chatLanguage}
              tableLabel={tableName || undefined}
              onBrowseMenu={onFallbackBrowseMenu}
              onCallWaiter={onFallbackCallWaiter}
              onOrderStandard={onFallbackOrderStandard}
              className="mb-3"
            />
          ) : null}
          {messages.map((message, index) => (
            <DenisChatMessageRow
              key={message.id}
              message={message}
              currency={currency}
              orderingDisabled={orderingDisabled}
              addedIds={addedIds}
              tUI={tUI}
              continueLabel={tUI("ai.chat.continue")}
              markState={
                isTyping &&
                index === messages.length - 1 &&
                message.role === "assistant"
                  ? "think"
                  : "idle"
              }
              onQuickPickConfirm={
                message.quickPicks && !message.quickPicks.confirmed
                  ? onQuickPickConfirm
                  : undefined
              }
              onQuickReply={phase === "chat" ? onQuickReply : undefined}
              onAddRecommendation={onAddRecommendation}
            />
          ))}
          {isTyping &&
          (messages.length === 0 ||
            messages[messages.length - 1]?.role === "user") ? (
            <DenisMessageThinking label={thinkingHeadline} />
          ) : null}
        </DenisPanelBody>

        <DenisPanelFooter
          ref={footerRef}
          className="w-full min-w-0 max-w-full shrink-0 overflow-hidden border-t border-[var(--qr-elevated)] bg-[var(--qr-void)] !px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:!px-3"
        >
          <form onSubmit={onSend} className="w-full min-w-0 max-w-full">
            <div className="denis-chat-input-row flex w-full min-w-0 max-w-full items-center gap-1.5 rounded-full border border-[var(--qr-elevated)] bg-[var(--qr-surface)] px-2 py-1.5">
              {voiceEnabled && !inputFocused ? (
                <DenisVoiceMicButton
                  listening={voice.listening}
                  supported={voice.supported}
                  disabled={!inputEnabled || isTyping}
                  listenLabel={tUI("ai.voice.listen")}
                  listeningLabel={tUI("ai.voice.listening")}
                  unsupportedLabel={tUI("ai.voice.unsupported")}
                  onPressStart={() => voice.startListening(onVoiceTranscript)}
                  onPressEnd={() => voice.stopListening()}
                />
              ) : null}
              <input
                ref={inputRef}
                type="text"
                enterKeyHint="send"
                inputMode="text"
                autoComplete="off"
                autoCorrect="on"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => {
                  setInputFocused(true);
                  scrollToBottom();
                }}
                onBlur={() => setInputFocused(false)}
                disabled={!inputEnabled}
                placeholder={tChat("ai.chat.askDenis")}
                aria-label={tChat("ai.chat.askDenis")}
                className="min-h-0 min-w-0 flex-1 border-0 bg-transparent py-2 text-base text-[var(--qr-ivory)] placeholder:text-[var(--qr-muted)] outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label={tUI("ai.chat.send")}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--qr-ember)] text-white transition disabled:opacity-30"
              >
                <Send className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </form>
        </DenisPanelFooter>
      </DenisPanel>
    </div>
  );
}
