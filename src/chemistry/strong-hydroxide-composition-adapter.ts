import type { ChemicalSpecies, Substance } from "../domain/chemistry";
import type {
  DissolvedComposition,
  FixedIonComponent,
  QuantifiedSolutionComponent,
  StrongHydroxideProtonTransferCapacitySource,
} from "../domain/solution-composition";
import {
  findCanonicalFixedIonBySpecies,
  type FixedIon,
} from "./fixed-ions";

export type StrongHydroxideCompositionAdapterErrorCode =
  | "invalid-legacy-complete-ion-metadata"
  | "unregistered-legacy-fixed-ion";

export class StrongHydroxideCompositionAdapterError extends Error {
  constructor(
    public readonly code: StrongHydroxideCompositionAdapterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StrongHydroxideCompositionAdapterError";
  }
}

export interface AdaptedStrongHydroxideComponent {
  dissolvedComposition: DissolvedComposition;
  protonTransferSource: StrongHydroxideProtonTransferCapacitySource;
}

export type CanonicalFixedIonResolver = (
  species: Pick<ChemicalSpecies, "formula" | "charge" | "boundProtonCount">,
) => FixedIon | undefined;

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function metadataError(substance: Substance, detail: string): never {
  throw new StrongHydroxideCompositionAdapterError(
    "invalid-legacy-complete-ion-metadata",
    `Strong-hydroxide metadata for ${substance.id} is invalid: ${detail}.`,
  );
}

/**
 * Adapts a legacy complete-dissociation strong-hydroxide component at the
 * mixed-composition boundary. Hydroxide is represented only as transfer
 * capacity; it is deliberately absent from the fixed-ion composition.
 */
export function adaptStrongHydroxideComposition(
  substance: Substance,
  component: QuantifiedSolutionComponent,
  resolveCanonicalFixedIon: CanonicalFixedIonResolver =
    findCanonicalFixedIonBySpecies,
): AdaptedStrongHydroxideComponent | undefined {
  const model = substance.acidBaseModel;
  if (model.kind !== "strong-hydroxide") return undefined;

  if (!isPositiveFinite(model.hydroxideStoichiometry)) {
    metadataError(substance, "hydroxide stoichiometry must be positive and finite");
  }

  const fixedIonComponents = new Map<string, FixedIonComponent>();
  let hydroxideCoefficient = 0;
  let completeIonCharge = 0;

  for (const ion of model.completeIons) {
    if (!isPositiveFinite(ion.coefficientPerFormulaUnit)) {
      metadataError(substance, "complete-ion coefficients must be positive and finite");
    }

    completeIonCharge +=
      ion.species.charge * ion.coefficientPerFormulaUnit;

    if (ion.kind === "hydroxide") {
      hydroxideCoefficient += ion.coefficientPerFormulaUnit;
      continue;
    }

    const canonicalFixedIon = resolveCanonicalFixedIon(ion.species);
    if (canonicalFixedIon === undefined) {
      throw new StrongHydroxideCompositionAdapterError(
        "unregistered-legacy-fixed-ion",
        `Legacy fixed ion ${ion.species.id} has no canonical registry entry.`,
      );
    }
    if (fixedIonComponents.has(canonicalFixedIon.id)) {
      metadataError(substance, `duplicate canonical fixed ion ${canonicalFixedIon.id}`);
    }
    fixedIonComponents.set(canonicalFixedIon.id, {
      speciesId: canonicalFixedIon.id,
      stoichiometryPerFormulaUnit: ion.coefficientPerFormulaUnit,
    });
  }

  if (fixedIonComponents.size === 0) {
    metadataError(substance, "at least one fixed counter-ion is required");
  }
  if (
    Math.abs(hydroxideCoefficient - model.hydroxideStoichiometry) > 1e-12
  ) {
    metadataError(substance, "hydroxide coefficient is inconsistent");
  }
  if (Math.abs(completeIonCharge) > 1e-12) {
    metadataError(substance, "complete ions are not charge neutral");
  }

  return {
    dissolvedComposition: {
      familyComponents: [],
      fixedIons: [...fixedIonComponents.values()],
    },
    protonTransferSource: {
      kind: "strong-hydroxide",
      sourceComponentId: component.sourceComponentId,
      amountMol: component.amountMol,
      hydroxideStoichiometry: model.hydroxideStoichiometry,
    },
  };
}
