import type { GuestIntent } from "@/lib/denis/platform/timeline-types";

export type ReflexRuleId =
  | "confirm"
  | "decline"
  | "done"
  | "correct"
  | "remove"
  | "replace"
  | "add_more"
  | "undo";

export type CorrectionCommand =
  | { kind: "CORRECT"; targetName: string | null }
  | { kind: "REMOVE"; targetName: string }
  | { kind: "REPLACE"; targetName: string }
  | { kind: "ADD_MORE"; targetName: string | null }
  | { kind: "UNDO" };

export type T0ReflexResult = {
  tier: "T0";
  ruleId: ReflexRuleId;
  intent: GuestIntent;
  correction: CorrectionCommand | null;
  evidence: string;
};

function normalize(message: string): string {
  return message.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isT0Confirm(message: string): boolean {
  const text = normalize(message);
  return (
    /^(da|ja|yes|yep|ok+|potvrdi|bestätigen|bestätige|confirm|pošalji|posalji|send|bestellen|naruči|naruci)([\s,.!]|$)/.test(
      text
    ) ||
    /^(da|ja),?\s*(pošalji|posalji|potvrdi|bestätigen|send|naruči|naruci)/.test(
      text
    )
  );
}

export function isT0Decline(message: string): boolean {
  const text = normalize(message);
  return (
    /^(ne+hvala|ne hvala|ne, hvala|ne treba|nije potrebno|ne mora|ne želim|ne zelim)$/.test(
      text
    ) ||
    /^(nein danke|nein, danke|danke nein|no thanks?|nope|nicht|ne\.?)$/.test(
      text
    ) ||
    /^ne(,|$)/.test(text)
  );
}

export function isT0Done(message: string): boolean {
  const text = normalize(message);
  return (
    /ne?\s*to je sve|to je sve|samo to|to je to|sve hvala|gotovo/.test(text) ||
    /ništa više|nista vise|ništa drugo|nista drugo|nema ništa|nema nista/.test(
      text
    ) ||
    /das war(\s+)?('|)s|das reicht|nichts mehr|nur das|fertig|sonst nichts/.test(
      text
    ) ||
    /that('s| is) all|nothing else|just that|no more|all set/.test(text)
  );
}

function parseRemoveTarget(message: string): string | null {
  const patterns = [
    /^ukloni\s+(.+)/i,
    /^remove\s+(.+)/i,
    /^storniraj\s+(.+)/i,
    /^obriši\s+(.+)/i,
    /^obrisi\s+(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function parseReplaceTarget(message: string): string | null {
  const patterns = [
    /^promeni\s+u\s+(.+)/i,
    /^promijeni\s+u\s+(.+)/i,
    /^change\s+to\s+(.+)/i,
    /^wechsel\s+zu\s+(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function parseCorrectTarget(message: string): string | null {
  const patterns = [
    /^ne\s*,?\s*ipak\s+(.+)/i,
    /^actually\s+(.+)/i,
    /^eigentlich\s+(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function isAddMore(message: string): boolean {
  return /^(duplo|jo[sš]\s+jedn|jo[sš]\s+jednu|noch\s+eine|one\s+more|another|\+1)$/i.test(
    normalize(message)
  ) || /jo[šs]\s+(jedn|one)|another|eine\s+weitere|one\s+more|dodaj|add\s+more|plus\s+one|\+1/i.test(
    message
  );
}

function isUndo(message: string): boolean {
  return /^(undo|vrati|zurück|zuruck|ponisti|poništi)$/i.test(normalize(message));
}

function isBareStorniraj(message: string): boolean {
  return /^storniraj$/i.test(normalize(message));
}

/** T0 reflex classifier — no LLM (ADR-004 §7, ADR-003 T0). */
export function resolveT0Reflex(message: string): T0ReflexResult | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  if (isUndo(trimmed)) {
    return {
      tier: "T0",
      ruleId: "undo",
      intent: "ORDER",
      correction: { kind: "UNDO" },
      evidence: "reflex.undo",
    };
  }

  const replaceTarget = parseReplaceTarget(trimmed);
  if (replaceTarget) {
    return {
      tier: "T0",
      ruleId: "replace",
      intent: "ORDER",
      correction: { kind: "REPLACE", targetName: replaceTarget },
      evidence: "reflex.replace",
    };
  }

  const removeTarget = parseRemoveTarget(trimmed);
  if (removeTarget) {
    return {
      tier: "T0",
      ruleId: "remove",
      intent: "ORDER",
      correction: { kind: "REMOVE", targetName: removeTarget },
      evidence: "reflex.remove",
    };
  }

  const correctTarget = parseCorrectTarget(trimmed);
  if (correctTarget || isBareStorniraj(trimmed)) {
    return {
      tier: "T0",
      ruleId: "correct",
      intent: "ORDER",
      correction: {
        kind: "CORRECT",
        targetName: correctTarget ?? null,
      },
      evidence: "reflex.correct",
    };
  }

  if (isAddMore(trimmed)) {
    return {
      tier: "T0",
      ruleId: "add_more",
      intent: "ORDER",
      correction: { kind: "ADD_MORE", targetName: null },
      evidence: "reflex.add_more",
    };
  }

  if (isT0Confirm(trimmed)) {
    return {
      tier: "T0",
      ruleId: "confirm",
      intent: "CONFIRM",
      correction: null,
      evidence: "reflex.confirm",
    };
  }

  if (isT0Decline(trimmed)) {
    return {
      tier: "T0",
      ruleId: "decline",
      intent: "DECLINE",
      correction: null,
      evidence: "reflex.decline",
    };
  }

  if (isT0Done(trimmed)) {
    return {
      tier: "T0",
      ruleId: "done",
      intent: "DONE",
      correction: null,
      evidence: "reflex.done",
    };
  }

  return null;
}
