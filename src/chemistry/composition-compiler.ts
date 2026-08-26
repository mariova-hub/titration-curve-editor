import type { Substance } from "../domain/chemistry";
import type {
  AcidBaseFamilyId,
  AggregatedFamilyAmount,
  AggregatedFixedIonAmount,
  CompiledSolutionComposition,
  FamilyAmountContribution,
  FixedIonAmountContribution,
  FixedIonId,
  ProtonTransferCapacitySource,
  QuantifiedSolutionComponent,
} from "../domain/solution-composition";
import { getFixedIonById, type FixedIon } from "./fixed-ions";
import {
  adaptStrongHydroxideComposition,
  StrongHydroxideCompositionAdapterError,
  type AdaptedStrongHydroxideComponent,
} from "./strong-hydroxide-composition-adapter";
import { getSubstanceById } from "./substances";

export type CompositionCompilerErrorCode =
  | "empty-component-list"
  | "invalid-total-volume"
  | "invalid-source-component-id"
  | "duplicate-source-component-id"
  | "invalid-component-amount"
  | "unknown-substance"
  | "missing-dissolved-composition"
  | "invalid-composition-coefficient"
  | "invalid-family-reference"
  | "invalid-initial-species-reference"
  | "invalid-fixed-ion-reference"
  | "non-finite-contribution";

export class CompositionCompilerError extends Error {
  constructor(
    public readonly code: CompositionCompilerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CompositionCompilerError";
  }
}

export interface CompositionCompilerLookup {
  getSubstanceById(id: string): Substance | undefined;
  getFixedIonById(id: string): FixedIon | undefined;
}

const DEFAULT_LOOKUP: CompositionCompilerLookup = {
  getSubstanceById,
  getFixedIonById,
};

interface MutableFamilyAmount {
  familyId: AcidBaseFamilyId;
  totalAmountMol: number;
  contributions: FamilyAmountContribution[];
}

interface MutableFixedIonAmount {
  speciesId: FixedIonId;
  totalAmountMol: number;
  contributions: FixedIonAmountContribution[];
}

function requirePositiveFiniteCoefficient(
  coefficient: number,
  componentId: string,
): void {
  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    throw new CompositionCompilerError(
      "invalid-composition-coefficient",
      `Component ${componentId} has a non-positive or non-finite composition coefficient.`,
    );
  }
}

function contributionAmount(
  amountMol: number,
  coefficient: number,
  componentId: string,
): number {
  requirePositiveFiniteCoefficient(coefficient, componentId);
  const contribution = amountMol * coefficient;
  if (!Number.isFinite(contribution)) {
    throw new CompositionCompilerError(
      "non-finite-contribution",
      `Component ${componentId} produces a non-finite amount contribution.`,
    );
  }
  return contribution;
}

function validateFamilyReference(
  substance: Substance,
  familyId: AcidBaseFamilyId,
  initialSpeciesId: string,
): void {
  if (
    substance.acidBaseModel.kind !== "protonation-family" ||
    substance.acidBaseModel.family.id !== familyId
  ) {
    throw new CompositionCompilerError(
      "invalid-family-reference",
      `Substance ${substance.id} references unknown family ${familyId}.`,
    );
  }
  if (
    !substance.acidBaseModel.family.species.some(
      ({ id }) => id === initialSpeciesId,
    )
  ) {
    throw new CompositionCompilerError(
      "invalid-initial-species-reference",
      `Species ${initialSpeciesId} is not in family ${familyId}.`,
    );
  }
}

function validateInputs(
  components: readonly QuantifiedSolutionComponent[],
  totalVolumeL: number,
): void {
  if (!Number.isFinite(totalVolumeL) || totalVolumeL <= 0) {
    throw new CompositionCompilerError(
      "invalid-total-volume",
      "Total solution volume must be a positive finite number.",
    );
  }
  if (components.length === 0) {
    throw new CompositionCompilerError(
      "empty-component-list",
      "At least one quantified solution component is required.",
    );
  }

  const sourceComponentIds = new Set<string>();
  for (const component of components) {
    if (component.sourceComponentId.trim().length === 0) {
      throw new CompositionCompilerError(
        "invalid-source-component-id",
        "Source component id must not be empty.",
      );
    }
    if (sourceComponentIds.has(component.sourceComponentId)) {
      throw new CompositionCompilerError(
        "duplicate-source-component-id",
        `Duplicate source component id: ${component.sourceComponentId}.`,
      );
    }
    sourceComponentIds.add(component.sourceComponentId);

    if (!Number.isFinite(component.amountMol) || component.amountMol < 0) {
      throw new CompositionCompilerError(
        "invalid-component-amount",
        `Component ${component.sourceComponentId} amount must be a non-negative finite number.`,
      );
    }
  }
}

