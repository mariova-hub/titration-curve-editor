import type { Substance } from "../domain/chemistry";
import { getFixedIonById } from "./fixed-ions";

export interface MasterIntegrityError {
  substanceId: string;
  message: string;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validateDissolvedComposition(
  substance: Substance,
  errors: MasterIntegrityError[],
): void {
  const composition = substance.dissolvedComposition;
  if (composition === undefined) return;

  const family = substance.acidBaseModel.kind === "protonation-family"
    ? substance.acidBaseModel.family
    : undefined;
  let formulaUnitCharge = 0;

  for (const component of composition.familyComponents) {
    if (!isPositiveFinite(component.stoichiometryPerFormulaUnit)) {
      errors.push({
        substanceId: substance.id,
        message: `Invalid family coefficient: ${component.familyId}.`,
      });
    }
    if (family?.id !== component.familyId) {
      errors.push({
        substanceId: substance.id,
        message: `Unknown family reference: ${component.familyId}.`,
      });
      continue;
    }
    const initialSpecies = family.species.find(
      ({ id }) => id === component.initialSpeciesId,
    );
    if (initialSpecies === undefined) {
      errors.push({
        substanceId: substance.id,
        message: `Initial species is not in family ${component.familyId}: ${component.initialSpeciesId}.`,
      });
      continue;
    }
    formulaUnitCharge += initialSpecies.charge * component.stoichiometryPerFormulaUnit;
  }

  for (const component of composition.fixedIons) {
    if (!isPositiveFinite(component.stoichiometryPerFormulaUnit)) {
      errors.push({
        substanceId: substance.id,
        message: `Invalid fixed-ion coefficient: ${component.speciesId}.`,
      });
    }
    const fixedIon = getFixedIonById(component.speciesId);
    if (fixedIon === undefined) {
      errors.push({
        substanceId: substance.id,
        message: `Unknown fixed-ion reference: ${component.speciesId}.`,
      });
      continue;
    }
    formulaUnitCharge += fixedIon.charge * component.stoichiometryPerFormulaUnit;
  }

  if (Math.abs(formulaUnitCharge) > 1e-12) {
    errors.push({
      substanceId: substance.id,
      message: "Dissolved composition is not charge neutral per formula unit.",
    });
  }
}

export function validateSubstanceMaster(
  substances: readonly Substance[],
): MasterIntegrityError[] {
  const errors: MasterIntegrityError[] = [];
  const substanceIds = new Set<string>();

  for (const substance of substances) {
    if (substanceIds.has(substance.id)) {
      errors.push({ substanceId: substance.id, message: "Duplicate substance id." });
    }
    substanceIds.add(substance.id);

    if (substance.provenance.status !== "reviewed") {
      errors.push({ substanceId: substance.id, message: "Substance provenance is not reviewed." });
    }

    validateDissolvedComposition(substance, errors);

    const model = substance.acidBaseModel;
    if (model.kind === "strong-hydroxide") {
      if (!Number.isInteger(model.hydroxideStoichiometry) || model.hydroxideStoichiometry <= 0) {
        errors.push({ substanceId: substance.id, message: "Invalid hydroxide stoichiometry." });
      }
      const hydroxideCoefficient = model.completeIons
        .filter((ion) => ion.kind === "hydroxide")
        .reduce((sum, ion) => sum + ion.coefficientPerFormulaUnit, 0);
      if (hydroxideCoefficient !== model.hydroxideStoichiometry) {
        errors.push({ substanceId: substance.id, message: "Hydroxide coefficient is inconsistent." });
      }
      const netCharge = model.completeIons.reduce(
        (sum, ion) => sum + ion.species.charge * ion.coefficientPerFormulaUnit,
        0,
      );
      if (netCharge !== 0) {
        errors.push({ substanceId: substance.id, message: "Complete ions are not charge neutral." });
      }
      continue;
    }

    const { family } = model;
    if (family.protonCount <= 0 || family.species.length !== family.protonCount + 1) {
      errors.push({ substanceId: substance.id, message: "Proton count and species count are inconsistent." });
    }
    if (family.dissociationSteps.length !== family.protonCount) {
      errors.push({ substanceId: substance.id, message: "Proton count and step count are inconsistent." });
    }

    const speciesIds = new Set<string>();
    for (const species of family.species) {
      if (speciesIds.has(species.id)) {
        errors.push({ substanceId: substance.id, message: `Duplicate species id: ${species.id}.` });
      }
      speciesIds.add(species.id);
    }

    let equilibriumSeen = false;
    family.dissociationSteps.forEach((step, index) => {
      const acid = family.species[index];
      const base = family.species[index + 1];
      if (
        acid === undefined ||
        base === undefined ||
        step.order !== index + 1 ||
        step.acidSpeciesId !== acid.id ||
        step.conjugateBaseSpeciesId !== base.id
      ) {
        errors.push({ substanceId: substance.id, message: `Invalid step sequence: ${step.id}.` });
      } else if (
        acid.boundProtonCount - base.boundProtonCount !== 1 ||
        base.charge - acid.charge !== -1
      ) {
        errors.push({ substanceId: substance.id, message: `Invalid proton/charge transition: ${step.id}.` });
      }

      if (step.mode === "complete") {
        if (equilibriumSeen) {
          errors.push({ substanceId: substance.id, message: "Complete steps must form a leading prefix." });
        }
      } else {
        equilibriumSeen = true;
        if (
          step.ka.status !== "confirmed" ||
          !Number.isFinite(step.ka.value) ||
          step.ka.value <= 0 ||
          step.ka.temperatureC !== 25 ||
          step.ka.source.id.length === 0 ||
          step.ka.source.url.length === 0
        ) {
          errors.push({ substanceId: substance.id, message: `Invalid equilibrium constant: ${step.id}.` });
        }
      }
    });
  }

  return errors;
}
