import { describe, expect, it } from "vitest";

import {
  calculateEquivalencePoints,
  calculateHalfEquivalencePoints,
  calculatePHAtVolume,
  calculatePHDetailsAtVolume,
} from "../../src/calculation";
import { ACID_DISSOCIATION_CONSTANTS } from "../../src/chemistry/constants";
import { FIXTURES } from "../fixtures/titration-fixtures";

const PH_TOLERANCE_DIGITS = 3;

describe("formal pH regression fixtures A-G", () => {
  it.each(Object.values(FIXTURES))("matches Fixture $id checkpoints to 1e-3 pH", (fixture) => {
    for (const checkpoint of fixture.expectedPH) {
      expect(calculatePHAtVolume(fixture.input, checkpoint.volumeMl)).toBeCloseTo(
        checkpoint.pH,
        PH_TOLERANCE_DIGITS,
      );
    }
  });
});

describe("Fixture A: strong acid / strong base", () => {
  const expected = new Map<number, number>([
    [0, 1],
    [10, 1.4771212547],
    [19, 2.591064607],
    [19.9, 3.600972895],
    [20, 7],
    [20.1, 10.396855627],
    [21, 11.387216143],
    [30, 12.301029996],
  ]);

  it.each([...expected])("returns the analytical pH at %s mL", (volumeMl, expectedPH) => {
    expect(calculatePHAtVolume(FIXTURES.A.input, volumeMl)).toBeCloseTo(expectedPH, PH_TOLERANCE_DIGITS);
  });

  it("has one 20.0 mL equivalence point", () => {
    const points = calculateEquivalencePoints(FIXTURES.A.input);
    expect(points.map(({ volumeMl }) => volumeMl)).toEqual([20]);
    expect(points[0]?.pH).toBeCloseTo(7, 6);
  });
});

describe("Fixtures B and C: weak acid/base", () => {
  it("matches acetic acid's pKa at half equivalence without using that relation in the solver", () => {
    const points = calculateHalfEquivalencePoints(FIXTURES.B.input);
    const pKa = -Math.log10(ACID_DISSOCIATION_CONSTANTS.aceticAcid.value);
    expect(points[0]?.volumeMl).toBe(10);
    expect(points[0]?.pH).toBeCloseTo(pKa, 2);
    expect(calculatePHAtVolume(FIXTURES.B.input, 0)).toBeCloseTo(2.79, 2);
    expect(calculatePHAtVolume(FIXTURES.B.input, 20)).toBeGreaterThan(7);
    expect(calculatePHAtVolume(FIXTURES.B.input, 30)).toBeGreaterThan(10);
  });

  it("matches ammonium's pKa at NH3 half equivalence", () => {
    const points = calculateHalfEquivalencePoints(FIXTURES.C.input);
    const pKa = -Math.log10(ACID_DISSOCIATION_CONSTANTS.ammonium.value);
    expect(points[0]?.volumeMl).toBe(10);
    expect(points[0]?.pH).toBeCloseTo(pKa, 2);
    expect(calculatePHAtVolume(FIXTURES.C.input, 0)).toBeCloseTo(11.18, 2);
    expect(calculatePHAtVolume(FIXTURES.C.input, 20)).toBeLessThan(7);
    expect(calculatePHAtVolume(FIXTURES.C.input, 30)).toBeLessThan(3);
  });
});

describe("Fixtures D-G: polyvalent systems", () => {
  it.each(Object.values(FIXTURES).slice(3))(
    "$id yields every stoichiometric equivalence volume",
    (fixture) => {
      const points = calculateEquivalencePoints(fixture.input);
      expect(points.map(({ volumeMl }) => volumeMl)).toEqual(fixture.equivalenceVolumesMl);
      expect(points.every(({ pH }) => pH !== undefined && Number.isFinite(pH))).toBe(true);
    },
  );

  it("creates two solver-evaluated half-equivalence points for oxalic acid", () => {
    const points = calculateHalfEquivalencePoints(FIXTURES.D.input);
    expect(points.map(({ volumeMl }) => volumeMl)).toEqual([5, 15]);
    expect(points.every(({ pH }) => pH !== undefined && Number.isFinite(pH))).toBe(true);
  });

  it("keeps H2SO4's two stoichiometric stages and finite exact-equivalence pH values", () => {
    const points = calculateEquivalencePoints(FIXTURES.E.input);
    expect(points).toHaveLength(2);
    expect(points[0]?.participatingStepIds).toEqual(["h2so4.step1"]);
    expect(points[1]?.participatingStepIds).toEqual(["h2so4.step1", "h2so4.step2"]);
  });

  it("keeps all three H3PO4 stoichiometric stages", () => {
    expect(calculateEquivalencePoints(FIXTURES.F.input)).toHaveLength(3);
  });

  it("reflects two OH- equivalents per Ca(OH)2 formula unit", () => {
    const point = calculateEquivalencePoints(FIXTURES.G.input)[0];
    expect(point?.stoichiometricEquivalent).toBe(2);
    expect(point?.volumeMl).toBe(20);
    expect(point?.pH).toBeCloseTo(7, 6);
  });
});

describe("numerical invariants", () => {
  it.each([
    [FIXTURES.A.input, 19.9999],
    [FIXTURES.A.input, 20],
    [FIXTURES.A.input, 20.0001],
    [FIXTURES.D.input, 10],
    [FIXTURES.F.input, 30],
  ] as const)("returns finite pH with a small charge residual", (input, volumeMl) => {
    const result = calculatePHDetailsAtVolume(input, volumeMl);
    expect(Number.isFinite(result.pH)).toBe(true);
    expect(Math.abs(result.chargeBalance.residualMolL)).toBeLessThan(1e-9);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid added volume %s", (volumeMl) => {
    expect(() => calculatePHAtVolume(FIXTURES.A.input, volumeMl)).toThrow();
  });

  it("does not clip legitimate calculated values to the display range 0-14", () => {
    const concentratedAcid = {
      ...FIXTURES.A.input,
      analyteConcentrationMolL: 10,
    };
    const concentratedBase = {
      ...FIXTURES.G.input,
      analyteConcentrationMolL: 5,
    };
    expect(calculatePHAtVolume(concentratedAcid, 0)).toBeLessThan(0);
    expect(calculatePHAtVolume(concentratedBase, 0)).toBeGreaterThan(14);
  });
});
