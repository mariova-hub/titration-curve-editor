import { describe, expect, it } from "vitest";

import { calculateSpeciesFractions } from "../../src/chemistry/species-distribution";
import { getSubstanceById } from "../../src/chemistry/substances";

function getEquilibriumFamily(id: string) {
  const substance = getSubstanceById(id);
  if (substance?.acidBaseModel.kind !== "protonation-family") throw new Error(id);
  const steps = substance.acidBaseModel.family.dissociationSteps;
  return {
    species: substance.acidBaseModel.family.species,
    kaValues: steps.map((step) => {
      if (step.mode !== "equilibrium" || step.ka.status !== "confirmed") throw new Error(id);
      return step.ka.value;
    }),
  };
}

describe("generic acid/base species distribution", () => {
  it.each(["ch3cooh", "h2c2o4", "h3po4", "nh3"])(
    "normalizes every fraction for %s",
    (id) => {
      const fractions = calculateSpeciesFractions(getEquilibriumFamily(id), 10 ** -7);
      expect(fractions.reduce((sum, item) => sum + item.fraction, 0)).toBeCloseTo(1, 14);
      expect(fractions.every(({ fraction }) => fraction >= 0 && Number.isFinite(fraction))).toBe(true);
    },
  );

  it("uses one arbitrary-length algorithm for phosphoric acid's four species", () => {
    const fractions = calculateSpeciesFractions(getEquilibriumFamily("h3po4"), 10 ** -7);
    expect(fractions).toHaveLength(4);
  });
});
