import type { ChemicalSpecies, Substance } from "../domain/chemistry";
import type { CompiledSolutionComposition, QuantifiedSolutionComponent } from "../domain/solution-composition";
import type { TitrationInput } from "../domain/titration";
import type { NormalizedSolutionTitrationInput } from "./solution-titration-input";
import type {
  SubstancePairValidator,
  ValidationResult,
} from "../domain/validation";
import { validateTitrationInput } from "../domain/validation";
import { compileSolutionComposition } from "./composition-compiler";
import { getFixedIonById } from "./fixed-ions";
import { resolveSubstanceProtonTransferPairing } from "./proton-transfer";
import {
  SUBSTANCES,
  getAcidBaseFamilyById,
  getSubstanceById,
} from "./substances";

export interface FixedIonConcentration {
  species: ChemicalSpecies;
  concentrationMolL: number;
  sourceSubstanceId: string;
}

export interface AnalyticalFamily {
  sourceSubstanceId: string;
  concentrationMolL: number;
  species: readonly ChemicalSpecies[];
  kaValues: readonly number[];
}

export interface AnalyticalSystem {
  analyteMoles: number;
  titrantMoles: number;
  totalVolumeL: number;
  families: AnalyticalFamily[];
  fixedIons: FixedIonConcentration[];
}

export interface CompiledAnalyticalEntries {
  families: AnalyticalFamily[];
  fixedIons: FixedIonConcentration[];
}

function sourceLabel(
  contributions: readonly { sourceComponentId: string }[],
): string {
  return [...new Set(contributions.map(({ sourceComponentId }) => sourceComponentId))]
    .join("+");
}

export function buildCompiledAnalyticalEntries(
  composition: CompiledSolutionComposition,
): CompiledAnalyticalEntries {
  const families = composition.familyAmounts.map((familyAmount) => {
    const family = getAcidBaseFamilyById(familyAmount.familyId);
    if (family === undefined) {
      throw new Error(`Unknown acid-base family ${familyAmount.familyId}.`);
    }
    const kaValues = family.dissociationSteps.map((step) => {
      if (step.mode !== "equilibrium" || step.ka.status !== "confirmed") {
        throw new Error(
          `Family ${familyAmount.familyId} is not a fully confirmed equilibrium family.`,
        );
      }
      return step.ka.value;
    });
    return {
      sourceSubstanceId: sourceLabel(familyAmount.contributions),
      concentrationMolL:
        familyAmount.totalAmountMol / composition.totalVolumeL,
      species: family.species,
      kaValues,
    } satisfies AnalyticalFamily;
  });

  const fixedIons = composition.fixedIonAmounts.map((fixedIonAmount) => {
    const fixedIon = getFixedIonById(fixedIonAmount.speciesId);
    if (fixedIon === undefined) {
      throw new Error(`Unknown fixed ion ${fixedIonAmount.speciesId}.`);
    }
    return {
      species: fixedIon,
      concentrationMolL:
        fixedIonAmount.totalAmountMol / composition.totalVolumeL,
      sourceSubstanceId: sourceLabel(fixedIonAmount.contributions),
    } satisfies FixedIonConcentration;
  });

  return { families, fixedIons };
}

const validateDerivedPair: SubstancePairValidator = (analyte, titrant) => {
  const pairing = resolveSubstanceProtonTransferPairing(analyte, titrant);
  return pairing.status === "supported" ? undefined : pairing.code;
};

export function validateAnalyticalSystemInput(
  input: TitrationInput,
): ValidationResult {
  const analyte = getSubstanceById(input.analyteSubstanceId);
  const titrant = getSubstanceById(input.titrantSubstanceId);
  const compositionAware =
    analyte?.dissolvedComposition !== undefined ||
    titrant?.dissolvedComposition !== undefined;
  return validateTitrationInput(
    input,
    SUBSTANCES,
    compositionAware ? validateDerivedPair : undefined,
  );
}

function addSubstanceComponent(
  system: AnalyticalSystem,
  substance: Substance,
  moles: number,
): void {
  if (moles === 0) return;
  const model = substance.acidBaseModel;

  if (model.kind === "strong-hydroxide") {
    for (const ion of model.completeIons) {
      if (ion.kind === "fixed") {
        system.fixedIons.push({
          species: ion.species,
          concentrationMolL: (moles * ion.coefficientPerFormulaUnit) / system.totalVolumeL,
          sourceSubstanceId: substance.id,
        });
      }
    }
    return;
  }

  const { family } = model;
  let completePrefixLength = 0;
  while (family.dissociationSteps[completePrefixLength]?.mode === "complete") {
    completePrefixLength += 1;
  }

  const activeSpecies = family.species.slice(completePrefixLength);
  const equilibriumSteps = family.dissociationSteps.slice(completePrefixLength);
  if (equilibriumSteps.length === 0) {
    const fixedSpecies = activeSpecies[0];
    if (fixedSpecies === undefined) {
      throw new Error(`No post-dissociation species for ${substance.id}.`);
    }
    system.fixedIons.push({
      species: fixedSpecies,
      concentrationMolL: moles / system.totalVolumeL,
      sourceSubstanceId: substance.id,
    });
    return;
  }

  const kaValues = equilibriumSteps.map((step) => {
    if (step.mode !== "equilibrium" || step.ka.status !== "confirmed") {
      throw new Error(`Unconfirmed equilibrium step in ${substance.id}.`);
    }
    return step.ka.value;
  });
  system.families.push({
    sourceSubstanceId: substance.id,
    concentrationMolL: moles / system.totalVolumeL,
    species: activeSpecies,
    kaValues,
  });
}

