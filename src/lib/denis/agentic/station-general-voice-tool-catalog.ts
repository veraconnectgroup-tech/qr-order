import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenAiToolDefinition } from "@/lib/ai/types";
import { loadStaffCopilotSnapshot } from "@/lib/denis/venue/copilot/load-staff-copilot-snapshot";
import {
  createRelayMessage,
  type RelayStation,
} from "@/lib/denis/stations/station-relay-messages";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import {
  completeCommitment,
  createCommitment,
} from "@/lib/denis/stations/denis-commitments";
import { logActivity } from "@/lib/denis/stations/denis-activity-log";
import { resolveSpokenProduct } from "@/lib/denis/stations/resolve-spoken-product";
import {
  assertRoleCanSetProductAvailability,
  loadProductForAvailability,
  setProductAvailabilityTx,
} from "@/lib/products/eighty-six";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";
import { createMission } from "@/lib/denis/missions/create-mission";
import type { MissionAssignedRole, MissionRow } from "@/lib/denis/missions/mission-types";
import { listDueCommitments } from "@/lib/denis/stations/denis-commitments";
import { loadTodayEightySixItems } from "@/lib/products/eighty-six";
import { resolveSpokenTable } from "@/lib/denis/stations/resolve-spoken-table";
import {
  assertRoleCanPatchStation,
  patchStationStatus,
  type StationStatus,
} from "@/lib/orders/station-states";
import { setVenueDelayNote } from "@/lib/denis/venue/ops/venue-delay-note";

/**
 * Tool catalog for kitchen/bar staff calling Denis on their own initiative
 * (the "Pozovi Denisa" button — distinct from station-voice-realtime-tool-catalog.ts,
 * which is Denis calling THEM about one specific open station_questions row).
 *
 * get_venue_status reuses the same rich, already-cached snapshot as the
 * owner-voice surface (see owner-voice-tool-catalog.ts) — kitchen/bar staff
 * asking "how's the kitchen" want the same real numbers an owner would get,
 * just without the owner-only remember_restaurant_knowledge tool.
 *
 * notify_station and notify_manager are the two side-effecting tools —
 * Denis relaying something to the OTHER station or escalating to the
 * manager, either because staff explicitly asked ("idi pitaj bar...") or
 * because he judged mid-conversation it was worth flagging on his own
 * (the calling route's instructions grant him that latitude explicitly:
 * being activated means permission to act, not just to answer).
 */

export type StationGeneralVoiceToolName =
  | "get_venue_status"
  | "notify_station"
  | "notify_manager"
  | "remember_commitment"
  | "complete_commitment"
  | "propose_eighty_six"
  | "confirm_eighty_six"
  | "create_mission"
  | "read_open_items"
  | "mark_ready_call_runner"
  | "propose_delay"
  | "confirm_delay";

export type StationGeneralVoiceToolExecutorInput = {
  admin: SupabaseClient;
  locationId: string;
  orgId: string;
  staffId: string;
  staffRole: string;
  station: RelayStation;
};

function otherStation(station: RelayStation): RelayStation {
  return station === "kitchen" ? "bar" : "kitchen";
}

const getVenueStatus: OpenAiToolDefinition = {
  name: "get_venue_status",
  description:
    "Get this venue's current live status right now: kitchen backlog/stress, active order count, and which tables need attention. Always call this before answering any question about how service is going, whether the kitchen is behind, or which tables have issues — never guess or answer from memory.",
  parameters: { type: "object", properties: {}, required: [] },
};

const notifyStation: OpenAiToolDefinition = {
  name: "notify_station",
  description:
    "Relay a message to the OTHER station (kitchen if you're on this call with bar, bar if you're on this call with kitchen). It will be spoken there automatically, and their reply comes back to you here as a separate spoken update once they answer. Use this whenever staff asks you to check something with the other station, or when you judge on your own that they should know something right now.",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description:
          "The message to relay, phrased naturally as you'd actually say it out loud to them — not a raw transcript of what staff told you.",
      },
    },
    required: ["message"],
  },
};

