import type { Substance } from "../domain/chemistry";

export interface MasterIntegrityError {
  substanceId: string;
  message: string;
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
