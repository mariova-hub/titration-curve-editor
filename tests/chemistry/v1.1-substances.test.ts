import { describe, expect, it } from "vitest";

import { ACID_DISSOCIATION_CONSTANTS } from "../../src/chemistry/constants";
import { SODIUM_FIXED_ION_ID } from "../../src/chemistry/fixed-ions";
import {
  CARBONATE_FAMILY,
  CARBONATE_FAMILY_ID,
  getSubstanceById,
  SUBSTANCES,
} from "../../src/chemistry/substances";
import type { Substance } from "../../src/domain/chemistry";
import { V11_CONTRACT_FIXTURES } from "../fixtures/titration-fixtures";

function requireSubstance(id: string): Substance {
  const substance = getSubstanceById(id);
  if (substance === undefined) throw new Error(`Missing substance: ${id}`);
  return substance;
}

describe("v1.1 salt substance master", () => {
  it("registers Na2CO3 and NaHCO3 exactly once in a fourteen-substance master", () => {
    expect(SUBSTANCES).toHaveLength(14);
    expect(SUBSTANCES.filter(({ id }) => id === "na2co3")).toHaveLength(1);
    expect(SUBSTANCES.filter(({ id }) => id === "nahco3")).toHaveLength(1);
    expect(new Set(SUBSTANCES.map(({ id }) => id)).size).toBe(SUBSTANCES.length);
  });

  it("defines Na2CO3 with carbonate and two canonical sodium ions", () => {
    const substance = requireSubstance("na2co3");

    expect(substance).toMatchObject({
      id: "na2co3",
      displayNameJa: "炭酸ナトリウム",
      formula: "Na2CO3",
      roles: ["base"],
      selectionCategory: "salt-or-amphiprotic",
      dissolvedComposition: {
        familyComponents: [
          {
            familyId: "carbonate",
            initialSpeciesId: "h2co3.co3",
            stoichiometryPerFormulaUnit: 1,
          },
        ],
        fixedIons: [
          {
            speciesId: "ion.na",
            stoichiometryPerFormulaUnit: 2,
          },
        ],
      },
    });
  });

  it("defines NaHCO3 with carbonate and one canonical sodium ion", () => {
    const substance = requireSubstance("nahco3");

    expect(substance).toMatchObject({
      id: "nahco3",
      displayNameJa: "炭酸水素ナトリウム",
      formula: "NaHCO3",
      roles: ["acid", "base"],
      selectionCategory: "salt-or-amphiprotic",
      dissolvedComposition: {
        familyComponents: [
          {
            familyId: "carbonate",
            initialSpeciesId: "h2co3.hco3",
            stoichiometryPerFormulaUnit: 1,
          },
        ],
        fixedIons: [
          {
            speciesId: "ion.na",
            stoichiometryPerFormulaUnit: 1,
          },
        ],
      },
    });
  });

  it("reuses one carbonate family, its species, steps, and Ka references", () => {
    const substances = ["h2co3", "na2co3", "nahco3"].map(requireSubstance);

    for (const substance of substances) {
      expect(substance.acidBaseModel.kind).toBe("protonation-family");
      if (substance.acidBaseModel.kind === "protonation-family") {
        expect(substance.acidBaseModel.family).toBe(CARBONATE_FAMILY);
      }
    }
    expect(CARBONATE_FAMILY.id).toBe(CARBONATE_FAMILY_ID);
    expect(CARBONATE_FAMILY.species.map(({ id }) => id)).toEqual([
      "h2co3.h2co3",
      "h2co3.hco3",
      "h2co3.co3",
    ]);
    expect(CARBONATE_FAMILY.dissociationSteps.map(({ id }) => id)).toEqual([
      "h2co3.step1",
      "h2co3.step2",
    ]);
    const [firstStep, secondStep] = CARBONATE_FAMILY.dissociationSteps;
    if (firstStep?.mode !== "equilibrium" || secondStep?.mode !== "equilibrium") {
      throw new Error("Expected two carbonate equilibrium steps.");
    }
    expect(firstStep.ka).toBe(ACID_DISSOCIATION_CONSTANTS.carbonicAcid1);
    expect(secondStep.ka).toBe(ACID_DISSOCIATION_CONSTANTS.carbonicAcid2);
  });

  it("uses only the canonical sodium id with the required coefficients", () => {
    const sodiumCarbonate = requireSubstance("na2co3").dissolvedComposition;
    const sodiumHydrogenCarbonate = requireSubstance("nahco3").dissolvedComposition;

    expect(sodiumCarbonate?.fixedIons).toEqual([
      { speciesId: SODIUM_FIXED_ION_ID, stoichiometryPerFormulaUnit: 2 },
    ]);
    expect(sodiumHydrogenCarbonate?.fixedIons).toEqual([
      { speciesId: SODIUM_FIXED_ION_ID, stoichiometryPerFormulaUnit: 1 },
    ]);
    const speciesIds = SUBSTANCES.flatMap((substance) =>
      substance.acidBaseModel.kind === "protonation-family"
        ? substance.acidBaseModel.family.species.map(({ id }) => id)
        : [],
    );
    expect(speciesIds).not.toContain("na2co3.na");
    expect(speciesIds).not.toContain("nahco3.na");
  });

  it("leaves the existing twelve substances composition-unmigrated", () => {
    const legacyIds = [
      "hcl",
      "hno3",
      "h2so4",
      "ch3cooh",
      "h2c2o4",
      "h2co3",
      "h3po4",
      "naoh",
      "koh",
      "caoh2",
      "baoh2",
      "nh3",
    ];

    for (const id of legacyIds) {
      const substance = requireSubstance(id);
      expect(substance.dissolvedComposition).toBeUndefined();
      expect(substance.selectionCategory).toBeUndefined();
    }
  });

  it("matches every Phase 1 H-J substance id to the production master", () => {
    for (const fixture of Object.values(V11_CONTRACT_FIXTURES)) {
      expect(getSubstanceById(fixture.input.analyteSubstanceId)).toBeDefined();
      expect(getSubstanceById(fixture.input.titrantSubstanceId)).toBeDefined();
    }
    expect(V11_CONTRACT_FIXTURES.H.input.analyteSubstanceId).toBe("na2co3");
    expect(V11_CONTRACT_FIXTURES.I.input.analyteSubstanceId).toBe("nahco3");
    expect(V11_CONTRACT_FIXTURES.J.input.analyteSubstanceId).toBe("nahco3");
  });
});