const notifyManager: OpenAiToolDefinition = {
  name: "notify_manager",
  description:
    "Send the manager a written alert (with a push notification) about something from this conversation. Use this when staff explicitly asks you to tell the manager something, or when you judge on your own that this is worth the manager knowing about soon, not just between you and the station.",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The alert text, written clearly and briefly for the manager to read.",
      },
    },
    required: ["message"],
  },
};

const rememberCommitment: OpenAiToolDefinition = {
  name: "remember_commitment",
  description:
    "Call this the moment you promise staff you'll do something later — 'javicu sutra', 'proveravam prekosutra', anything with a real timeframe, not something you're doing right now in this same call. You'll be reminded automatically once it's due — you don't need to be asked again.",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "What you promised, written as a short standalone reminder to yourself.",
      },
      dueDate: {
        type: "string",
        description:
          "The date you promised to do this, as YYYY-MM-DD — resolve relative terms like 'sutra' or 'prekosutra' yourself using today's date from your instructions.",
      },
    },
    required: ["text", "dueDate"],
  },
};

const completeCommitmentTool: OpenAiToolDefinition = {
  name: "complete_commitment",
  description:
    "Call this once you've actually done something you previously promised (it will have been listed for you at the start of this conversation if it was due). Mark it done so you don't bring it up again.",
  parameters: {
    type: "object",
    properties: {
      commitmentId: {
        type: "string",
        description: "The id of the commitment, from the list you were given at the start of this conversation.",
      },
    },
    required: ["commitmentId"],
  },
};

const proposeEightySix: OpenAiToolDefinition = {
  name: "propose_eighty_six",
  description:
    "ADR-053 M1 — staff tells you an item is gone ('skini lososa, nema ga više') or back ('vrati lososa'). Call this FIRST with what you heard: it resolves the spoken name against the real menu and returns the exact product. Then read the resolved name back out loud and ask for confirmation ('Skidam Losos sa menija — potvrdi?'). Nothing changes on the menu until confirm_eighty_six — and that call is rejected server-side unless this one happened first, so never skip this step.",
  parameters: {
    type: "object",
    properties: {
      productName: {
        type: "string",
        description: "The product name exactly as staff spoke it, in their words.",
      },
      action: {
        type: "string",
        enum: ["remove", "restore"],
        description:
          "remove = take it off the menu (86), restore = bring it back.",
      },
    },
    required: ["productName", "action"],
  },
};

const confirmEightySix: OpenAiToolDefinition = {
  name: "confirm_eighty_six",
  description:
    "Call ONLY after propose_eighty_six succeeded AND staff explicitly confirmed out loud ('da', 'važi', 'tako je'). Executes the menu change for real — guests stop seeing the item immediately (or see it again on restore). If staff says no or corrects you, call propose_eighty_six again with the corrected name instead.",
  parameters: {
    type: "object",
    properties: {
      productId: {
        type: "string",
        description: "The productId returned by propose_eighty_six.",
      },
    },
    required: ["productId"],
  },
};

const createMissionTool: OpenAiToolDefinition = {
  name: "create_mission",
  description:
    "ADR-053 M4 — staff asks you to make sure someone does something that isn't a call between the two stations on this call ('podseti Marka da donese led', 'neka konobar pokupi čaše sa stola 5'). Creates a task the target role will see and can mark done. Different from remember_commitment (which is a promise YOU made) and notify_station (which is a live relay to the other station on THIS call) — use this for a task aimed at a person or role who isn't part of this conversation.",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description:
          "The task, written as a short clear instruction for whoever picks it up — include the person's name if one was mentioned.",
      },
      targetRole: {
        type: "string",
        enum: ["waiter", "kitchen", "bar", "manager"],
        description: "Which role should see and handle this task.",
      },
      urgent: {
        type: "boolean",
        description: "True only if staff signaled this needs attention soon, not just 'whenever'.",
      },
    },
    required: ["text", "targetRole"],
  },
};

