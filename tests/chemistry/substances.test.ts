import { describe, expect, it } from "vitest";

import { getSubstanceById, SUBSTANCES } from "../../src/chemistry/substances";
import type {
  AcidBaseFamily,
  StrongHydroxideModel,
} from "../../src/domain/chemistry";

function getFamily(substanceId: string): AcidBaseFamily {
  const substance = getSubstanceById(substanceId);

  if (
    substance === undefined ||
    substance.acidBaseModel.kind !== "protonation-family"
  ) {
    throw new Error(`${substanceId} is not a protonation-family substance`);
  }

  return substance.acidBaseModel.family;
}

function getStrongHydroxide(substanceId: string): StrongHydroxideModel {
  const substance = getSubstanceById(substanceId);

  if (
    substance === undefined ||
    substance.acidBaseModel.kind !== "strong-hydroxide"
  ) {
    throw new Error(`${substanceId} is not a strong-hydroxide substance`);
  }

  return substance.acidBaseModel;
}

describe("substance master", () => {
  it("contains the twelve Phase 1 substances", () => {
    expect(SUBSTANCES).toHaveLength(12);
    expect(SUBSTANCES.map(({ formula }) => formula)).toEqual([
      "HCl",
      "HNO3",
      "H2SO4",
      "CH3COOH",
      "H2C2O4",
      "H2CO3",
      "H3PO4",
      "NaOH",
      "KOH",
      "Ca(OH)2",
      "Ba(OH)2",
      "NH3",
    ]);
  });

  it("represents H3PO4 with four protonation species", () => {
    const family = getFamily("h3po4");

    expect(family.protonCount).toBe(3);
    expect(family.species.map(({ formula }) => formula)).toEqual([
      "H3PO4",
      "H2PO4-",
      "HPO4^2-",
      "PO4^3-",
    ]);
    expect(family.species.map(({ charge }) => charge)).toEqual([0, -1, -2, -3]);
    expect(family.dissociationSteps).toHaveLength(3);
  });

  it("represents oxalic acid with three species and two confirmed equilibrium steps", () => {
    const family = getFamily("h2c2o4");

    expect(family.species.map(({ formula }) => formula)).toEqual([
      "H2C2O4",
      "HC2O4-",
      "C2O4^2-",
    ]);
    expect(family.species.map(({ boundProtonCount }) => boundProtonCount)).toEqual([
      2, 1, 0,
    ]);
    expect(family.dissociationSteps).toHaveLength(2);
    expect(family.dissociationSteps.every(({ mode }) => mode === "equilibrium")).toBe(
      true,
    );
    expect(
      family.dissociationSteps.every(
        (step) => step.mode === "equilibrium" && step.ka.status === "confirmed",
      ),
    ).toBe(true);
  });

  it("distinguishes complete and equilibrium dissociation in H2SO4", () => {
    const family = getFamily("h2so4");

    expect(family.dissociationSteps.map(({ mode }) => mode)).toEqual([
      "complete",
      "equilibrium",
    ]);
    expect(family.dissociationSteps[0]?.id).toBe("h2so4.step1");
    expect(family.dissociationSteps[1]?.id).toBe("h2so4.step2");
  });

  it.each([
    ["caoh2", "Ca^2+"],
    ["baoh2", "Ba^2+"],
  ])("represents %s as supplying two hydroxides per formula unit", (id, cation) => {
    const model = getStrongHydroxide(id);

    expect(model.hydroxideStoichiometry).toBe(2);
    expect(model.completeIons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          species: expect.objectContaining({ formula: cation, charge: 2 }),
          coefficientPerFormulaUnit: 1,
        }),
        expect.objectContaining({
          species: expect.objectContaining({ formula: "OH-", charge: -1 }),
          coefficientPerFormulaUnit: 2,
        }),
      ]),
    );
  });

  it("stores reviewed 25 degree constants for every equilibrium step", () => {
    const equilibriumSteps = SUBSTANCES.flatMap((substance) =>
      substance.acidBaseModel.kind === "protonation-family"
        ? substance.acidBaseModel.family.dissociationSteps.filter(
            (step) => step.mode === "equilibrium",
          )
        : [],
    );

    expect(equilibriumSteps.length).toBeGreaterThan(0);
    expect(
      equilibriumSteps.every(
        (step) =>
          step.ka.status === "confirmed" &&
          step.ka.temperatureC === 25 &&
          step.ka.value > 0 &&
          step.ka.source.url.length > 0,
      ),
    ).toBe(true);
  });
});
