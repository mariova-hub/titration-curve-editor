import type { AcidBaseFamily, Substance } from "../domain/chemistry";
import type { CompiledSolutionComposition } from "../domain/solution-composition";
import {
  AMBIGUOUS_PROTON_TRANSFER_DIRECTION,
  INCOMPATIBLE_ACID_BASE_PAIR,
  type AnalyteProtonTransferDirection,
  type FamilyProtonTransferProcess,
  type ProtonTransferMode,
  type ProtonTransferPairingResult,
  type ProtonTransferProcess,
  type ProtonTransferProfile,
  type ProtonTransferSourceCapability,
} from "../domain/stoichiometry";
import { getAcidBaseFamilyById } from "./substances";

export type ProtonTransferTopologyErrorCode =
  | "unknown-family"
  | "unknown-initial-species"
  | "invalid-family-topology";

export class ProtonTransferTopologyError extends Error {
  constructor(
    public readonly code: ProtonTransferTopologyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProtonTransferTopologyError";
  }
}

function assertFamilyTopology(family: AcidBaseFamily): void {
  if (family.dissociationSteps.length !== family.species.length - 1) {
    throw new ProtonTransferTopologyError(
      "invalid-family-topology",
      "An acid-base family must have one step between each adjacent species.",
    );
  }

  family.dissociationSteps.forEach((step, index) => {
    const acid = family.species[index];
    const base = family.species[index + 1];
    if (
      acid === undefined ||
      base === undefined ||
      step.acidSpeciesId !== acid.id ||
      step.conjugateBaseSpeciesId !== base.id
    ) {
      throw new ProtonTransferTopologyError(
        "invalid-family-topology",
        `Dissociation step ${step.id} does not connect adjacent family species.`,
      );
    }
  });
}

function familyProcess(
  family: AcidBaseFamily,
  stepIndex: number,
  mode: ProtonTransferMode,
  coefficient: number,
): FamilyProtonTransferProcess {
  const step = family.dissociationSteps[stepIndex]!;
  return {
    kind: "family-step",
    processId: step.id,
    stepId: step.id,
    fromSpeciesId:
      mode === "donate" ? step.acidSpeciesId : step.conjugateBaseSpeciesId,
    toSpeciesId:
      mode === "donate" ? step.conjugateBaseSpeciesId : step.acidSpeciesId,
    equivalentPerSourceMole: coefficient,
  };
}

export function deriveFamilyProtonTransferProcesses(
  family: AcidBaseFamily,
  initialSpeciesId: string,
  coefficientPerSourceMole = 1,
): Pick<ProtonTransferSourceCapability, "donateProcesses" | "acceptProcesses"> {
  assertFamilyTopology(family);
  if (
    !Number.isFinite(coefficientPerSourceMole) ||
    coefficientPerSourceMole <= 0
  ) {
    throw new ProtonTransferTopologyError(
      "invalid-family-topology",
      "A family capability coefficient must be positive and finite.",
    );
  }

  const initialIndex = family.species.findIndex(
    ({ id }) => id === initialSpeciesId,
  );
  if (initialIndex < 0) {
    throw new ProtonTransferTopologyError(
      "unknown-initial-species",
      `Species ${initialSpeciesId} is not part of the selected family.`,
    );
  }

  const donateProcesses: FamilyProtonTransferProcess[] = [];
  for (let stepIndex = initialIndex; stepIndex < family.dissociationSteps.length; stepIndex += 1) {
    donateProcesses.push(
      familyProcess(family, stepIndex, "donate", coefficientPerSourceMole),
    );
  }

  const acceptProcesses: FamilyProtonTransferProcess[] = [];
  for (let stepIndex = initialIndex - 1; stepIndex >= 0; stepIndex -= 1) {
    acceptProcesses.push(
      familyProcess(family, stepIndex, "accept", coefficientPerSourceMole),
    );
  }

  return { donateProcesses, acceptProcesses };
}

function mergeProcesses(
  capabilities: ReadonlyArray<
    Pick<ProtonTransferSourceCapability, "donateProcesses" | "acceptProcesses">
  >,
): Pick<ProtonTransferSourceCapability, "donateProcesses" | "acceptProcesses"> {
  return {
    donateProcesses: capabilities.flatMap(({ donateProcesses }) => donateProcesses),
    acceptProcesses: capabilities.flatMap(({ acceptProcesses }) => acceptProcesses),
  };
}

function deriveLegacySubstanceProcesses(
  substance: Substance,
): Pick<ProtonTransferSourceCapability, "donateProcesses" | "acceptProcesses"> {
  const model = substance.acidBaseModel;
  if (model.kind === "strong-hydroxide") {
    return {
      donateProcesses: [],
      acceptProcesses: [
        {
          kind: "strong-hydroxide",
          processId: `${substance.id}.strong-hydroxide`,
          equivalentPerSourceMole: model.hydroxideStoichiometry,
        },
      ],
    };
  }

  const initialSpecies = model.family.species.find(
    ({ formula }) => formula === substance.formula,
  );
  if (initialSpecies === undefined) {
    throw new ProtonTransferTopologyError(
      "unknown-initial-species",
      `Legacy substance ${substance.id} has no family species matching its formula.`,
    );
  }
  return deriveFamilyProtonTransferProcesses(model.family, initialSpecies.id);
}

