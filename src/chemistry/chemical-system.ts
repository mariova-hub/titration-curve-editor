import type { ChemicalSpecies, Substance } from "../domain/chemistry";
import type { TitrationInput } from "../domain/titration";
import { validateTitrationInput } from "../domain/validation";
import { SUBSTANCES, getSubstanceById } from "./substances";

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
  const validation = validateTitrationInput(input, SUBSTANCES);
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
  addSubstanceComponent(system, analyte, analyteMoles);
  addSubstanceComponent(system, titrant, titrantMoles);
  return system;
}
