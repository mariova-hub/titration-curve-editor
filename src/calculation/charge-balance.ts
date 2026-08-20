import { KW_25C } from "../chemistry/constants";
import type { AnalyticalSystem } from "../chemistry/chemical-system";
import { calculateSpeciesFractions } from "../chemistry/species-distribution";

export interface SpeciesConcentration {
  speciesId: string;
  charge: number;
  concentrationMolL: number;
  sourceSubstanceId: string;
}

export interface ChargeBalanceEvaluation {
  hydrogenConcentrationMolL: number;
  hydroxideConcentrationMolL: number;
  residualMolL: number;
  concentrationScaleMolL: number;
  speciesConcentrations: SpeciesConcentration[];
}

export function evaluateChargeBalance(
  system: AnalyticalSystem,
  hydrogenConcentrationMolL: number,
): ChargeBalanceEvaluation {
  if (!Number.isFinite(hydrogenConcentrationMolL) || hydrogenConcentrationMolL <= 0) {
    throw new RangeError("[H+] must be a positive finite number.");
  }

  const hydroxideConcentrationMolL = KW_25C / hydrogenConcentrationMolL;
  let residualMolL = hydrogenConcentrationMolL - hydroxideConcentrationMolL;
  let concentrationScaleMolL = hydrogenConcentrationMolL + hydroxideConcentrationMolL;
  const speciesConcentrations: SpeciesConcentration[] = [];

  for (const ion of system.fixedIons) {
    residualMolL += ion.species.charge * ion.concentrationMolL;
    concentrationScaleMolL += Math.abs(ion.species.charge * ion.concentrationMolL);
    speciesConcentrations.push({
      speciesId: ion.species.id,
      charge: ion.species.charge,
      concentrationMolL: ion.concentrationMolL,
      sourceSubstanceId: ion.sourceSubstanceId,
    });
  }

  for (const family of system.families) {
    const fractions = calculateSpeciesFractions(family, hydrogenConcentrationMolL);
    for (const { species, fraction } of fractions) {
      const concentrationMolL = family.concentrationMolL * fraction;
      residualMolL += species.charge * concentrationMolL;
      concentrationScaleMolL += Math.abs(species.charge * concentrationMolL);
      speciesConcentrations.push({
        speciesId: species.id,
        charge: species.charge,
        concentrationMolL,
        sourceSubstanceId: family.sourceSubstanceId,
      });
    }
  }

  if (
    !Number.isFinite(hydroxideConcentrationMolL) ||
    !Number.isFinite(residualMolL) ||
    !Number.isFinite(concentrationScaleMolL)
  ) {
    throw new Error("Charge-balance evaluation produced a non-finite value.");
  }

  return {
    hydrogenConcentrationMolL,
    hydroxideConcentrationMolL,
    residualMolL,
    concentrationScaleMolL,
    speciesConcentrations,
  };
}
