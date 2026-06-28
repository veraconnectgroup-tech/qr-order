"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/components/dashboard/tables-board/types";

export function TablesBoardSessionTimer({ openedAt }: { openedAt: string }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="mt-1 font-mono text-xs tabular-nums text-emerald-400/90">
      {formatDuration(openedAt)}
    </p>
  );
}
