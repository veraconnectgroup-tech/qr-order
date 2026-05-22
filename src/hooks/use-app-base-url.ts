"use client";

import { useEffect, useState } from "react";
import { getGuestAppBaseUrl } from "@/lib/app-url";

export function useAppBaseUrl() {
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return getGuestAppBaseUrl(origin);
}
