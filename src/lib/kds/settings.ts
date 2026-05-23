export const KDS_TIMER_WARNING_KEY = "kds-timer-warning-min";
export const KDS_AUTO_PRINT_KEY = "kds-auto-print";
export const KDS_DELIVERED_HIDE_MS = 30_000;

const DEFAULT_TIMER_WARNING_MIN = 10;

export function getKdsTimerWarningMinutes(): number {
  if (typeof window === "undefined") return DEFAULT_TIMER_WARNING_MIN;
  const raw = localStorage.getItem(KDS_TIMER_WARNING_KEY);
  const parsed = raw ? Number(raw) : DEFAULT_TIMER_WARNING_MIN;
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_TIMER_WARNING_MIN;
  return Math.min(parsed, 120);
}

export function setKdsTimerWarningMinutes(minutes: number) {
  localStorage.setItem(
    KDS_TIMER_WARNING_KEY,
    String(Math.max(1, Math.min(120, Math.round(minutes))))
  );
}

export function isKdsAutoPrintEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KDS_AUTO_PRINT_KEY) === "1";
}

export function setKdsAutoPrintEnabled(enabled: boolean) {
  localStorage.setItem(KDS_AUTO_PRINT_KEY, enabled ? "1" : "0");
}

export function formatKdsElapsed(createdAt: string): string {
  const totalSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  );
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function kdsElapsedMinutes(createdAt: string): number {
  return Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 60_000
  );
}