export function compileSolutionComposition(
  components: readonly QuantifiedSolutionComponent[],
  totalVolumeL: number,
  lookup: CompositionCompilerLookup = DEFAULT_LOOKUP,
): CompiledSolutionComposition {
  validateInputs(components, totalVolumeL);

  const familyAmounts = new Map<AcidBaseFamilyId, MutableFamilyAmount>();
  const fixedIonAmounts = new Map<FixedIonId, MutableFixedIonAmount>();
  const protonTransferSources: ProtonTransferCapacitySource[] = [];

  for (const component of components) {
    const substance = lookup.getSubstanceById(component.substanceId);
    if (substance === undefined) {
      throw new CompositionCompilerError(
        "unknown-substance",
        `Unknown substance: ${component.substanceId}.`,
      );
    }
    let composition = substance.dissolvedComposition;
    let adaptedStrongHydroxide: AdaptedStrongHydroxideComponent | undefined;
    if (composition === undefined) {
      try {
        adaptedStrongHydroxide = adaptStrongHydroxideComposition(
          substance,
          component,
        );
      } catch (error) {
        if (!(error instanceof StrongHydroxideCompositionAdapterError)) {
          throw error;
        }
        throw new CompositionCompilerError(
          error.code === "unregistered-legacy-fixed-ion"
            ? "invalid-fixed-ion-reference"
            : "invalid-composition-coefficient",
          error.message,
        );
      }
      composition = adaptedStrongHydroxide?.dissolvedComposition;
      if (composition === undefined) {
        throw new CompositionCompilerError(
          "missing-dissolved-composition",
          `Substance ${substance.id} has no dissolved composition.`,
        );
      }
    }

    for (const familyComponent of composition.familyComponents) {
      validateFamilyReference(
        substance,
        familyComponent.familyId,
        familyComponent.initialSpeciesId,
      );
      const amountMol = contributionAmount(
        component.amountMol,
        familyComponent.stoichiometryPerFormulaUnit,
        component.sourceComponentId,
      );
      if (amountMol === 0) continue;

      const contribution: FamilyAmountContribution = {
        sourceComponentId: component.sourceComponentId,
        initialSpeciesId: familyComponent.initialSpeciesId,
        amountMol,
      };
      const existing = familyAmounts.get(familyComponent.familyId);
      if (existing === undefined) {
        familyAmounts.set(familyComponent.familyId, {
          familyId: familyComponent.familyId,
          totalAmountMol: amountMol,
          contributions: [contribution],
        });
      } else {
        existing.totalAmountMol += amountMol;
        existing.contributions.push(contribution);
      }
      protonTransferSources.push({
        kind: "family",
        sourceComponentId: component.sourceComponentId,
        familyId: familyComponent.familyId,
        initialSpeciesId: familyComponent.initialSpeciesId,
        amountMol,
      });
    }

    for (const fixedIonComponent of composition.fixedIons) {
      if (lookup.getFixedIonById(fixedIonComponent.speciesId) === undefined) {
        throw new CompositionCompilerError(
          "invalid-fixed-ion-reference",
          `Unknown fixed ion: ${fixedIonComponent.speciesId}.`,
        );
      }
      const amountMol = contributionAmount(
        component.amountMol,
        fixedIonComponent.stoichiometryPerFormulaUnit,
        component.sourceComponentId,
      );
      if (amountMol === 0) continue;

      const contribution: FixedIonAmountContribution = {
        sourceComponentId: component.sourceComponentId,
        amountMol,
      };
      const existing = fixedIonAmounts.get(fixedIonComponent.speciesId);
      if (existing === undefined) {
        fixedIonAmounts.set(fixedIonComponent.speciesId, {
          speciesId: fixedIonComponent.speciesId,
          totalAmountMol: amountMol,
          contributions: [contribution],
        });
      } else {
        existing.totalAmountMol += amountMol;
        existing.contributions.push(contribution);
      }
    }

    if (component.amountMol > 0) {
      if (adaptedStrongHydroxide !== undefined) {
        protonTransferSources.push(adaptedStrongHydroxide.protonTransferSource);
      } else if (substance.acidBaseModel.kind === "strong-hydroxide") {
        protonTransferSources.push({
          kind: "strong-hydroxide",
          sourceComponentId: component.sourceComponentId,
          amountMol: component.amountMol,
          hydroxideStoichiometry:
            substance.acidBaseModel.hydroxideStoichiometry,
        });
      }
    }
  }

  return {
    totalVolumeL,
    familyAmounts: [...familyAmounts.values()] satisfies AggregatedFamilyAmount[],
    fixedIonAmounts: [...fixedIonAmounts.values()] satisfies AggregatedFixedIonAmount[],
    protonTransferSources,
  };
}
