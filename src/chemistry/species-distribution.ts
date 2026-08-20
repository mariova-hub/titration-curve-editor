import type { ChemicalSpecies } from "../domain/chemistry";

export interface SpeciesFraction {
  species: ChemicalSpecies;
  fraction: number;
}

export interface EquilibriumFamilyDefinition {
  species: readonly ChemicalSpecies[];
  kaValues: readonly number[];
}

export function calculateSpeciesFractions(
  family: EquilibriumFamilyDefinition,
  hydrogenConcentrationMolL: number,
): SpeciesFraction[] {
  if (!Number.isFinite(hydrogenConcentrationMolL) || hydrogenConcentrationMolL <= 0) {
    throw new RangeError("[H+] must be a positive finite number.");
  }
  if (family.species.length === 0 || family.kaValues.length !== family.species.length - 1) {
    throw new RangeError("An equilibrium family must contain n species and n - 1 Ka values.");
  }
  if (family.kaValues.some((ka) => !Number.isFinite(ka) || ka <= 0)) {
    throw new RangeError("Every Ka must be a positive finite number.");
  }

  const logH = Math.log(hydrogenConcentrationMolL);
  const logWeights = [0];
  for (const ka of family.kaValues) {
    const previous = logWeights.at(-1);
    if (previous === undefined) {
      throw new Error("Internal species-distribution state is empty.");
    }
    logWeights.push(previous + Math.log(ka) - logH);
  }

  const maximumLogWeight = Math.max(...logWeights);
  const scaledWeights = logWeights.map((weight) => Math.exp(weight - maximumLogWeight));
  const denominator = scaledWeights.reduce((sum, weight) => sum + weight, 0);

  if (!Number.isFinite(denominator) || denominator <= 0) {
    throw new Error("Species fraction normalization failed.");
  }

  return family.species.map((species, index) => {
    const weight = scaledWeights[index];
    if (weight === undefined) {
      throw new Error("Species and weight indexes are inconsistent.");
    }
    return { species, fraction: weight / denominator };
  });
}
