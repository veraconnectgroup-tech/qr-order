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
import type { MissionAssignedRole } from "@/lib/denis/missions/mission-types";

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
  | "create_mission";

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
