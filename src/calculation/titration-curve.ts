import { SUBSTANCES } from "../chemistry/substances";
import type { TitrationInput, TitrationResult } from "../domain/titration";
import { validateTitrationInput } from "../domain/validation";
import {
  determineMaxVolumeMl,
  generateSamplingVolumes,
  resolveSamplingOptions,
  type SamplingOptions,
} from "../sampling";
import { calculateEquivalencePoints, calculateHalfEquivalencePoints } from "./equivalence-points";
import { CalculationError } from "./errors";
import { calculatePHAtVolume } from "./titration-solver";

export function calculateTitrationCurve(
  input: TitrationInput,
  options: SamplingOptions = {},
): TitrationResult {
  const validation = validateTitrationInput(input, SUBSTANCES);
  if (!validation.valid) {
    throw new CalculationError(
      "invalid-input",
      validation.errors.map(({ message }) => message).join(" "),
    );
  }
  resolveSamplingOptions(options);

  const phByVolume = new Map<number, number>();
  const calculateOnce = (volumeMl: number): number => {
    const cached = phByVolume.get(volumeMl);
    if (cached !== undefined) return cached;
    const pH = calculatePHAtVolume(input, volumeMl);
    if (!Number.isFinite(pH)) {
      throw new CalculationError("non-finite-residual", `Non-finite pH at ${volumeMl} mL.`);
    }
    phByVolume.set(volumeMl, pH);
    return pH;
  };

  const equivalencePoints = calculateEquivalencePoints(input, calculateOnce);
  const characteristicPoints = calculateHalfEquivalencePoints(
    input,
    equivalencePoints,
    calculateOnce,
  );
  const maxVolumeMl = determineMaxVolumeMl(equivalencePoints, options.maxVolumeMl);
  const samplingVolumes = generateSamplingVolumes(
    maxVolumeMl,
    equivalencePoints,
    characteristicPoints,
    options,
  );
  const points = samplingVolumes.map((addedVolumeMl) => ({
    addedVolumeMl,
    pH: calculateOnce(addedVolumeMl),
  }));

  return { equivalencePoints, characteristicPoints, points };
}