export function deriveSubstanceProtonTransferProfile(
  substance: Substance,
): ProtonTransferProfile {
  const composition = substance.dissolvedComposition;
  const processes = composition === undefined
    ? deriveLegacySubstanceProcesses(substance)
    : mergeProcesses(
        composition.familyComponents.map((component) => {
          if (
            substance.acidBaseModel.kind !== "protonation-family" ||
            substance.acidBaseModel.family.id !== component.familyId
          ) {
            throw new ProtonTransferTopologyError(
              "unknown-family",
              `Substance ${substance.id} does not define family ${component.familyId}.`,
            );
          }
          return deriveFamilyProtonTransferProcesses(
            substance.acidBaseModel.family,
            component.initialSpeciesId,
            component.stoichiometryPerFormulaUnit,
          );
        }),
      );

  return {
    sources: [
      {
        sourceComponentId: substance.id,
        amountMol: 1,
        ...processes,
      },
    ],
  };
}

export function deriveCompiledSolutionProtonTransferProfile(
  composition: CompiledSolutionComposition,
  familyLookup: (id: string) => AcidBaseFamily | undefined = getAcidBaseFamilyById,
): ProtonTransferProfile {
  return {
    sources: composition.protonTransferSources.map((source) => {
      if (source.kind === "strong-hydroxide") {
        return {
          sourceComponentId: source.sourceComponentId,
          amountMol: source.amountMol,
          donateProcesses: [],
          acceptProcesses: [
            {
              kind: "strong-hydroxide",
              processId: `${source.sourceComponentId}.strong-hydroxide`,
              equivalentPerSourceMole: source.hydroxideStoichiometry,
            },
          ],
        } satisfies ProtonTransferSourceCapability;
      }

      const family = familyLookup(source.familyId);
      if (family === undefined) {
        throw new ProtonTransferTopologyError(
          "unknown-family",
          `Unknown acid-base family: ${source.familyId}.`,
        );
      }
      return {
        sourceComponentId: source.sourceComponentId,
        amountMol: source.amountMol,
        ...deriveFamilyProtonTransferProcesses(
          family,
          source.initialSpeciesId,
        ),
      } satisfies ProtonTransferSourceCapability;
    }),
  };
}

export function getProfileEquivalentCapacity(
  profile: ProtonTransferProfile,
  mode: ProtonTransferMode,
): number {
  const key = mode === "donate" ? "donateProcesses" : "acceptProcesses";
  return profile.sources.reduce(
    (profileTotal, source) =>
      profileTotal +
      source.amountMol *
        source[key].reduce(
          (sourceTotal, process) =>
            sourceTotal + process.equivalentPerSourceMole,
          0,
        ),
    0,
  );
}

interface PairingCandidate {
  direction: AnalyteProtonTransferDirection;
  analyteMode: ProtonTransferMode;
  titrantMode: ProtonTransferMode;
}

export function resolveProtonTransferPairing(
  analyte: ProtonTransferProfile,
  titrant: ProtonTransferProfile,
): ProtonTransferPairingResult {
  const candidates: PairingCandidate[] = [];
  if (
    getProfileEquivalentCapacity(analyte, "accept") > 0 &&
    getProfileEquivalentCapacity(titrant, "donate") > 0
  ) {
    candidates.push({
      direction: "protonation",
      analyteMode: "accept",
      titrantMode: "donate",
    });
  }
  if (
    getProfileEquivalentCapacity(analyte, "donate") > 0 &&
    getProfileEquivalentCapacity(titrant, "accept") > 0
  ) {
    candidates.push({
      direction: "deprotonation",
      analyteMode: "donate",
      titrantMode: "accept",
    });
  }

  if (candidates.length === 0) {
    return {
      status: "incompatible",
      candidateCount: 0,
      code: INCOMPATIBLE_ACID_BASE_PAIR,
    };
  }
  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      candidateCount: candidates.length,
      code: AMBIGUOUS_PROTON_TRANSFER_DIRECTION,
    };
  }

  const candidate = candidates[0]!;
  return {
    status: "supported",
    candidateCount: 1,
    ...candidate,
    titrantEquivalentCapacityPerMol: getProfileEquivalentCapacity(
      titrant,
      candidate.titrantMode,
    ),
  };
}

export function resolveSubstanceProtonTransferPairing(
  analyte: Substance,
  titrant: Substance,
): ProtonTransferPairingResult {
  return resolveProtonTransferPairing(
    deriveSubstanceProtonTransferProfile(analyte),
    deriveSubstanceProtonTransferProfile(titrant),
  );
}

export function getProcessesForMode(
  source: ProtonTransferSourceCapability,
  mode: ProtonTransferMode,
): readonly ProtonTransferProcess[] {
  return mode === "donate" ? source.donateProcesses : source.acceptProcesses;
}
