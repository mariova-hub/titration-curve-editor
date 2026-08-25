import { describe, expect, it } from "vitest";

import {
  calculateCompositionEquivalencePoints,
  calculateHalfEquivalencePoints,
  calculatePHAtVolume,
  calculatePHDetailsAtVolume,
  calculateTitrationCurve,
} from "../../src/calculation";
import { evaluateChargeBalance } from "../../src/calculation/charge-balance";
import { buildAnalyticalSystem } from "../../src/chemistry/chemical-system";
import {
  V11_CONTRACT_FIXTURES,
  V11_PH_TOLERANCE_DIGITS,
} from "../fixtures/titration-fixtures";

describe("composition-aware analytical system", () => {
  it("adds canonical fixed-ion charge from amount and current total volume", () => {
    const system = buildAnalyticalSystem(V11_CONTRACT_FIXTURES.H.input, 5);
    const sodium = system.fixedIons.find(
      ({ species }) => species.id === "ion.na",
    );

    expect(system.totalVolumeL).toBeCloseTo(0.025, 15);
    expect(system.fixedIons.filter(({ species }) => species.id === "ion.na")).toHaveLength(1);
    expect(sodium).toMatchObject({
      species: { id: "ion.na", charge: 1 },
      concentrationMolL: 0.08,
      sourceSubstanceId: "analyte",
    });

    const evaluation = evaluateChargeBalance(system, 1e-7);
    const sodiumEvaluation = evaluation.speciesConcentrations.find(
      ({ speciesId }) => speciesId === "ion.na",
    );
    expect(sodiumEvaluation).toMatchObject({
      charge: 1,
      concentrationMolL: 0.08,
    });
    expect(
      sodiumEvaluation!.charge * sodiumEvaluation!.concentrationMolL,
    ).toBeCloseTo(0.08, 14);
  });

  it("dilutes family and fixed-ion totals with the current total volume", () => {
    const initial = buildAnalyticalSystem(V11_CONTRACT_FIXTURES.H.input, 0);
    const afterTwentyMl = buildAnalyticalSystem(
      V11_CONTRACT_FIXTURES.H.input,
      20,
    );

    expect(initial.families[0]?.concentrationMolL).toBeCloseTo(0.05, 14);
    expect(afterTwentyMl.families[0]?.concentrationMolL).toBeCloseTo(
      0.025,
      14,
    );
    expect(
      initial.fixedIons.find(({ species }) => species.id === "ion.na")
        ?.concentrationMolL,
    ).toBeCloseTo(0.1, 14);
    expect(
      afterTwentyMl.fixedIons.find(({ species }) => species.id === "ion.na")
        ?.concentrationMolL,
    ).toBeCloseTo(0.05, 14);
  });

  it("distributes the conserved carbonate total instead of fixing the initial species", () => {
    const details = calculatePHDetailsAtVolume(
      V11_CONTRACT_FIXTURES.H.input,
      5,
    );
    const carbonateSpecies = details.chargeBalance.speciesConcentrations.filter(
      ({ speciesId }) => speciesId.startsWith("h2co3."),
    );

    expect(carbonateSpecies).toHaveLength(3);
    expect(
      carbonateSpecies.reduce(
        (total, { concentrationMolL }) => total + concentrationMolL,
        0,
      ),
    ).toBeCloseTo(0.001 / 0.025, 13);
    expect(
      carbonateSpecies.filter(({ concentrationMolL }) => concentrationMolL > 0),
    ).toHaveLength(3);
  });

  it("keeps composition and legacy sodium contributions separate without duplication", () => {
    const system = buildAnalyticalSystem(V11_CONTRACT_FIXTURES.J.input, 5);
    const sodiumEntries = system.fixedIons.filter(
      ({ species }) => species.formula === "Na+",
    );

    expect(sodiumEntries.map(({ species }) => species.id)).toEqual([
      "naoh.cation",
      "ion.na",
    ]);
    expect(
      sodiumEntries.find(({ species }) => species.id === "ion.na")
        ?.concentrationMolL,
    ).toBeCloseTo(0.001 / 0.025, 14);
    expect(
      sodiumEntries.find(({ species }) => species.id === "naoh.cation")
        ?.concentrationMolL,
    ).toBeCloseTo(0.0005 / 0.025, 14);
    expect(
      sodiumEntries.reduce(
        (total, { concentrationMolL }) => total + concentrationMolL,
        0,
      ),
    ).toBeCloseTo(0.0015 / 0.025, 14);
  });
});

describe("Fixture H-J production pH contracts", () => {
  it.each(Object.values(V11_CONTRACT_FIXTURES))(
    "matches Fixture $id independent golden anchors",
    (fixture) => {
      const calculated = fixture.expectedPH.map(({ volumeMl, pH }) => ({
        volumeMl,
        expectedPH: pH,
        actualPH: calculatePHAtVolume(fixture.input, volumeMl),
      }));

      for (const point of calculated) {
        expect(Number.isFinite(point.actualPH)).toBe(true);
        expect(point.actualPH).toBeCloseTo(
          point.expectedPH,
          V11_PH_TOLERANCE_DIGITS,
        );
      }

      const differences = calculated.slice(1).map(
        ({ actualPH }, index) => actualPH - calculated[index]!.actualPH,
      );
      expect(
        differences.every((difference) =>
          fixture.expectedDirection === "ascending"
            ? difference > 0
            : difference < 0
        ),
      ).toBe(true);
    },
  );

  it.each(Object.values(V11_CONTRACT_FIXTURES))(
    "solver-evaluates Fixture $id equivalence and characteristic volumes",
    (fixture) => {
      const equivalencePoints = calculateCompositionEquivalencePoints(
        fixture.input,
      );
      const characteristicPoints = calculateHalfEquivalencePoints(
        fixture.input,
        equivalencePoints,
      );

      expect(equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual(
        fixture.equivalenceVolumesMl,
      );
      expect(characteristicPoints.map(({ volumeMl }) => volumeMl)).toEqual(
        fixture.characteristicVolumesMl,
      );
      expect(
        [...equivalencePoints, ...characteristicPoints].every(
          ({ pH }) => pH !== undefined && Number.isFinite(pH),
        ),
      ).toBe(true);
      for (const point of [...equivalencePoints, ...characteristicPoints]) {
        const golden = fixture.expectedPH.find(
          ({ volumeMl }) => volumeMl === point.volumeMl,
        );
        expect(golden).toBeDefined();
        expect(point.pH).toBeCloseTo(
          golden!.pH,
          V11_PH_TOLERANCE_DIGITS,
        );
      }
    },
  );

  it("dispatches Fixture H through the production curve pipeline", () => {
    const result = calculateTitrationCurve(V11_CONTRACT_FIXTURES.H.input, {
      maxVolumeMl: 20,
      basePointCount: 2,
      equivalencePointCount: 2,
    });

    expect(result.equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual([
      10,
      20,
    ]);
    expect(result.characteristicPoints.map(({ volumeMl }) => volumeMl)).toEqual([
      5,
      15,
    ]);
    expect(result.points.every(({ pH }) => Number.isFinite(pH))).toBe(true);
  });
});
