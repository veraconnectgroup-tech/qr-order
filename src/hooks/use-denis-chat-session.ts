"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { resolveAiPromptLanguage, type AI_SUPPORTED_LANGUAGES } from "@/lib/ai/config";
import {
  tForAiGuestLanguage,
} from "@/lib/ai/guest-language";
import {
  AI_SHEET_ALLERGY_OPTIONS,
  AI_SHEET_MOOD_OPTIONS,
  apiPreferencesFromSheet,
  type AiSheetAllergyId,
  type AiSheetMoodId,
} from "@/lib/ai/guest-sheet-preferences";
import type { ChatPhase, QuickPickOption } from "@/components/guest/denis-chat/types";

export function useDenisChatSession(input: {
  menuLocale: string;
  tUI: (key: string, vars?: Record<string, string | number>) => string;
  resolvedAllergySelection: AiSheetAllergyId[];
}) {
  const [chatLanguage, setChatLanguage] = useState<
    (typeof AI_SUPPORTED_LANGUAGES)[number]
  >(resolveAiPromptLanguage(input.menuLocale));
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<ChatPhase>("chat");

  const preferencesRef = useRef<{ allergies: string[]; mood: string }>({
    allergies: [],
    mood: "",
  });
  const allergySelectionRef = useRef<AiSheetAllergyId[]>([]);

  const allergyOptions: QuickPickOption[] = useMemo(
    () =>
      AI_SHEET_ALLERGY_OPTIONS.map((o) => ({
        id: o.id,
        label: input.tUI(`ai.chat.allergy.${o.id}` as "ai.chat.allergy.keine"),
      })),
    [input.tUI]
  );

  const moodOptions: QuickPickOption[] = useMemo(
    () =>
      AI_SHEET_MOOD_OPTIONS.map((o) => ({
        id: o.id,
        label: input.tUI(`ai.chat.mood.${o.id}` as "ai.chat.mood.leicht"),
      })),
    [input.tUI]
  );

  const tChat = useCallback(
    (
      key: Parameters<typeof tForAiGuestLanguage>[0],
      vars?: Record<string, string | number>
    ) => tForAiGuestLanguage(key, chatLanguage, vars),
    [chatLanguage]
  );

  const syncPreferencesFromSelection = useCallback(
    (selection: AiSheetAllergyId[]) => {
      if (selection.length > 0) {
        preferencesRef.current = apiPreferencesFromSheet({
          allergies: selection,
          mood: null,
        });
        allergySelectionRef.current = selection;
      } else {
        preferencesRef.current = { allergies: [], mood: "" };
        allergySelectionRef.current = [];
      }
    },
    []
  );

  return {
    chatLanguage,
    setChatLanguage,
    aiSessionId,
    setAiSessionId,
    phase,
    setPhase,
    preferencesRef,
    allergySelectionRef,
    allergyOptions,
    moodOptions,
    tChat,
    syncPreferencesFromSelection,
  };
}

export type DenisChatSession = ReturnType<typeof useDenisChatSession>;
