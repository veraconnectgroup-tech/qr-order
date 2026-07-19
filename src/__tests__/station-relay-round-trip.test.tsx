import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createRelayMessage,
  answerRelayMessage,
  expireRelayMessage,
  acknowledgeRelayDelivery,
  listOpenRelayMessagesForStation,
  listUndeliveredRepliesForStation,
  type DenisStationRelayMessageRow,
} from "@/lib/denis/stations/station-relay-messages";
import {
  DenisQuestionStrip,
  buildRelayReplyDeliveryLine,
} from "@/components/stations/denis-question-strip";
import { useStationRelayMessages } from "@/hooks/use-station-relay-messages";
import { useStationQuestions } from "@/hooks/use-station-questions";
import { useDenisNewOrderAnnouncements } from "@/hooks/use-denis-new-order-announcements";
import { useDenisStationVoice } from "@/hooks/use-denis-station-voice";
import { useDenisVoice } from "@/hooks/use-denis-voice";

/**
 * Full cross-station relay round trip (ADR-053 C7), covered at two levels:
 *
 *  1. The data layer (station-relay-messages.ts) against an in-memory fake
 *     of the `denis_station_relay_messages` table — this is the part that
 *     notify_station / the answer route / the expire route all funnel
 *     through, so exercising it directly is as close to "real DB" as a
 *     unit test gets.
 *  2. DenisQuestionStrip's single priority effect (lines ~561-617) — reply
 *     delivery > expiry announcement > fresh incoming ask — with every
 *     other hook it depends on mocked, so only that effect's real logic
 *     runs.
 */

const LOCATION_ID = "loc-1";

// ---------------------------------------------------------------------
// 1. Data layer — fake admin client mimicking the postgrest filter chains
//    actually used by station-relay-messages.ts (insert/select/update with
//    eq/gt/lte/is/order, terminated by .single()/.maybeSingle() or awaited
//    directly).
// ---------------------------------------------------------------------

type Row = DenisStationRelayMessageRow;

function makeFakeRelayAdmin(seed: Row[] = []) {
  const rows: Row[] = [...seed];
  let counter = 0;

  function from(table: string) {
    if (table !== "denis_station_relay_messages") {
      throw new Error(`fake admin: unexpected table ${table}`);
    }
    return builder();
  }

  function builder() {
    type Mode = "select" | "insert" | "update" | null;
    let mode: Mode = null;
    const filters: Array<(r: Row) => boolean> = [];
    let insertPayload: Partial<Row> | null = null;
    let updatePayload: Partial<Row> | null = null;
    let orderField: keyof Row | null = null;

    function matched(): Row[] {
      return rows.filter((r) => filters.every((f) => f(r)));
    }

    function execute(): Row[] {
      if (mode === "insert") {
        const row: Row = {
          id: `relay-${++counter}`,
          location_id: "",
          from_station: "kitchen",
          to_station: "bar",
          message: "",
          status: "open",
          reply: null,
          requested_by: null,
          replied_by: null,
          asked_at: new Date().toISOString(),
          replied_at: null,
          expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
          origin_notified_at: null,
          ...insertPayload,
        } as Row;
        rows.push(row);
        return [row];
      }
      if (mode === "update") {
        const targets = matched();
        targets.forEach((r) => Object.assign(r, updatePayload));
        return targets;
      }
      let list = matched();
      if (orderField) {
        const field = orderField;
        list = [...list].sort((a, b) =>
          String(a[field]).localeCompare(String(b[field]))
        );
      }
      return list;
    }

    const api = {
      select(_cols?: string) {
        if (mode === null) mode = "select";
        return api;
      },
      insert(payload: Partial<Row>) {
        mode = "insert";
        insertPayload = payload;
        return api;
      },
      update(payload: Partial<Row>) {
        mode = "update";
        updatePayload = payload;
        return api;
      },
      eq(field: keyof Row, value: unknown) {
        filters.push((r) => r[field] === value);
        return api;
      },
      gt(field: keyof Row, value: string) {
        filters.push((r) => {
          const v = r[field];
          return typeof v === "string" && v > value;
        });
        return api;
      },
      lte(field: keyof Row, value: string) {
        filters.push((r) => {
          const v = r[field];
          return typeof v === "string" && v <= value;
        });
        return api;
      },
      is(field: keyof Row, value: null) {
        filters.push((r) => r[field] === value);
        return api;
      },
      order(field: keyof Row) {
        orderField = field;
        return api;
      },
      async single() {
        const list = execute();
        if (list.length !== 1) {
          return { data: null, error: { message: "no rows" } };
        }
        return { data: list[0], error: null };
      },
      async maybeSingle() {
        const list = execute();
        return { data: list[0] ?? null, error: null };
      },
      then(
        resolve: (v: { data: Row[]; error: null }) => void,
        reject: (e: unknown) => void
      ) {
        try {
          resolve({ data: execute(), error: null });
        } catch (e) {
          reject(e);
        }
      },
    };

    return api;
  }

  return {
    admin: { from } as unknown as SupabaseClient,
    rows: () => rows,
  };
}

