const STORAGE_KEY = "kds-sound-enabled";

/** Short beep via base64 WAV — no external file required. */
const BEEP_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAADAP//AwD//wMA//8DAP//AwD//wMA//8=";

let cachedAudio: HTMLAudioElement | null = null;

function getBeepAudio() {
  if (typeof window === "undefined") return null;
  if (!cachedAudio) {
    cachedAudio = new Audio(BEEP_WAV);
    cachedAudio.volume = 0.65;
  }
  return cachedAudio;
}

export function isKdsSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true;
  return stored === "1";
}

export function setKdsSoundEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

export function playNewOrderSound() {
  if (!isKdsSoundEnabled()) return;

  try {
    const ctx = new AudioContext();
    const playTone = (frequency: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = "square";
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };

    const t = ctx.currentTime;
    playTone(880, t, 0.12);
    playTone(1100, t + 0.14, 0.14);
    playTone(1320, t + 0.3, 0.16);
    setTimeout(() => ctx.close(), 600);
  } catch {
    const audio = getBeepAudio();
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }
}

function playKitchenCriticalSound() {
  try {
    const ctx = new AudioContext();
    const playTone = (frequency: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = "square";
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.45, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };
    const t = ctx.currentTime;
    playTone(440, t, 0.2);
    playTone(440, t + 0.25, 0.2);
    playTone(660, t + 0.5, 0.25);
    setTimeout(() => ctx.close(), 900);
  } catch {
    const audio = getBeepAudio();
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }
}

export function playKdsCriticalAlarm() {
  if (!isKdsSoundEnabled()) return;
  playKitchenCriticalSound();
}

export function playKdsTestSound() {
  const prev = isKdsSoundEnabled();
  if (!prev) setKdsSoundEnabled(true);
  playNewOrderSound();
  if (!prev) setKdsSoundEnabled(false);
}