export function buildAnalyticalSystem(
  input: TitrationInput,
  addedVolumeMl: number,
): AnalyticalSystem {
  if (!Number.isFinite(addedVolumeMl) || addedVolumeMl < 0) {
    throw new RangeError("Added volume must be a non-negative finite number.");
  }
  const validation = validateAnalyticalSystemInput(input);
  if (!validation.valid) {
    throw new RangeError(validation.errors.map((error) => error.message).join(" "));
  }

  const analyte = getSubstanceById(input.analyteSubstanceId);
  const titrant = getSubstanceById(input.titrantSubstanceId);
  if (analyte === undefined || titrant === undefined) {
    throw new Error("Validated substances could not be loaded.");
  }

  const analyteMoles = input.analyteConcentrationMolL * input.analyteVolumeMl / 1000;
  const titrantMoles = input.titrantConcentrationMolL * addedVolumeMl / 1000;
  const totalVolumeL = (input.analyteVolumeMl + addedVolumeMl) / 1000;
  const system: AnalyticalSystem = {
    analyteMoles,
    titrantMoles,
    totalVolumeL,
    families: [],
    fixedIons: [],
  };

  const quantifiedCompositionComponents: QuantifiedSolutionComponent[] = [];
  if (analyte.dissolvedComposition === undefined) {
    addSubstanceComponent(system, analyte, analyteMoles);
  } else {
    quantifiedCompositionComponents.push({
      sourceComponentId: "analyte",
      substanceId: analyte.id,
      amountMol: analyteMoles,
    });
  }
  if (titrant.dissolvedComposition === undefined) {
    addSubstanceComponent(system, titrant, titrantMoles);
  } else {
    quantifiedCompositionComponents.push({
      sourceComponentId: "titrant",
      substanceId: titrant.id,
      amountMol: titrantMoles,
    });
  }

  if (quantifiedCompositionComponents.length > 0) {
    const compiled = compileSolutionComposition(
      quantifiedCompositionComponents,
      totalVolumeL,
    );
    const entries = buildCompiledAnalyticalEntries(compiled);
    system.families.push(...entries.families);
    system.fixedIons.push(...entries.fixedIons);
  }
  return system;
}

/**
 * Projects conserved mixed-analyte amounts and the current titrant amount into
 * the existing equilibrium-system representation. Stoichiometric capacity
 * sources are intentionally not equilibrium species.
 */
export function buildSolutionAnalyticalSystem(
  input: NormalizedSolutionTitrationInput,
  compiledAnalyte: CompiledSolutionComposition,
  addedVolumeMl: number,
): AnalyticalSystem {
  if (!Number.isFinite(addedVolumeMl) || addedVolumeMl < 0) {
    throw new RangeError("Added volume must be a non-negative finite number.");
  }

  const titrantMoles =
    input.titrant.concentrationMolL * addedVolumeMl / 1000;
  const totalVolumeL =
    input.analyteSolutionVolumeL + addedVolumeMl / 1000;
  if (!Number.isFinite(totalVolumeL) || totalVolumeL <= 0) {
    throw new RangeError("Current total volume must be a positive finite number.");
  }

  const system: AnalyticalSystem = {
    analyteMoles: input.components.reduce(
      (total, component) => total + component.amountMol,
      0,
    ),
    titrantMoles,
    totalVolumeL,
    families: [],
    fixedIons: [],
  };

  const analyteEntries = buildCompiledAnalyticalEntries({
    ...compiledAnalyte,
    totalVolumeL,
  });
  system.families.push(...analyteEntries.families);
  system.fixedIons.push(...analyteEntries.fixedIons);

  if (input.titrant.substance.dissolvedComposition === undefined) {
    addSubstanceComponent(system, input.titrant.substance, titrantMoles);
  } else if (titrantMoles > 0) {
    const compiledTitrant = compileSolutionComposition(
      [
        {
          sourceComponentId: "titrant",
          substanceId: input.titrant.substanceId,
          amountMol: titrantMoles,
        },
      ],
      totalVolumeL,
    );
    const titrantEntries = buildCompiledAnalyticalEntries(compiledTitrant);
    system.families.push(...titrantEntries.families);
    system.fixedIons.push(...titrantEntries.fixedIons);
  }

  return system;
}