describe("station relay round trip — data layer", () => {
  it("kitchen asks bar, bar answers, kitchen receives the delivered reply", async () => {
    const { admin } = makeFakeRelayAdmin();

    // Station A (kitchen) creates the relay message, as notify_station does.
    const created = await createRelayMessage(admin, {
      locationId: LOCATION_ID,
      fromStation: "kitchen",
      toStation: "bar",
      message: "Šank, gost na stolu 5 traži da ubrzate pivo.",
      requestedByStaffId: "staff-kitchen-1",
    });
    expect(created.created).toBe(true);
    if (!created.created) return;
    const relayId = created.relay.id;

    // Station B (bar) sees it as an incoming open ask; kitchen does not.
    const barIncoming = await listOpenRelayMessagesForStation(admin, {
      locationId: LOCATION_ID,
      station: "bar",
    });
    expect(barIncoming).toHaveLength(1);
    expect(barIncoming[0]).toMatchObject({
      id: relayId,
      from_station: "kitchen",
      to_station: "bar",
      status: "open",
    });

    const kitchenIncoming = await listOpenRelayMessagesForStation(admin, {
      locationId: LOCATION_ID,
      station: "kitchen",
    });
    expect(kitchenIncoming).toHaveLength(0);

    // Station B answers.
    const answered = await answerRelayMessage(admin, {
      relayId,
      reply: "Nosim odmah",
      repliedByStaffId: "staff-bar-1",
    });
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.relay.status).toBe("answered");
    expect(answered.relay.reply).toBe("Nosim odmah");

    // The answered row drops out of bar's open queue.
    const barIncomingAfter = await listOpenRelayMessagesForStation(admin, {
      locationId: LOCATION_ID,
      station: "bar",
    });
    expect(barIncomingAfter).toHaveLength(0);

    // Station A (kitchen, the original from_station) sees the undelivered
    // reply; station B (bar) does not — the query filters on from_station,
    // and that always equals the asking station, never the answerer.
    const kitchenUndelivered = await listUndeliveredRepliesForStation(admin, {
      locationId: LOCATION_ID,
      station: "kitchen",
    });
    expect(kitchenUndelivered).toHaveLength(1);
    expect(kitchenUndelivered[0].id).toBe(relayId);

    const barUndelivered = await listUndeliveredRepliesForStation(admin, {
      locationId: LOCATION_ID,
      station: "bar",
    });
    expect(barUndelivered).toHaveLength(0);

    // The speech line names the answerer (bar), not the asker (kitchen).
    expect(buildRelayReplyDeliveryLine(kitchenUndelivered[0])).toBe(
      "Odgovor stigao od Bar: Nosim odmah"
    );

    // Once delivered, acknowledging marks it so it never speaks again.
    const acked = await acknowledgeRelayDelivery(admin, { relayId });
    expect(acked).toBe(true);

    const kitchenUndeliveredAfterAck = await listUndeliveredRepliesForStation(
      admin,
      { locationId: LOCATION_ID, station: "kitchen" }
    );
    expect(kitchenUndeliveredAfterAck).toHaveLength(0);
  });

  it("rejects a second answer to an already-answered relay message", async () => {
    const { admin } = makeFakeRelayAdmin();
    const created = await createRelayMessage(admin, {
      locationId: LOCATION_ID,
      fromStation: "bar",
      toStation: "kitchen",
      message: "Koliko još čekamo na sto 3?",
      requestedByStaffId: "staff-bar-2",
    });
    if (!created.created) throw new Error("setup failed");

    const first = await answerRelayMessage(admin, {
      relayId: created.relay.id,
      reply: "5 minuta",
      repliedByStaffId: "staff-kitchen-2",
    });
    expect(first.ok).toBe(true);

    const second = await answerRelayMessage(admin, {
      relayId: created.relay.id,
      reply: "10 minuta",
      repliedByStaffId: "staff-kitchen-2",
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe("not_open");
  });

  it("expires an unanswered ask idempotently, without touching an already-answered one", async () => {
    const { admin, rows } = makeFakeRelayAdmin();

    const staleAsk = await createRelayMessage(admin, {
      locationId: LOCATION_ID,
      fromStation: "kitchen",
      toStation: "bar",
      message: "Ima li još leda?",
      requestedByStaffId: null,
    });
    if (!staleAsk.created) throw new Error("setup failed");
    // Simulate 20+ minutes passing without a reply.
    const staleRow = rows().find((r) => r.id === staleAsk.relay.id)!;
    staleRow.expires_at = new Date(Date.now() - 60_000).toISOString();

    const answeredAsk = await createRelayMessage(admin, {
      locationId: LOCATION_ID,
      fromStation: "kitchen",
      toStation: "bar",
      message: "Šta je sa pivom za sto 8?",
      requestedByStaffId: null,
    });
    if (!answeredAsk.created) throw new Error("setup failed");
    await answerRelayMessage(admin, {
      relayId: answeredAsk.relay.id,
      reply: "Nosim",
      repliedByStaffId: "staff-bar-3",
    });

    // The stale ask has already fallen out of bar's open queue (expires_at
    // filter) even before expireRelayMessage runs — the exact silent gap
    // fixed by a86a0203.
    const stillOpenForBar = await listOpenRelayMessagesForStation(admin, {
      locationId: LOCATION_ID,
      station: "bar",
    });
    expect(stillOpenForBar).toHaveLength(0);
    expect(staleRow.status).toBe("open"); // not yet flipped

    const expiredOk = await expireRelayMessage(admin, {
      relayId: staleAsk.relay.id,
    });
    expect(expiredOk).toBe(true);
    expect(staleRow.status).toBe("expired");

    // The already-answered row is untouched by expiry (idempotent — only
    // flips rows still 'open').
    const answeredRow = rows().find((r) => r.id === answeredAsk.relay.id)!;
    expect(answeredRow.status).toBe("answered");

    // Calling it again on an already-expired row is a no-op, not an error.
    const expiredAgain = await expireRelayMessage(admin, {
      relayId: staleAsk.relay.id,
    });
    expect(expiredAgain).toBe(true);
    expect(staleRow.status).toBe("expired");
  });
});

// ---------------------------------------------------------------------
// 2. Component layer — DenisQuestionStrip's priority effect: reply
//    delivery > expiry announcement > fresh incoming ask. Every other
//    hook is mocked so only that effect's real code runs.
// ---------------------------------------------------------------------

vi.mock("@/hooks/use-station-relay-messages", () => ({
  useStationRelayMessages: vi.fn(),
}));
vi.mock("@/hooks/use-station-questions", () => ({
  useStationQuestions: vi.fn(),
}));
vi.mock("@/hooks/use-denis-new-order-announcements", () => ({
  useDenisNewOrderAnnouncements: vi.fn(),
}));
vi.mock("@/hooks/use-denis-station-voice", () => ({
  useDenisStationVoice: vi.fn(),
}));
vi.mock("@/hooks/use-denis-voice", () => ({
  useDenisVoice: vi.fn(),
}));
vi.mock("@/components/denis-voice-orb", () => ({
  DenisVoiceOrb: () => null,
}));

function relayRow(overrides: Partial<Row>): Row {
  return {
    id: "row-1",
    location_id: LOCATION_ID,
    from_station: "kitchen",
    to_station: "bar",
    message: "",
    status: "open",
    reply: null,
    requested_by: null,
    replied_by: null,
    asked_at: new Date().toISOString(),
    replied_at: null,
    expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
    origin_notified_at: null,
    ...overrides,
  };
}

describe("DenisQuestionStrip — relay priority effect", () => {
  const speak = vi.fn(
    (_line: string, onDone?: () => void, _tone?: unknown) => {
      return true;
    }
  );
  const startListening = vi.fn();
  const answerRelay = vi.fn().mockResolvedValue(undefined);
  const acknowledgeDelivery = vi.fn().mockResolvedValue(undefined);
  const dismissExpired = vi.fn().mockResolvedValue(undefined);

  let relayState: {
    incoming: Row[];
    undeliveredReplies: Row[];
    expiredUnanswered: Row[];
  };

  beforeEach(() => {
    vi.mocked(fetch as unknown as (...a: unknown[]) => unknown);
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    speak.mockClear();
    startListening.mockClear();
    answerRelay.mockClear();
    acknowledgeDelivery.mockClear();
    dismissExpired.mockClear();

    vi.mocked(useStationQuestions).mockReturnValue({
      questions: [],
      answerQuestion: vi.fn(),
    } as unknown as ReturnType<typeof useStationQuestions>);

    vi.mocked(useDenisNewOrderAnnouncements).mockReturnValue(undefined);

    vi.mocked(useDenisStationVoice).mockReturnValue({
      voiceEnabled: true,
      voicePrimed: true,
      speaking: false,
      listening: false,
      speak,
      activate: vi.fn(),
      deactivate: vi.fn(),
      listen: vi.fn(),
      stopListening: vi.fn(),
    } as unknown as ReturnType<typeof useDenisStationVoice>);

    vi.mocked(useDenisVoice).mockReturnValue({
      supported: true,
      listening: false,
      startListening,
      stopListening: vi.fn(),
      speak: vi.fn(),
      isVoiceTranscriptConfident: vi.fn(),
      pushToTalkMode: false,
      audioEnvironment: null,
    } as unknown as ReturnType<typeof useDenisVoice>);

    relayState = {
      incoming: [],
      undeliveredReplies: [],
      expiredUnanswered: [],
    };

    vi.mocked(useStationRelayMessages).mockImplementation(
      () =>
        ({
          incoming: relayState.incoming,
          undeliveredReplies: relayState.undeliveredReplies,
          expiredUnanswered: relayState.expiredUnanswered,
          answerRelay,
          acknowledgeDelivery,
          dismissExpired,
          refetch: vi.fn(),
        }) as unknown as ReturnType<typeof useStationRelayMessages>
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("delivers the answered reply before announcing anything else", async () => {
    const reply = relayRow({
      id: "reply-1",
      from_station: "kitchen",
      to_station: "bar",
      status: "answered",
      reply: "Nosim odmah",
    });
    const expired = relayRow({ id: "expired-1", to_station: "kitchen" });
    const incoming = relayRow({ id: "ask-1", message: "Treba nam led." });

    relayState = {
      incoming: [incoming],
      undeliveredReplies: [reply],
      expiredUnanswered: [expired],
    };

    render(<DenisQuestionStrip locationId={LOCATION_ID} station="kitchen" />);

    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    expect(speak).toHaveBeenCalledWith(
      "Odgovor stigao od Bar: Nosim odmah",
      expect.any(Function)
    );

    // Finishing that speech acknowledges delivery, not the other two.
    const onDone = speak.mock.calls[0][1] as () => void;
    onDone();
    await waitFor(() => expect(acknowledgeDelivery).toHaveBeenCalledWith("reply-1"));
    expect(dismissExpired).not.toHaveBeenCalled();
    expect(answerRelay).not.toHaveBeenCalled();
  });

  it("announces the unanswered-expiry line before speaking a fresh incoming ask", async () => {
    const expired = relayRow({
      id: "expired-1",
      to_station: "kitchen",
      from_station: "bar",
    });
    const incoming = relayRow({ id: "ask-1", message: "Treba nam led." });

    relayState = {
      incoming: [incoming],
      undeliveredReplies: [],
      expiredUnanswered: [expired],
    };

    render(<DenisQuestionStrip locationId={LOCATION_ID} station="bar" />);

    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    expect(speak).toHaveBeenCalledWith(
      "Niko nije odgovorio na poruku za kuhinja.",
      expect.any(Function)
    );

    const onDone = speak.mock.calls[0][1] as () => void;
    onDone();
    await waitFor(() => expect(dismissExpired).toHaveBeenCalledWith("expired-1"));
    expect(answerRelay).not.toHaveBeenCalled();
  });

  it("speaks a fresh incoming ask and answers it with the captured transcript", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const incoming = relayRow({
      id: "ask-1",
      from_station: "bar",
      to_station: "kitchen",
      message: "Treba nam led za koktele.",
    });
    relayState = {
      incoming: [incoming],
      undeliveredReplies: [],
      expiredUnanswered: [],
    };

    render(<DenisQuestionStrip locationId={LOCATION_ID} station="kitchen" />);

    await vi.waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    expect(speak).toHaveBeenCalledWith(
      "Treba nam led za koktele.",
      expect.any(Function)
    );

    const onDone = speak.mock.calls[0][1] as () => void;
    onDone();

    // Kitchen is wake-word (not push-to-talk) — listenForReply schedules a
    // short delay before opening the mic.
    await vi.advanceTimersByTimeAsync(800);
    expect(startListening).toHaveBeenCalledTimes(1);

    const onTranscript = startListening.mock.calls[0][0] as (r: {
      ok: boolean;
      transcript: string;
    }) => void;
    onTranscript({ ok: true, transcript: "Nosim odmah led" });

    expect(answerRelay).toHaveBeenCalledWith("ask-1", "Nosim odmah led");

    vi.useRealTimers();
  });
});