const markReadyCallRunner: OpenAiToolDefinition = {
  name: "mark_ready_call_runner",
  description:
    "ADR-053 M3 — staff calls out that a table's order is done ('spremno za sto dvanaest', 'gotov je sto pet'). Marks this station's part of that table's active orders as ready AND notifies the waiter to come pick it up — one call does both. Pass the table exactly as spoken ('sto dvanaest', 'terasa dva'); the server resolves it against real tables and tells you if it's ambiguous or has no active order. No spoken confirmation needed — this is low-risk and reversible — but always repeat back what happened ('Sto 12 spreman, zovem konobara').",
  parameters: {
    type: "object",
    properties: {
      tableRef: {
        type: "string",
        description: "The table reference exactly as staff spoke it.",
      },
    },
    required: ["tableRef"],
  },
};

const proposeDelay: OpenAiToolDefinition = {
  name: "propose_delay",
  description:
    "ADR-053 M2 — staff announces something is running behind ('roštilj kasni deset minuta', 'desert kasni'). Call this FIRST with the area and minutes as spoken; then read it back and wait for an explicit spoken yes before confirm_delay. Once confirmed, guests with affected items hear the real timeline from Denis and waiters get notified — so a misheard number matters. confirm_delay is rejected server-side without this step.",
  parameters: {
    type: "object",
    properties: {
      area: {
        type: "string",
        description:
          "What's delayed, as spoken — 'roštilj', 'deserti', 'topla kuhinja'.",
      },
      minutes: {
        type: "integer",
        minimum: 1,
        maximum: 60,
        description: "How many minutes behind, as spoken.",
      },
    },
    required: ["area", "minutes"],
  },
};

const confirmDelay: OpenAiToolDefinition = {
  name: "confirm_delay",
  description:
    "Call ONLY after propose_delay succeeded AND staff confirmed out loud. Publishes the delay: Denis starts telling affected guests the real timeline and waiters are notified. If staff corrects you, call propose_delay again instead.",
  parameters: { type: "object", properties: {}, required: [] },
};

const readOpenItems: OpenAiToolDefinition = {
  name: "read_open_items",
  description:
    "ADR-053 M8 — the end-of-shift rundown. Staff asks 'šta je ostalo otvoreno?', 'šta nismo završili?', or anything about open tasks / your unfinished promises / what's still 86'd. Returns three lists: open staff missions, your own commitments that are due, and products currently off the menu today. Read the result back naturally and briefly — group it, don't recite raw rows, and if everything is clear say so plainly.",
  parameters: { type: "object", properties: {}, required: [] },
};

export function listStationGeneralVoiceToolDefinitions(): OpenAiToolDefinition[] {
  return [
    getVenueStatus,
    notifyStation,
    notifyManager,
    rememberCommitment,
    completeCommitmentTool,
    proposeEightySix,
    confirmEightySix,
    createMissionTool,
    readOpenItems,
    markReadyCallRunner,
    proposeDelay,
    confirmDelay,
  ];
}

export function isStationGeneralVoiceToolName(
  name: string
): name is StationGeneralVoiceToolName {
  return (
    name === "get_venue_status" ||
    name === "notify_station" ||
    name === "notify_manager" ||
    name === "create_mission" ||
    name === "read_open_items" ||
    name === "mark_ready_call_runner" ||
    name === "propose_delay" ||
    name === "confirm_delay" ||
    name === "remember_commitment" ||
    name === "complete_commitment" ||
    name === "propose_eighty_six" ||
    name === "confirm_eighty_six"
  );
}

type EightySixProposal = {
  productId: string;
  productName: string;
  action: "remove" | "restore";
};

const EIGHTY_SIX_PROPOSAL_TTL_SEC = 120;

function eightySixProposalKey(locationId: string, station: RelayStation): string {
  return `denis:86:proposal:${locationId}:${station}`;
}

/**
 * ADR-053 §5/§6 — the spoken-confirmation gate is deterministic, not a
 * prompt instruction: confirm_eighty_six only executes when a matching
 * propose_eighty_six proposal exists in Redis (single-shot, 120s TTL).
 * The LLM physically cannot skip the read-back step. Fail-closed when
 * Redis is unavailable — voice 86 refuses rather than degrading to an
 * unconfirmed destructive write (same posture as SecretsManager).
 */
