import { compileSolutionComposition } from "../chemistry/composition-compiler";
import {
  deriveCompiledSolutionProtonTransferProfile,
  deriveSubstanceProtonTransferProfile,
  getProcessesForMode,
  resolveProtonTransferPairing,
} from "../chemistry/proton-transfer";
import {
  compileNormalizedAnalyteComposition,
  type NormalizedSolutionTitrationInput,
} from "../chemistry/solution-titration-input";
import { getSubstanceById } from "../chemistry/substances";
import type {
  CharacteristicPoint,
  EquivalencePoint,
  TitrationInput,
} from "../domain/titration";
import type { CompiledSolutionComposition } from "../domain/solution-composition";
import type {
  ComponentLocalStoichiometricPath,
  ProtonTransferProfile,
  StoichiometricBoundaryPlan,
  StoichiometricBoundaryStage,
  StoichiometricCapacityContribution,
  SupportedProtonTransferPairing,
} from "../domain/stoichiometry";
import { calculatePHAtVolume } from "./titration-solver";

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
  analyteReferenceAmountMol?: number;
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

  return createSolutionLevelBoundaryPlan(paths);
}

function contributionSequenceKey(
  path: ComponentLocalStoichiometricPath,
): string {
  return path.contributions.map(({ kind, processId }) => `${kind}:${processId}`)
    .join("|");
}

function requireValidPathContribution(
  contribution: StoichiometricCapacityContribution,
): void {
  if (
    !Number.isFinite(contribution.equivalentMoles) ||
    contribution.equivalentMoles <= 0
  ) {
    throw new StoichiometricPlanningError(
      "invalid-input",
      "Stoichiometric contributions must be positive finite amounts.",
    );
  }
}

/**
 * Groups the v1.2-supported topology: one unique family process path plus
 * zero or more strong-hydroxide prefix capacities. Family path identity is
 * established by topology-derived process ids before positional grouping.
 */
export function createSolutionLevelBoundaryPlan(
  paths: readonly ComponentLocalStoichiometricPath[],
): StoichiometricBoundaryPlan {
  if (paths.length === 0) {
    throw new StoichiometricPlanningError(
      "unsupported-stage-grouping",
      "At least one reactive stoichiometric path is required.",
    );
  }

  const directions = new Set(paths.map(({ direction }) => direction));
  if (directions.size !== 1) {
    throw new StoichiometricPlanningError(
      "unsupported-stage-grouping",
      "All grouped paths must have the same proton-transfer direction.",
    );
  }

  const familyPaths: ComponentLocalStoichiometricPath[] = [];
  const strongHydroxideContributions: StoichiometricCapacityContribution[] = [];
  for (const path of paths) {
    if (path.contributions.length === 0) {
      throw new StoichiometricPlanningError(
        "unsupported-stage-grouping",
        "Reactive paths must contain at least one contribution.",
      );
    }
    path.contributions.forEach(requireValidPathContribution);

    const kinds = new Set(path.contributions.map(({ kind }) => kind));
    if (kinds.size !== 1) {
      throw new StoichiometricPlanningError(
        "unsupported-stage-grouping",
        "A component path cannot mix family and strong-hydroxide processes.",
      );
    }
    if (path.contributions[0]!.kind === "strong-hydroxide") {
      strongHydroxideContributions.push(...path.contributions);
    } else {
      familyPaths.push(path);
    }
  }

  if (familyPaths.length === 0) {
    const incrementalEquivalentMoles = strongHydroxideContributions.reduce(
      (total, contribution) => total + contribution.equivalentMoles,
      0,
    );
    return {
      direction: paths[0]!.direction,
      stages: [
        {
          order: 1,
          contributions: strongHydroxideContributions,
          incrementalEquivalentMoles,
          cumulativeEquivalentMoles: incrementalEquivalentMoles,
          participatingStepIds: [],
        },
      ],
    };
  }

  const familyPathKeys = new Set(familyPaths.map(contributionSequenceKey));
  if (familyPathKeys.size !== 1) {
    throw new StoichiometricPlanningError(
      "unsupported-stage-grouping",
      "Multiple family process paths do not have an explicit stage alignment.",
    );
  }

  let cumulativeEquivalentMoles = 0;
  const participatingStepIds: string[] = [];
  const stages: StoichiometricBoundaryStage[] = familyPaths[0]!.contributions.map(
    (_contribution, index) => {
      const familyContributions = familyPaths.map(
        (path) => path.contributions[index]!,
      );
      const contributions = index === 0
        ? [...strongHydroxideContributions, ...familyContributions]
        : familyContributions;
      const incrementalEquivalentMoles = contributions.reduce(
        (total, contribution) => total + contribution.equivalentMoles,
        0,
      );
      cumulativeEquivalentMoles += incrementalEquivalentMoles;
      for (const contribution of familyContributions) {
        if (!participatingStepIds.includes(contribution.processId)) {
          participatingStepIds.push(contribution.processId);
        }
      }
      return {
        order: index + 1,
        contributions,
        incrementalEquivalentMoles,
        cumulativeEquivalentMoles,
        participatingStepIds: [...participatingStepIds],
      };
    },
  );

  return { direction: paths[0]!.direction, stages };
}

