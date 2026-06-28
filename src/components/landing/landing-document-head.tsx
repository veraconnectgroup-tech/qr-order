"use client";

import { useEffect } from "react";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";

/** Sync document title/description when locale changes on landing. */
export function LandingDocumentHead() {
  const { copy } = useLandingCopy();

  useEffect(() => {
    document.title = copy.meta.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute("content", copy.meta.description);
    }
  }, [copy.meta.description, copy.meta.title]);

  return null;
}
