"use client";

import { createPortal } from "react-dom";
import { DenisChatPanel } from "@/components/guest/denis-chat/denis-chat-panel";
import type { AiConciergeChatProps } from "@/components/guest/denis-chat/props";
import { useDenisChatController } from "@/hooks/use-denis-chat-controller";

export type { AiConciergeChatProps } from "@/components/guest/denis-chat/props";

export function AiConciergeChat(props: AiConciergeChatProps) {
  const panel = useDenisChatController(props);

  if (!panel.open) return null;

  return createPortal(
    <DenisChatPanel
      overlayRef={panel.overlayRef}
      scrollRef={panel.scrollRef}
      footerRef={panel.footerRef}
      inputRef={panel.inputRef}
      inputFocused={panel.inputFocused}
      setInputFocused={panel.setInputFocused}
      slug={panel.slug}
      token={panel.token}
      taxPercent={panel.taxPercent}
      currency={panel.currency}
      orderingDisabled={panel.orderingDisabled}
      onOpenChange={panel.onOpenChange}
      tUI={panel.tUI}
      tChat={panel.tChat}
      markState={panel.markState}
      situationHeadline={panel.situationHeadline}
      isTyping={panel.isTyping}
      thinkingHeadline={panel.thinkingHeadline}
      voiceEnabled={panel.voiceEnabled}
      voice={panel.voice}
      cartAnnouncement={panel.cartAnnouncement}
      welcomeVisible={panel.welcomeVisible}
      showDenisFallback={panel.showDenisFallback}
      fallbackLevel={panel.fallbackLevel}
      menuLocale={panel.menuLocale}
      isReturning={panel.isReturning}
      chatLanguage={panel.chatLanguage}
      tableName={panel.tableName}
      messages={panel.messages}
      addedIds={panel.addedIds}
      phase={panel.phase}
      input={panel.input}
      setInput={panel.setInput}
      canSend={panel.canSend}
      inputEnabled={panel.inputEnabled}
      onSend={panel.handleSend}
      onVoiceTranscript={panel.handleVoiceTranscript}
      onWelcomeChipSelect={panel.onWelcomeChipSelect}
      scrollToBottom={panel.scrollToBottom}
      onQuickPickConfirm={panel.onQuickPickConfirm}
      onQuickReply={panel.onQuickReply}
      onAddRecommendation={panel.onAddRecommendation}
      onFallbackBrowseMenu={panel.handleFallbackBrowseMenu}
      onFallbackCallWaiter={panel.handleFallbackCallWaiter}
      onFallbackOrderStandard={panel.handleFallbackOrderStandard}
    />,
    document.body
  );
}
