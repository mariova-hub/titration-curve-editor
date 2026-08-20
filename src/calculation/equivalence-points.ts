import { getSubstanceById } from "../chemistry/substances";
import type { Substance } from "../domain/chemistry";
import type { CharacteristicPoint, EquivalencePoint, TitrationInput } from "../domain/titration";
import { CalculationError } from "./errors";
import { calculatePHAtVolume } from "./titration-solver";

interface StoichiometricStage {
  equivalent: number;
  stepIds: string[];
}

export type PHAtVolumeCalculator = (volumeMl: number) => number;

function getProtonCapacity(substance: Substance): number {
  return substance.acidBaseModel.kind === "strong-hydroxide"
    ? substance.acidBaseModel.hydroxideStoichiometry
    : substance.acidBaseModel.family.protonCount;
}

function getAnalyteStages(substance: Substance): StoichiometricStage[] {
  const model = substance.acidBaseModel;
  if (model.kind === "strong-hydroxide") {
    return [{ equivalent: model.hydroxideStoichiometry, stepIds: [] }];
  }
  return model.family.dissociationSteps.map((step) => ({
    equivalent: step.order,
    stepIds: model.family.dissociationSteps.slice(0, step.order).map(({ id }) => id),
  }));
}

function loadPair(input: TitrationInput): { analyte: Substance; titrant: Substance } {
  const analyte = getSubstanceById(input.analyteSubstanceId);
  const titrant = getSubstanceById(input.titrantSubstanceId);
  if (analyte === undefined || titrant === undefined) {
    throw new CalculationError("invalid-input", "Unknown analyte or titrant substance id.");
  }
  return { analyte, titrant };
}

export function calculateEquivalencePoints(
  input: TitrationInput,
  calculatePH: PHAtVolumeCalculator = (volumeMl) => calculatePHAtVolume(input, volumeMl),
): EquivalencePoint[] {
  const { analyte, titrant } = loadPair(input);
  const analyteMoles = input.analyteConcentrationMolL * input.analyteVolumeMl / 1000;
  const titrantCapacity = getProtonCapacity(titrant);

  return getAnalyteStages(analyte).map((stage, index) => {
    const volumeMl = analyteMoles * stage.equivalent /
      (input.titrantConcentrationMolL * titrantCapacity) * 1000;
    return {
      id: `equivalence-${index + 1}`,
      order: index + 1,
      volumeMl,
      pH: calculatePH(volumeMl),
      classification: "theoretical",
      stoichiometricEquivalent: stage.equivalent,
      participatingStepIds: stage.stepIds,
    };
  });
}

export function calculateHalfEquivalencePoints(
  input: TitrationInput,
  equivalencePoints: readonly EquivalencePoint[] = calculateEquivalencePoints(input),
  calculatePH: PHAtVolumeCalculator = (volumeMl) => calculatePHAtVolume(input, volumeMl),
): CharacteristicPoint[] {
  let previousVolumeMl = 0;
  return equivalencePoints.map((equivalencePoint, index) => {
    const volumeMl = (previousVolumeMl + equivalencePoint.volumeMl) / 2;
    previousVolumeMl = equivalencePoint.volumeMl;
    return {
      id: `half-equivalence-${index + 1}`,
      type: "half-equivalence",
      order: index + 1,
      volumeMl,
      pH: calculatePH(volumeMl),
      relatedEquivalencePointIds: [equivalencePoint.id],
    };
  });
}
