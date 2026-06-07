import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import { buildViewHeadline } from "@/lib/denis/loop/project-view-layers";
import { resolveWorldOrderTell } from "@/lib/denis/loop/tell-world-order";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { MenuLocale } from "@/lib/i18n/translations";

export type WorldTellUnificationResult = {
  passed: boolean;
  errors: string[];
};

const READY_LOCALES: Array<{ menuLocale: MenuLocale; isEnglish?: boolean }> = [
  { menuLocale: "de" },
  { menuLocale: "sr" },
  // English guests keep venue menuLocale with isEnglish (see resolveLocaleFromLanguage).
  { menuLocale: "de", isEnglish: true },
];

function assertWordMatch(
  errors: string[],
  locale: MenuLocale,
  surface: string,
  expected: string,
  actual: string
): void {
  if (expected !== actual) {
    errors.push(
      `[${locale}] ${surface} must equal tell.message — expected "${expected}", got "${actual}"`
    );
  }
}

function buildReadyTellTimeline(message: string): DenisTimelineRow[] {
  return [
    {
      id: "w1",
      ai_session_id: "ai-fixture",
      seq: 1,
      event_type: "tell.committed",
      payload: {
        type: "tell.committed",
        message,
        tier: "template",
        source: "world.commerce",
        linted: true,
      },
      trace_id: "trace-fixture",
      context_hash: null,
      created_at: "2026-06-07T12:00:00.000Z",
    },
  ];
}

/** Phase D — push body, tell.committed, dock headline, and transcript share one TELL string. */
export function runWorldTellUnificationFixture(): WorldTellUnificationResult {
  const errors: string[] = [];

  for (const locale of READY_LOCALES) {
    const tell = resolveWorldOrderTell({
      signal: "commerce.order_status",
      status: "ready",
      previousStatus: "preparing",
      orderNumber: 42,
      menuLocale: locale.menuLocale,
      isEnglish: locale.isEnglish,
    });

    if (!tell) {
      errors.push(`[${locale.menuLocale}] expected tell for ready transition`);
      continue;
    }

    if (!tell.push) {
      errors.push(`[${locale.menuLocale}] ready status should trigger guest push`);
    }

    const tellCommittedMessage = tell.message;
    const pushBody = tell.message;
    const headline = buildViewHeadline(null, "waiting", tell.message);

    assertWordMatch(
      errors,
      locale.menuLocale,
      "tell.committed",
      tell.message,
      tellCommittedMessage
    );
    assertWordMatch(errors, locale.menuLocale, "push body", tell.message, pushBody);
    assertWordMatch(errors, locale.menuLocale, "view headline", tell.message, headline);

    const transcript = foldTranscriptFromTimeline(
      buildReadyTellTimeline(tellCommittedMessage)
    );
    const denisLine = transcript.find((entry) => entry.role === "denis");
    if (!denisLine) {
      errors.push(`[${locale.menuLocale}] tell.committed must appear in transcript`);
      continue;
    }
    assertWordMatch(
      errors,
      locale.menuLocale,
      "transcript line",
      tell.message,
      denisLine.text
    );
  }

  return { passed: errors.length === 0, errors };
}
