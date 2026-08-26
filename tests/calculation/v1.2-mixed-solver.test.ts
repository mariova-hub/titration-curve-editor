import { describe, expect, it } from "vitest";

import {
  calculatePHAtVolume,
  calculatePHDetailsAtVolume,
  calculateTitrationCurve,
} from "../../src/calculation";
import {
  buildSolutionAnalyticalSystem,
  compileNormalizedAnalyteComposition,
  normalizeSolutionTitrationInput,
} from "../../src/chemistry";
import type { TitrationInput } from "../../src/domain/titration";
import {
  V12_CONTRACT_FIXTURES,
  V12_PH_TOLERANCE_DIGITS,
} from "../fixtures/titration-fixtures";

const fixture = V12_CONTRACT_FIXTURES.K;

function fixtureKSystem(addedVolumeMl: number) {
  const normalized = normalizeSolutionTitrationInput(fixture.input);
  const compiled = compileNormalizedAnalyteComposition(normalized);
  return buildSolutionAnalyticalSystem(normalized, compiled, addedVolumeMl);
}

describe("v1.2 Fixture K mixed analytical system", () => {
  it("preserves carbonate and canonical sodium amounts at the initial point", () => {
    const system = fixtureKSystem(0);
    const carbonate = system.families.find(
      ({ species }) => species.some(({ id }) => id === "h2co3.co3"),
    );
    const sodium = system.fixedIons.find(
      ({ species }) => species.id === "ion.na",
    );

    expect(system.totalVolumeL).toBe(0.02);
    expect(carbonate).toBeDefined();
    expect(sodium).toBeDefined();
    expect(carbonate!.concentrationMolL * system.totalVolumeL).toBeCloseTo(
      0.001,
      15,
    );
    expect(sodium!.concentrationMolL * system.totalVolumeL).toBeCloseTo(
      0.0025,
      15,
    );
    expect(system.fixedIons.map(({ species }) => species.id)).not.toContain(
      "naoh.cation",
    );
  });

  it("dilutes conserved analyte amounts with the current total volume", () => {
    const initial = fixtureKSystem(0);
    const afterTwentyMl = fixtureKSystem(20);

    expect(afterTwentyMl.totalVolumeL).toBeCloseTo(0.04, 15);
    expect(initial.families[0]?.concentrationMolL).toBeCloseTo(0.05, 14);
    expect(afterTwentyMl.families[0]?.concentrationMolL).toBeCloseTo(
      0.025,
      14,
    );
    expect(
      initial.fixedIons.find(({ species }) => species.id === "ion.na")
        ?.concentrationMolL,
    ).toBeCloseTo(0.125, 14);
    expect(
      afterTwentyMl.fixedIons.find(({ species }) => species.id === "ion.na")
        ?.concentrationMolL,
    ).toBeCloseTo(0.0625, 14);
  });

  it("adds titrant chloride by amount without adding fixed hydrogen", () => {
    const addedVolumeMl = 7.5;
    const system = fixtureKSystem(addedVolumeMl);
    const chloride = system.fixedIons.find(
      ({ species }) => species.id === "hcl.cl",
    );

    expect(chloride?.concentrationMolL).toBeCloseTo(
      0.1 * addedVolumeMl / 1000 / system.totalVolumeL,
      14,
    );
    expect(system.fixedIons.map(({ species }) => species.id)).not.toContain(
      "hcl.hcl",
    );
  });

  it("does not add hydroxide or duplicate sodium as spectator ions", () => {
    const details = calculatePHDetailsAtVolume(fixture.input, 15);
    const fixedSpeciesIds = details.system.fixedIons.map(
      ({ species }) => species.id,
    );

    expect(fixedSpeciesIds.filter((id) => id === "ion.na")).toHaveLength(1);
    expect(fixedSpeciesIds).not.toContain("naoh.cation");
    expect(fixedSpeciesIds).not.toContain("naoh.oh");
    expect(details.system.fixedIons.map(({ species }) => species.formula))
      .not.toContain("OH-");
    expect(details.chargeBalance.hydroxideConcentrationMolL).toBeGreaterThan(0);
  });
});

describe("v1.2 Fixture K production equilibrium anchors", () => {
  it("matches all independent golden pH anchors and keeps them finite", () => {
    for (const anchor of fixture.expectedPH) {
      const actualPH = calculatePHAtVolume(fixture.input, anchor.volumeMl);
      expect(Number.isFinite(actualPH)).toBe(true);
      expect(actualPH).toBeCloseTo(anchor.pH, V12_PH_TOLERANCE_DIGITS);
    }
  });

  it("is strictly descending across the five frozen anchors", () => {
    const pHValues = fixture.expectedPH.map(({ volumeMl }) =>
      calculatePHAtVolume(fixture.input, volumeMl)
    );

    expect(
      pHValues.slice(1).every((pH, index) => pH < pHValues[index]!),
    ).toBe(true);
  });

  it("projects solver pH onto equivalence and characteristic points", () => {
    const result = calculateTitrationCurve(fixture.input);

    expect(result.equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual([
      15,
      25,
    ]);
    expect(result.characteristicPoints.map(({ volumeMl }) => volumeMl)).toEqual([
      7.5,
      20,
    ]);
    for (const point of [
      ...result.equivalencePoints,
      ...result.characteristicPoints,
    ]) {
      const golden = fixture.expectedPH.find(
        ({ volumeMl }) => volumeMl === point.volumeMl,
      );
      expect(golden).toBeDefined();
      expect(point.pH).toBeCloseTo(golden!.pH, V12_PH_TOLERANCE_DIGITS);
    }
    const sampledVolumes = new Set(
      result.points.map(({ addedVolumeMl }) => addedVolumeMl),
    );
    expect(
      [0, 7.5, 15, 20, 25].every((volumeMl) =>
        sampledVolumes.has(volumeMl)
      ),
    ).toBe(true);
  });

  it("preserves the legacy single-NaOH diagnostic identity", () => {
    const input: TitrationInput = {
      analyteSubstanceId: "naoh",
      analyteConcentrationMolL: 0.1,
      analyteVolumeMl: 20,
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: 0.1,
    };
    const details = calculatePHDetailsAtVolume(input, 5);

    expect(details.system.fixedIons.map(({ species }) => species.id)).toContain(
      "naoh.cation",
    );
    expect(
      details.chargeBalance.speciesConcentrations.map(({ speciesId }) =>
        speciesId
      ),
    ).toContain("naoh.cation");
  });
});
