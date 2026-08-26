import {
  validateAnalyticalSystemInput,
} from "../chemistry/chemical-system";
import { validateSolutionTitrationInput } from "../chemistry/solution-titration-input";
import { getSubstanceById } from "../chemistry/substances";
import {
  isSolutionTitrationInput,
  type TitrationCurveInput,
  type TitrationInput,
  type TitrationResult,
} from "../domain/titration";
import {
  determineMaxVolumeMl,
  generateSamplingVolumes,
  resolveSamplingOptions,
  type SamplingOptions,
} from "../sampling";
import { calculateEquivalencePoints, calculateHalfEquivalencePoints } from "./equivalence-points";
import { CalculationError } from "./errors";
import { calculateCompositionEquivalencePoints } from "./stoichiometric-boundaries";
import { calculatePHAtVolume } from "./titration-solver";

function calculateSingleAnalyteTitrationCurve(
  input: TitrationInput,
  options: SamplingOptions = {},
): TitrationResult {
  const validation = validateAnalyticalSystemInput(input);
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

  const analyte = getSubstanceById(input.analyteSubstanceId);
  const equivalencePoints = analyte?.dissolvedComposition === undefined
    ? calculateEquivalencePoints(input, calculateOnce)
    : calculateCompositionEquivalencePoints(input, calculateOnce);
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

export function calculateTitrationCurve<TInput extends TitrationCurveInput>(
  input: TInput,
  options: SamplingOptions = {},
): TitrationResult {
  if (!isSolutionTitrationInput(input)) {
    return calculateSingleAnalyteTitrationCurve(input, options);
  }

  const validation = validateSolutionTitrationInput(input);
  if (!validation.valid) {
    throw new CalculationError(
      "invalid-input",
      validation.errors[0].message,
    );
  }

  throw new CalculationError(
    "unsupported-mixed-analyte-calculation",
    "混合分析溶液の曲線計算は後続Phaseで接続されます。",
  );
}
