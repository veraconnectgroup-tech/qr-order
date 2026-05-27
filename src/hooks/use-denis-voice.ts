"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript?: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function mapLocaleToSpeechTag(language: string): string {
  const base = language.trim().slice(0, 2).toLowerCase();
  if (base === "en") return "en-US";
  if (base === "de") return "de-DE";
  if (base === "sr") return "sr-RS";
  if (base === "hr") return "hr-HR";
  return language;
}

export type UseDenisVoiceOptions = {
  enabled: boolean;
  language: string;
  autoSpeak: boolean;
};

export function useDenisVoice({
  enabled,
  language,
  autoSpeak,
}: UseDenisVoiceOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const onResultRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognitionCtor() && enabled);
  }, [enabled]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!autoSpeak || typeof window === "undefined" || !text.trim()) {
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = mapLocaleToSpeechTag(language);
      window.speechSynthesis.speak(utterance);
    },
    [autoSpeak, language]
  );

  const startListening = useCallback(
    (onTranscript: (text: string) => void) => {
      if (!enabled || !supported) return false;

      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return false;

      stopListening();
      onResultRef.current = onTranscript;

      const recognition = new Ctor();
      recognition.lang = mapLocaleToSpeechTag(language);
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) {
          onResultRef.current?.(transcript);
        }
      };

      recognition.onerror = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
      return true;
    },
    [enabled, supported, language, stopListening]
  );

  useEffect(() => {
    return () => {
      stopListening();
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopListening]);

  return {
    supported,
    listening,
    startListening,
    stopListening,
    speak,
  };
}
