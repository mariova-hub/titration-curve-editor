import { buildAnalyticalSystem, type AnalyticalSystem } from "../chemistry/chemical-system";
import type { TitrationInput } from "../domain/titration";
import { evaluateChargeBalance, type ChargeBalanceEvaluation } from "./charge-balance";
import { CalculationError } from "./errors";
import { solveLogHydrogenByBisection } from "./root-finder";

export interface PHCalculationDetails {
  pH: number;
  system: AnalyticalSystem;
  chargeBalance: ChargeBalanceEvaluation;
  iterations: number;
}

export function calculatePHDetailsAtVolume(
  input: TitrationInput,
  addedVolumeMl: number,
): PHCalculationDetails {
  let system: AnalyticalSystem;
  try {
    system = buildAnalyticalSystem(input, addedVolumeMl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid titration input.";
    throw new CalculationError("invalid-input", message);
  }

  const root = solveLogHydrogenByBisection((logH) => {
    const evaluation = evaluateChargeBalance(system, 10 ** logH);
    return { residual: evaluation.residualMolL, scale: evaluation.concentrationScaleMolL };
  });
  const pH = -root.logH;
  const chargeBalance = evaluateChargeBalance(system, 10 ** root.logH);
  if (!Number.isFinite(pH)) {
    throw new CalculationError("non-finite-residual", "Calculated pH is not finite.");
  }

  return { pH, system, chargeBalance, iterations: root.iterations };
}

export function calculatePHAtVolume(
  input: TitrationInput,
  addedVolumeMl: number,
): number {
  return calculatePHDetailsAtVolume(input, addedVolumeMl).pH;
}
