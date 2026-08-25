import { compileSolutionComposition } from "../chemistry/composition-compiler";
import {
  deriveCompiledSolutionProtonTransferProfile,
  deriveSubstanceProtonTransferProfile,
  getProcessesForMode,
  resolveProtonTransferPairing,
} from "../chemistry/proton-transfer";
import { getSubstanceById } from "../chemistry/substances";
import type { EquivalencePoint, TitrationInput } from "../domain/titration";
import type {
  ComponentLocalStoichiometricPath,
  ProtonTransferProfile,
  StoichiometricBoundaryPlan,
  StoichiometricBoundaryStage,
  StoichiometricCapacityContribution,
  SupportedProtonTransferPairing,
} from "../domain/stoichiometry";

export type StoichiometricPlanningErrorCode =
  | "invalid-input"
  | "unknown-substance"
  | "same-substance"
  | "incompatible-acid-base-pair"
  | "ambiguous-proton-transfer-direction"
  | "unsupported-stage-grouping";

export class StoichiometricPlanningError extends Error {
  constructor(
    public readonly code: StoichiometricPlanningErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StoichiometricPlanningError";
  }
}

export interface PlannedCompositionTitration {
  boundaryPlan: StoichiometricBoundaryPlan;
  pairing: SupportedProtonTransferPairing;
  analyteReferenceAmountMol: number;
}

function requirePositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new StoichiometricPlanningError(
      "invalid-input",
      `${label} must be a positive finite number.`,
    );
  }
}

export function createComponentLocalStoichiometricPaths(
  profile: ProtonTransferProfile,
  pairing: SupportedProtonTransferPairing,
): ComponentLocalStoichiometricPath[] {
  return profile.sources.flatMap((source) => {
    const processes = getProcessesForMode(source, pairing.analyteMode);
    if (processes.length === 0 || source.amountMol <= 0) return [];

    return [
      {
        sourceComponentId: source.sourceComponentId,
        direction: pairing.direction,
        contributions: processes.map(
          (process): StoichiometricCapacityContribution => ({
            sourceComponentId: source.sourceComponentId,
            processId: process.processId,
            kind: process.kind,
            equivalentMoles:
              source.amountMol * process.equivalentPerSourceMole,
          }),
        ),
      },
    ];
  });
}

/**
 * Builds the v1.1 single-reactive-component case as a solution-level plan.
 * Stage contributions are arrays so a later grouping policy can aggregate
 * multiple processes without changing the public boundary representation.
 */
export function createSingleReactiveComponentBoundaryPlan(
  paths: readonly ComponentLocalStoichiometricPath[],
): StoichiometricBoundaryPlan {
  if (paths.length !== 1) {
    throw new StoichiometricPlanningError(
      "unsupported-stage-grouping",
      "v1.1 requires exactly one reactive component; mixed-stage grouping is deferred.",
    );
  }

  const path = paths[0]!;
  let cumulativeEquivalentMoles = 0;
  const participatingStepIds: string[] = [];
  const stages: StoichiometricBoundaryStage[] = path.contributions.map(
    (contribution, index) => {
      cumulativeEquivalentMoles += contribution.equivalentMoles;
      if (contribution.kind === "family-step") {
        participatingStepIds.push(contribution.processId);
      }
      return {
        order: index + 1,
        contributions: [contribution],
        incrementalEquivalentMoles: contribution.equivalentMoles,
        cumulativeEquivalentMoles,
        participatingStepIds: [...participatingStepIds],
      };
    },
  );

  return { direction: path.direction, stages };
}

export function planCompositionTitrationBoundaries(
  input: TitrationInput,
): PlannedCompositionTitration {
  requirePositiveFinite(
    input.analyteConcentrationMolL,
    "Analyte concentration",
  );
  requirePositiveFinite(input.analyteVolumeMl, "Analyte volume");
  requirePositiveFinite(
    input.titrantConcentrationMolL,
    "Titrant concentration",
  );

  const analyte = getSubstanceById(input.analyteSubstanceId);
  const titrant = getSubstanceById(input.titrantSubstanceId);
  if (analyte === undefined || titrant === undefined) {
    throw new StoichiometricPlanningError(
      "unknown-substance",
      "Unknown analyte or titrant substance id.",
    );
  }
  if (analyte.id === titrant.id) {
    throw new StoichiometricPlanningError(
      "same-substance",
      "Analyte and titrant must be different substances.",
    );
  }

  const analyteReferenceAmountMol =
    input.analyteConcentrationMolL * input.analyteVolumeMl / 1000;
  const compiledAnalyte = compileSolutionComposition(
    [
      {
        sourceComponentId: "analyte",
        substanceId: analyte.id,
        amountMol: analyteReferenceAmountMol,
      },
    ],
    input.analyteVolumeMl / 1000,
  );
  const analyteProfile =
    deriveCompiledSolutionProtonTransferProfile(compiledAnalyte);
  const titrantProfile = deriveSubstanceProtonTransferProfile(titrant);
  const pairing = resolveProtonTransferPairing(
    analyteProfile,
    titrantProfile,
  );
  if (pairing.status !== "supported") {
    throw new StoichiometricPlanningError(
      pairing.code,
      pairing.status === "ambiguous"
        ? "More than one proton-transfer direction is possible."
        : "No proton-transfer direction is available.",
    );
  }

  const paths = createComponentLocalStoichiometricPaths(
    analyteProfile,
    pairing,
  );
  return {
    boundaryPlan: createSingleReactiveComponentBoundaryPlan(paths),
    pairing,
    analyteReferenceAmountMol,
  };
}

export function createEquivalencePointsFromBoundaryPlan(
  planned: PlannedCompositionTitration,
  titrantConcentrationMolL: number,
): EquivalencePoint[] {
  requirePositiveFinite(titrantConcentrationMolL, "Titrant concentration");
  const titrantEquivalentConcentration =
    titrantConcentrationMolL *
    planned.pairing.titrantEquivalentCapacityPerMol;

  return planned.boundaryPlan.stages.map((stage) => ({
    id: `equivalence-${stage.order}`,
    order: stage.order,
    volumeMl:
      stage.cumulativeEquivalentMoles /
      titrantEquivalentConcentration *
      1000,
    classification: "theoretical",
    stoichiometricEquivalent:
      stage.cumulativeEquivalentMoles /
      planned.analyteReferenceAmountMol,
    participatingStepIds: [...stage.participatingStepIds],
  }));
}

export function calculateCompositionEquivalencePoints(
  input: TitrationInput,
): EquivalencePoint[] {
  return createEquivalencePointsFromBoundaryPlan(
    planCompositionTitrationBoundaries(input),
    input.titrantConcentrationMolL,
  );
}
