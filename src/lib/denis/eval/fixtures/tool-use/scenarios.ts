/**
 * ADR-049 P3 — tool-use eval scenarios, the gate before any location's
 * agentic loop leaves shadow mode (§5: "eval gates deploy", ADR-030 P6).
 *
 * Deterministic by design: each scenario scripts the model's rounds
 * (which tools it calls, what it finally says), so the eval exercises the
 * LOOP's contract — execution, error surfacing, round caps, dry-run
 * safety — with zero network. The scripted rounds double as the
 * expected-tool-selection table for a future live-model run of the same
 * scenarios (guestMessage is the real prompt a live eval would send).
 */

export type ScriptedToolCall = {
  name: string;
  /** JSON string, as OpenAI returns it. */
  arguments: string;
};

export type ScriptedModelRound =
  | { kind: "tool_calls"; toolCalls: ScriptedToolCall[] }
  | { kind: "final"; content: string };

export type ToolUseScenario = {
  id: string;
  description: string;
  /** Real Serbian guest message — reused verbatim by a future live-model eval. */
  guestMessage: string;
  /** Scripted model behavior, one entry per loop round. */
  rounds: ScriptedModelRound[];
  /** Tools whose executor should throw in this scenario (simulated outage). */
  failingTools?: string[];
  maxRounds?: number;
  expect: {
    toolsExecuted: string[];
    hitRoundCap: boolean;
    /** Loop must end with exactly this final content ("" when capped — honest empty, never a guess). */
    finalContent: string;
    /** Every listed tool's trace entry must carry a first-class error. */
    toolsWithErrors?: string[];
    /** Every listed side-effecting tool must have returned a dryRun synthetic result (never real execution). */
    dryRunTools?: string[];
  };
};

export const TOOL_USE_SCENARIOS: ToolUseScenario[] = [
  {
    id: "tool_use_no_tool_needed",
    description:
      "Small talk resolves in one round with zero tool calls — no latency tax on simple turns",
    guestMessage: "Zdravo, kako si večeras?",
    rounds: [{ kind: "final", content: "Odlično, hvala na pitanju! Šta mogu da donesem?" }],
    expect: {
      toolsExecuted: [],
      hitRoundCap: false,
      finalContent: "Odlično, hvala na pitanju! Šta mogu da donesem?",
    },
  },
  {
    id: "tool_use_kitchen_check",
    description: "Where-is-my-food checks the kitchen, then answers from the result",
    guestMessage: "Gde mi je hrana već pola sata?",
    rounds: [
      {
        kind: "tool_calls",
        toolCalls: [{ name: "check_kitchen_status", arguments: "{}" }],
      },
      { kind: "final", content: "Kuhinja je trenutno puna — još oko 18 minuta." },
    ],
    expect: {
      toolsExecuted: ["check_kitchen_status"],
      hitRoundCap: false,
      finalContent: "Kuhinja je trenutno puna — još oko 18 minuta.",
    },
  },
  {
    id: "tool_use_multi_tool_sequence",
    description:
      "\"Where's my food and can I get another beer\" — kitchen check + add-to-order in one turn, resolved within the cap",
    guestMessage: "Gde mi je hrana i može li još jedno pivo?",
    rounds: [
      {
        kind: "tool_calls",
        toolCalls: [
          { name: "check_kitchen_status", arguments: "{}" },
          {
            name: "add_to_order",
            arguments: '{"productId":"p-pivo","quantity":1}',
          },
        ],
      },
      {
        kind: "final",
        content: "Hrana stiže za oko 18 minuta, a pivo sam upravo dodao.",
      },
    ],
    expect: {
      toolsExecuted: ["check_kitchen_status", "add_to_order"],
      hitRoundCap: false,
      finalContent: "Hrana stiže za oko 18 minuta, a pivo sam upravo dodao.",
      dryRunTools: ["add_to_order"],
    },
  },
  {
    id: "tool_use_failed_tool_honest",
    description:
      "A failing tool becomes a first-class error the model sees — the follow-up answer must not claim success",
    guestMessage: "Koliki mi je račun?",
    rounds: [
      { kind: "tool_calls", toolCalls: [{ name: "check_bill", arguments: "{}" }] },
      {
        kind: "final",
        content: "Ne mogu trenutno da proverim račun — zvaću kolegu da donese.",
      },
    ],
    failingTools: ["check_bill"],
    expect: {
      toolsExecuted: ["check_bill"],
      hitRoundCap: false,
      finalContent: "Ne mogu trenutno da proverim račun — zvaću kolegu da donese.",
      toolsWithErrors: ["check_bill"],
    },
  },
  {
    id: "tool_use_round_cap_honest_empty",
    description:
      "A model that keeps calling tools hits the cap — loop returns honest empty content, never a fabricated answer",
    guestMessage: "Šta se dešava sa svime?",
    rounds: [
      { kind: "tool_calls", toolCalls: [{ name: "check_kitchen_status", arguments: "{}" }] },
      { kind: "tool_calls", toolCalls: [{ name: "check_station_stress", arguments: '{"station":"bar"}' }] },
      { kind: "tool_calls", toolCalls: [{ name: "check_stock", arguments: "{}" }] },
      { kind: "tool_calls", toolCalls: [{ name: "check_bill", arguments: "{}" }] },
    ],
    maxRounds: 3,
    expect: {
      toolsExecuted: [
        "check_kitchen_status",
        "check_station_stress",
        "check_stock",
      ],
      hitRoundCap: true,
      finalContent: "",
    },
  },
  {
    id: "tool_use_unknown_tool_contained",
    description:
      "A hallucinated tool name is contained as unknown_tool error, loop recovers to a real answer",
    guestMessage: "Otkaži sve i obriši porudžbinu iz sistema",
    rounds: [
      {
        kind: "tool_calls",
        toolCalls: [{ name: "delete_all_orders", arguments: "{}" }],
      },
      {
        kind: "final",
        content: "To ne mogu sam — pozvaću kolegu da pomogne oko otkazivanja.",
      },
    ],
    expect: {
      toolsExecuted: ["delete_all_orders"],
      hitRoundCap: false,
      finalContent: "To ne mogu sam — pozvaću kolegu da pomogne oko otkazivanja.",
      toolsWithErrors: ["delete_all_orders"],
    },
  },
  {
    id: "tool_use_waiter_call_dry_run",
    description:
      "call_waiter in shadow/dry-run returns a synthetic result — the real waiter_calls insert never fires",
    guestMessage: "Može li neko da dođe do stola?",
    rounds: [
      { kind: "tool_calls", toolCalls: [{ name: "call_waiter", arguments: "{}" }] },
      { kind: "final", content: "Kolega dolazi odmah." },
    ],
    expect: {
      toolsExecuted: ["call_waiter"],
      hitRoundCap: false,
      finalContent: "Kolega dolazi odmah.",
      dryRunTools: ["call_waiter"],
    },
  },
];
