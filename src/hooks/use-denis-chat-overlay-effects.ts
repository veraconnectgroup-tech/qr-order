"use client";

import { useEffect, type RefObject } from "react";

export function useDenisChatOverlayEffects(input: {
  open: boolean;
  inputFocused: boolean;
  messagesLength: number;
  isTyping: boolean;
  overlayRef: RefObject<HTMLDivElement | null>;
  scrollToBottom: () => void;
}) {
  useEffect(() => {
    input.scrollToBottom();
  }, [input.messagesLength, input.isTyping, input.scrollToBottom]);

  useEffect(() => {
    if (!input.open) return;
    input.scrollToBottom();
  }, [input.open, input.inputFocused, input.scrollToBottom]);

  useEffect(() => {
    if (!input.open) return;
    document.documentElement.classList.add("denis-chat-open");
    return () => {
      document.documentElement.classList.remove("denis-chat-open");
    };
  }, [input.open]);

  useEffect(() => {
    if (!input.open) return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [input.open]);

  useEffect(() => {
    if (!input.open) return;

    const overlay = input.overlayRef.current;
    const viewport = window.visualViewport;
    if (!overlay || !viewport) return;

    const sync = () => {
      overlay.style.setProperty(
        "--denis-vv-offset",
        `${Math.max(0, viewport.offsetTop)}px`
      );
      overlay.style.setProperty("--denis-vv-height", `${viewport.height}px`);
    };

    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
      overlay.style.removeProperty("--denis-vv-offset");
      overlay.style.removeProperty("--denis-vv-height");
    };
  }, [input.open, input.inputFocused, input.overlayRef]);

  useEffect(() => {
    if (!input.open || !input.inputFocused) return;
    const timer = window.setTimeout(() => {
      input.scrollToBottom();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [input.open, input.inputFocused, input.scrollToBottom]);
}