export function planCompiledSolutionTitrationBoundaries(
  compiledAnalyte: CompiledSolutionComposition,
  pairing: SupportedProtonTransferPairing,
): PlannedCompositionTitration {
  const analyteProfile =
    deriveCompiledSolutionProtonTransferProfile(compiledAnalyte);
  const paths = createComponentLocalStoichiometricPaths(
    analyteProfile,
    pairing,
  );
  return {
    boundaryPlan: createSolutionLevelBoundaryPlan(paths),
    pairing,
  };
}

export function planSolutionTitrationBoundaries(
  input: NormalizedSolutionTitrationInput,
): PlannedCompositionTitration {
  return planCompiledSolutionTitrationBoundaries(
    compileNormalizedAnalyteComposition(input),
    input.pairing,
  );
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

  const planned = planCompiledSolutionTitrationBoundaries(
    compiledAnalyte,
    pairing,
  );
  return {
    ...planned,
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

  return planned.boundaryPlan.stages.map((stage, index) => {
    const calculatedVolumeMl =
      stage.cumulativeEquivalentMoles /
      titrantEquivalentConcentration *
      1000;
    const point: EquivalencePoint = {
      id: `equivalence-${stage.order}`,
      order: stage.order,
      volumeMl: planned.analyteReferenceAmountMol === undefined
        ? Number(calculatedVolumeMl.toPrecision(15))
        : calculatedVolumeMl,
      classification: "theoretical",
      participatingStepIds: [...stage.participatingStepIds],
    };
    if (planned.analyteReferenceAmountMol !== undefined) {
      point.stoichiometricEquivalent =
        stage.cumulativeEquivalentMoles /
        planned.analyteReferenceAmountMol;
    } else {
      point.cumulativeEquivalentMoles = stage.cumulativeEquivalentMoles;
      point.participatingProcessIds = [
        ...new Set(
          planned.boundaryPlan.stages
            .slice(0, index + 1)
            .flatMap(({ contributions }) =>
              contributions.map(({ processId }) => processId)
            ),
        ),
      ];
    }
    return point;
  });
}

export function createCharacteristicPointsFromEquivalencePoints(
  equivalencePoints: readonly EquivalencePoint[],
): CharacteristicPoint[] {
  let previousVolumeMl = 0;
  return equivalencePoints.map((equivalencePoint, index) => {
    if (
      !Number.isFinite(equivalencePoint.volumeMl) ||
      equivalencePoint.volumeMl <= previousVolumeMl
    ) {
      throw new StoichiometricPlanningError(
        "invalid-input",
        "Equivalence volumes must be positive, finite, and strictly increasing.",
      );
    }
    const volumeMl = (previousVolumeMl + equivalencePoint.volumeMl) / 2;
    previousVolumeMl = equivalencePoint.volumeMl;
    return {
      id: `half-equivalence-${index + 1}`,
      type: "half-equivalence",
      order: index + 1,
      volumeMl,
      relatedEquivalencePointIds: [equivalencePoint.id],
    };
  });
}

export function calculateCompositionEquivalencePoints(
  input: TitrationInput,
  calculatePH: (volumeMl: number) => number = (volumeMl) =>
    calculatePHAtVolume(input, volumeMl),
): EquivalencePoint[] {
  return createEquivalencePointsFromBoundaryPlan(
    planCompositionTitrationBoundaries(input),
    input.titrantConcentrationMolL,
  ).map((point) => ({ ...point, pH: calculatePH(point.volumeMl) }));
}
