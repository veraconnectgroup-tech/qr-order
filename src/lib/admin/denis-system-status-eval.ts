import { runPilotGate } from "@/lib/denis/eval/run-pilot-gate";
import { runQualityContractEval } from "@/lib/denis/cognition/quality/contract-eval";
import { WAITER_PARITY_SCENARIOS } from "@/lib/denis/eval/fixtures/waiter-parity/scenarios";

export type DenisSystemStatusEval = {
  eval: {
    pilotGateOk: boolean;
    corePass: number;
    coreTotal: number;
    waiterParityPass: number;
    waiterParityTotal: number;
    qualityContractOk: boolean;
  };
  gaps: {
    codeCompleteCognition: boolean;
    proactiveInLoop: boolean;
    operatorWebhooks: boolean;
  };
};

/** Pure eval slice — no auth / DB (for tests + admin merge). */
export function computeDenisSystemStatusEval(): DenisSystemStatusEval {
  const gate = runPilotGate();
  const quality = runQualityContractEval();

  return {
    eval: {
      pilotGateOk: gate.ok,
      corePass: gate.core.passed,
      coreTotal: gate.core.scenarioCount,
      waiterParityPass: gate.waiterParity.passed,
      waiterParityTotal: WAITER_PARITY_SCENARIOS.length,
      qualityContractOk: quality.ok,
    },
    gaps: {
      codeCompleteCognition: gate.waiterParity.ok && quality.ok,
      proactiveInLoop: false,
      operatorWebhooks: false,
    },
  };
}