/**
 * ADR-053 M3 — "spremno za sto dvanaest": resolve the spoken table, move
 * this station's part of the table's active orders to ready (through the
 * exact same role guard + patch RPC the on-screen boards use — voice is a
 * new caller, never a looser path), then call the waiter to pick it up.
 * A queued order walks queued→in_prep→ready, same two taps a cook would
 * make on the panel. Deliberately no spoken-confirmation gate (per the
 * ADR-053 §5 table): low-risk, reversible, and the runner arriving at the
 * table is itself the correction loop.
 */
async function executeMarkReadyCallRunner(
  input: StationGeneralVoiceToolExecutorInput,
  args: Record<string, unknown>
): Promise<unknown> {
  const tableRef = typeof args.tableRef === "string" ? args.tableRef.trim() : "";
  if (!tableRef) return { ok: false, error: "empty_table_ref" };

  const { data: tableRows } = await input.admin
    .from("tables")
    .select("id, name")
    .eq("location_id", input.locationId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .limit(300);

  const resolution = resolveSpokenTable(
    tableRef,
    ((tableRows ?? []) as { id: string; name: string }[])
  );

  if (resolution.kind === "none") {
    return {
      ok: false,
      error: "no_table_match",
      sayToStaff: `Nisam našao sto "${tableRef}" — ponovi broj ili naziv stola.`,
    };
  }

  if (resolution.kind === "ambiguous") {
    return {
      ok: false,
      error: "ambiguous",
      candidates: resolution.candidates.map((candidate) => candidate.name),
      sayToStaff: `Na koji sto misliš — ${resolution.candidates
        .map((candidate) => candidate.name)
        .join(" ili ")}?`,
    };
  }

  const table = resolution.table;

  const { data: orderRows } = await input.admin
    .from("orders")
    .select("id, order_number, order_station_states(station, status)")
    .eq("table_id", table.id)
    .eq("location_id", input.locationId)
    .in("status", ["accepted", "preparing"])
    .order("created_at", { ascending: true })
    .limit(5);

  const orders = ((orderRows ?? []) as {
    id: string;
    order_number: number;
    order_station_states:
      | { station: string; status: StationStatus }[]
      | { station: string; status: StationStatus }
      | null;
  }[]).map((row) => {
    const states = Array.isArray(row.order_station_states)
      ? row.order_station_states
      : row.order_station_states
        ? [row.order_station_states]
        : [];
    return {
      id: row.id,
      orderNumber: row.order_number,
      stationStatus:
        states.find((state) => state.station === input.station)?.status ?? null,
    };
  });

  const actionable = orders.filter(
    (order) =>
      order.stationStatus === "queued" || order.stationStatus === "in_prep"
  );

  if (actionable.length === 0) {
    const alreadyDone = orders.some(
      (order) =>
        order.stationStatus === "ready" || order.stationStatus === "picked_up"
    );
    return {
      ok: false,
      error: alreadyDone ? "already_ready" : "no_active_orders",
      sayToStaff: alreadyDone
        ? `Sto ${table.name} je već označen kao spreman na ovoj stanici.`
        : `Nema aktivnih bonova za sto ${table.name} na ovoj stanici.`,
    };
  }

  const marked: number[] = [];
  const failed: { orderNumber: number; reason: string }[] = [];

  for (const order of actionable) {
    let current = order.stationStatus as StationStatus;
    const steps: StationStatus[] =
      current === "queued" ? ["in_prep", "ready"] : ["ready"];

    let orderOk = true;
    for (const next of steps) {
      const roleCheck = assertRoleCanPatchStation({
        role: input.staffRole as Parameters<
          typeof assertRoleCanPatchStation
        >[0]["role"],
        station: input.station,
        fromStatus: current,
        toStatus: next,
      });
      if (!roleCheck.ok) {
        failed.push({ orderNumber: order.orderNumber, reason: roleCheck.reason });
        orderOk = false;
        break;
      }

      const result = await patchStationStatus(input.admin, {
        orderId: order.id,
        station: input.station,
        status: next,
        staffId: input.staffId,
      });
      if (!result.ok) {
        failed.push({
          orderNumber: order.orderNumber,
          reason: result.message ?? result.error,
        });
        orderOk = false;
        break;
      }
      current = next;
    }
    if (orderOk) marked.push(order.orderNumber);
  }

  if (marked.length === 0) {
    return { ok: false, error: "patch_failed", failed };
  }

  const { delivered } = await dispatchStaffNotification({
    orgId: input.orgId,
    locationId: input.locationId,
    type: "waiter_call",
    message: `Denis: Sto ${table.name} — spremno za iznošenje (${
      input.station === "kitchen" ? "kuhinja" : "bar"
    }, bon ${marked.map((n) => `#${n}`).join(", ")}).`,
    tableId: table.id,
    tableName: table.name,
  });

  void logActivity(input.admin, {
    locationId: input.locationId,
    station: input.station,
    staffId: input.staffId,
    action: "mark_ready_call_runner",
    summary: `Označio spremno za sto ${table.name} (bon ${marked
      .map((n) => `#${n}`)
      .join(", ")}) i pozvao konobara.`,
  });

  return {
    ok: true,
    tableName: table.name,
    markedOrderNumbers: marked,
    runnerNotified: delivered,
    failed: failed.length > 0 ? failed : undefined,
  };
}

type DelayProposal = { area: string; minutes: number };

const DELAY_PROPOSAL_TTL_SEC = 120;

function delayProposalKey(locationId: string, station: RelayStation): string {
  return `denis:delay:proposal:${locationId}:${station}`;
}

/**
 * ADR-053 M2 — same deterministic propose/confirm shape as voice 86: a
 * misheard "petnaest" vs "pet" changes what every affected guest is told,
 * so the read-back gate is enforced server-side, fail-closed without
 * Redis.
 */
async function executeProposeDelay(
  input: StationGeneralVoiceToolExecutorInput,
  args: Record<string, unknown>
): Promise<unknown> {
  const area = typeof args.area === "string" ? args.area.trim() : "";
  const minutes = Number(args.minutes);
  if (!area || !Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
    return { ok: false, error: "invalid_input" };
  }

  const redis = getRedisClient();
  if (!redis) {
    return {
      ok: false,
      error: "confirmation_unavailable",
      sayToStaff:
        "Ne mogu bezbedno da objavim kašnjenje glasom trenutno — javi konobarima direktno.",
    };
  }

  try {
    await redis.set(
      delayProposalKey(input.locationId, input.station),
      { area, minutes } satisfies DelayProposal,
      { ex: DELAY_PROPOSAL_TTL_SEC }
    );
  } catch (error) {
    logRedisDegradation("denis.delay.propose", error);
    return { ok: false, error: "confirmation_unavailable" };
  }

  return {
    ok: true,
    area,
    minutes,
    requiresSpokenConfirmation: true,
    sayToStaff: `Objavljujem: ${area} kasni oko ${minutes} minuta — gosti sa tim stavkama dobijaju realno vreme. Potvrdi?`,
  };
}

async function executeConfirmDelay(
  input: StationGeneralVoiceToolExecutorInput
): Promise<unknown> {
  const redis = getRedisClient();
  if (!redis) return { ok: false, error: "confirmation_unavailable" };

  const key = delayProposalKey(input.locationId, input.station);
  let proposal: DelayProposal | null = null;
  try {
    proposal = await redis.get<DelayProposal>(key);
  } catch (error) {
    logRedisDegradation("denis.delay.confirm", error);
    return { ok: false, error: "confirmation_unavailable" };
  }

  if (!proposal?.area || !Number.isFinite(proposal.minutes)) {
    return {
      ok: false,
      error: "no_pending_proposal",
      sayToStaff:
        "Nemam najavu za potvrdu — reci mi ponovo šta kasni i koliko.",
    };
  }

  const stored = await setVenueDelayNote(input.locationId, proposal);
  try {
    await redis.del(key);
  } catch (error) {
    logRedisDegradation("denis.delay.confirm.cleanup", error);
  }

  if (!stored) {
    return { ok: false, error: "store_failed" };
  }

  const { delivered } = await dispatchStaffNotification({
    orgId: input.orgId,
    locationId: input.locationId,
    type: "denis_relay",
    message: `Denis: ${
      input.station === "kitchen" ? "kuhinja" : "bar"
    } javlja — ${proposal.area} kasni ~${proposal.minutes} min. Gosti sa tim stavkama dobijaju realno vreme.`,
  });

  void logActivity(input.admin, {
    locationId: input.locationId,
    station: input.station,
    staffId: input.staffId,
    action: "announce_delay",
    summary: `Objavio kašnjenje: ${proposal.area} ~${proposal.minutes} min.`,
  });

  return {
    ok: true,
    area: proposal.area,
    minutes: proposal.minutes,
    staffNotified: delivered,
  };
}

async function executeProposeEightySix(
  input: StationGeneralVoiceToolExecutorInput,
  args: Record<string, unknown>
): Promise<unknown> {
  const spokenName =
    typeof args.productName === "string" ? args.productName.trim() : "";
  const action = args.action === "restore" ? "restore" : "remove";
  if (!spokenName) return { ok: false, error: "empty_product_name" };

  const redis = getRedisClient();
  if (!redis) {
    return {
      ok: false,
      error: "confirmation_unavailable",
      sayToStaff:
        "Ne mogu bezbedno da potvrdim izmenu menija glasom trenutno — skini ga ručno preko 86 liste na ekranu.",
    };
  }

  const { data: rows } = await input.admin
    .from("products")
    .select("id, name, is_available")
    .eq("location_id", input.locationId)
    .is("deleted_at", null)
    .limit(500);

  const candidates = ((rows ?? []) as {
    id: string;
    name: string;
    is_available: boolean;
  }[]).filter((row) =>
    action === "remove" ? row.is_available : !row.is_available
  );

  const resolution = resolveSpokenProduct(spokenName, candidates);

  if (resolution.kind === "none") {
    return {
      ok: false,
      error: "no_match",
      sayToStaff: `Nisam našao "${spokenName}" među ${action === "remove" ? "dostupnim" : "skinutim"} artiklima — ponovi tačan naziv sa menija.`,
    };
  }

  if (resolution.kind === "ambiguous") {
    return {
      ok: false,
      error: "ambiguous",
      candidates: resolution.candidates.map((candidate) => candidate.name),
      sayToStaff: `Nisam siguran na koji artikal misliš — ${resolution.candidates
        .map((candidate) => candidate.name)
        .join(" ili ")}?`,
    };
  }

  const product = await loadProductForAvailability(
    input.admin,
    resolution.product.id
  );
  if (!product || product.location_id !== input.locationId) {
    return { ok: false, error: "product_not_found" };
  }

  const roleCheck = assertRoleCanSetProductAvailability({
    role: input.staffRole,
    menuSection: product.menu_section,
    makingUnavailable: action === "remove",
  });
  if (!roleCheck.ok) {
    return { ok: false, error: "role_not_allowed", reason: roleCheck.reason };
  }

  const proposal: EightySixProposal = {
    productId: product.id,
    productName: product.name,
    action,
  };

  try {
    await redis.set(
      eightySixProposalKey(input.locationId, input.station),
      proposal,
      { ex: EIGHTY_SIX_PROPOSAL_TTL_SEC }
    );
  } catch (error) {
    logRedisDegradation("denis.station.86.propose", error);
    return { ok: false, error: "confirmation_unavailable" };
  }

  return {
    ok: true,
    productId: product.id,
    resolvedName: product.name,
    action,
    requiresSpokenConfirmation: true,
    sayToStaff:
      action === "remove"
        ? `Skidam ${product.name} sa menija — potvrdi?`
        : `Vraćam ${product.name} na meni — potvrdi?`,
  };
}

async function executeConfirmEightySix(
  input: StationGeneralVoiceToolExecutorInput,
  args: Record<string, unknown>
): Promise<unknown> {
  const productId = typeof args.productId === "string" ? args.productId : "";
  if (!productId) return { ok: false, error: "invalid_input" };

  const redis = getRedisClient();
  if (!redis) return { ok: false, error: "confirmation_unavailable" };

  const key = eightySixProposalKey(input.locationId, input.station);
  let proposal: EightySixProposal | null = null;
  try {
    proposal = await redis.get<EightySixProposal>(key);
  } catch (error) {
    logRedisDegradation("denis.station.86.confirm", error);
    return { ok: false, error: "confirmation_unavailable" };
  }

  if (!proposal || proposal.productId !== productId) {
    return {
      ok: false,
      error: "no_pending_proposal",
      sayToStaff:
        "Nemam predlog za potvrdu — reci mi ponovo šta da skinem ili vratim.",
    };
  }

  const product = await loadProductForAvailability(input.admin, productId);
  if (!product || product.location_id !== input.locationId) {
    return { ok: false, error: "product_not_found" };
  }

  const roleCheck = assertRoleCanSetProductAvailability({
    role: input.staffRole,
    menuSection: product.menu_section,
    makingUnavailable: proposal.action === "remove",
  });
  if (!roleCheck.ok) {
    return { ok: false, error: "role_not_allowed", reason: roleCheck.reason };
  }

  const result = await setProductAvailabilityTx(input.admin, {
    product,
    available: proposal.action === "restore",
    orgId: input.orgId,
    staffUserId: input.staffId,
  });

  try {
    await redis.del(key);
  } catch (error) {
    logRedisDegradation("denis.station.86.confirm.cleanup", error);
  }

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  void logActivity(input.admin, {
    locationId: input.locationId,
    station: input.station,
    staffId: input.staffId,
    action: proposal.action === "remove" ? "eighty_six" : "restore_product",
    summary:
      proposal.action === "remove"
        ? `Skinuo ${product.name} sa menija (glasom).`
        : `Vratio ${product.name} na meni (glasom).`,
  });

  return {
    ok: true,
    changed: result.changed,
    productName: product.name,
    action: proposal.action,
  };
}

export async function executeStationGeneralVoiceTool(
  name: StationGeneralVoiceToolName,
  input: StationGeneralVoiceToolExecutorInput,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  if (name === "propose_eighty_six") {
    return executeProposeEightySix(input, args);
  }

  if (name === "confirm_eighty_six") {
    return executeConfirmEightySix(input, args);
  }

  if (name === "mark_ready_call_runner") {
    return executeMarkReadyCallRunner(input, args);
  }

  if (name === "propose_delay") {
    return executeProposeDelay(input, args);
  }

  if (name === "confirm_delay") {
    return executeConfirmDelay(input);
  }

  if (name === "read_open_items") {
    const today = new Date().toISOString().slice(0, 10);
    const dayStart = `${today}T00:00:00.000Z`;
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [missionsResult, dueCommitments, eightySixed] = await Promise.all([
      input.admin
        .from("denis_missions")
        .select("title, assigned_role, priority, created_at")
        .eq("location_id", input.locationId)
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(20),
      listDueCommitments(input.admin, {
        locationId: input.locationId,
        today,
      }),
      loadTodayEightySixItems(input.admin, {
        orgId: input.orgId,
        locationId: input.locationId,
        from: dayStart,
        to: dayEnd.toISOString(),
        station: input.station,
      }),
    ]);

    const missions = ((missionsResult.data ?? []) as Pick<
      MissionRow,
      "title" | "assigned_role" | "priority" | "created_at"
    >[]).map((mission) => ({
      title: mission.title,
      forRole: mission.assigned_role,
      urgent: mission.priority === "urgent",
    }));

    return {
      openMissions: missions,
      myDueCommitments: dueCommitments.map((commitment) => ({
        text: commitment.text,
        dueDate: commitment.due_date,
        overdue: commitment.due_date < today,
      })),
      currentlyEightySixed: eightySixed
        .filter((item) => !item.isAvailable)
        .map((item) => item.productName),
      allClear:
        missions.length === 0 &&
        dueCommitments.length === 0 &&
        eightySixed.every((item) => item.isAvailable),
    };
  }

  if (name === "get_venue_status") {
    const snapshot = await loadStaffCopilotSnapshot(input.admin, {
      locationId: input.locationId,
      staffRole: input.staffRole,
    });

    return {
      operatingMode: snapshot.operatingMode,
      kdsStress: snapshot.kdsStress,
      kdsBacklogMinutes: snapshot.kdsBacklogMinutes,
      activeOrderCount: snapshot.activeOrderCount,
      rushModeSuggestion: snapshot.rushModeSuggestion,
      tablesNeedingAttention: snapshot.priorityTables.map((table) => ({
        tableName: table.tableName,
        priority: table.priority,
        guestWaitMinutes: table.guestWaitMinutes,
        openOrderCount: table.openOrderCount,
        staffBrief: table.staffBrief,
      })),
    };
  }

  if (name === "notify_station") {
    const message = typeof args.message === "string" ? args.message.trim() : "";
    if (!message) return { ok: false, error: "empty_message" };

    const result = await createRelayMessage(input.admin, {
      locationId: input.locationId,
      fromStation: input.station,
      toStation: otherStation(input.station),
      message,
      requestedByStaffId: input.staffId,
    });

    if (result.created) {
      void logActivity(input.admin, {
        locationId: input.locationId,
        station: input.station,
        staffId: input.staffId,
        action: "notify_station",
        summary: `Prosledio poruku ka ${otherStation(input.station) === "kitchen" ? "kuhinji" : "baru"}: ${message}`,
      });
    }

    return result.created
      ? { ok: true, relayId: result.relay.id }
      : { ok: false, error: result.reason };
  }

  if (name === "notify_manager") {
    const message = typeof args.message === "string" ? args.message.trim() : "";
    if (!message) return { ok: false, error: "empty_message" };

    const { delivered } = await dispatchStaffNotification({
      orgId: input.orgId,
      locationId: input.locationId,
      type: "denis_relay",
      message,
    });

    void logActivity(input.admin, {
      locationId: input.locationId,
      station: input.station,
      staffId: input.staffId,
      action: "notify_manager",
      summary: `Poslao obaveštenje šefici: ${message}`,
    });

    return { ok: true, delivered };
  }

  if (name === "create_mission") {
    const text = typeof args.text === "string" ? args.text.trim() : "";
    const targetRole = args.targetRole as MissionAssignedRole | undefined;
    const validRoles: MissionAssignedRole[] = ["waiter", "kitchen", "bar", "manager"];
    if (!text || !targetRole || !validRoles.includes(targetRole)) {
      return { ok: false, error: "invalid_input" };
    }

    const urgent = args.urgent === true;
    const result = await createMission(input.admin, {
      kind: "custom",
      orgId: input.orgId,
      locationId: input.locationId,
      title: text.slice(0, 120),
      summary: text.slice(0, 1000),
      assignedRole: targetRole,
      priority: urgent ? "urgent" : "normal",
      payload: { createdByVoice: true, station: input.station },
    });

    if (!result.created) {
      return { ok: false, error: result.reason };
    }

    const { delivered } = await dispatchStaffNotification({
      orgId: input.orgId,
      locationId: input.locationId,
      type: "denis_relay",
      message: text,
      priorityOverride: urgent ? "urgent" : undefined,
    });

    void logActivity(input.admin, {
      locationId: input.locationId,
      station: input.station,
      staffId: input.staffId,
      action: "create_mission",
      summary: `Napravio zadatak za ${targetRole}: ${text}`,
    });

    return { ok: true, missionId: result.mission.id, delivered };
  }

  if (name === "remember_commitment") {
    const text = typeof args.text === "string" ? args.text.trim() : "";
    const dueDate = typeof args.dueDate === "string" ? args.dueDate.trim() : "";
    if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return { ok: false, error: "invalid_input" };
    }

    const result = await createCommitment(input.admin, {
      locationId: input.locationId,
      text,
      dueDate,
      station: input.station,
      promisedToStaffId: input.staffId,
    });

    if (result.created) {
      void logActivity(input.admin, {
        locationId: input.locationId,
        station: input.station,
        staffId: input.staffId,
        action: "remember_commitment",
        summary: `Obećao (do ${dueDate}): ${text}`,
      });
    }

    return result.created
      ? { ok: true, commitmentId: result.commitment.id }
      : { ok: false, error: result.reason };
  }

  // complete_commitment
  const commitmentId =
    typeof args.commitmentId === "string" ? args.commitmentId : "";
  if (!commitmentId) return { ok: false, error: "invalid_input" };

  const ok = await completeCommitment(input.admin, { commitmentId });
  if (ok) {
    void logActivity(input.admin, {
      locationId: input.locationId,
      station: input.station,
      staffId: input.staffId,
      action: "complete_commitment",
      summary: `Završio obavezu (${commitmentId}).`,
    });
  }
  return { ok };
}
