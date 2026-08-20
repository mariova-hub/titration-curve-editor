import { describe, expect, it } from "vitest";

import { calculateTitrationCurve } from "../../src/calculation";
import type { CurvePoint, TitrationResult } from "../../src/domain/titration";
import { FIXTURES } from "../fixtures/titration-fixtures";
import { REVERSE_TITRATION_INPUTS } from "../fixtures/reverse-titration-inputs";

const EXPECTED_AUTO_MAX = {
  A: 30,
  B: 30,
  C: 30,
  D: 25,
  E: 25,
  F: 37.5,
  G: 30,
} as const;

function expectCurveIntegrity(result: TitrationResult, maxVolumeMl: number): void {
  const volumes = result.points.map(({ addedVolumeMl }) => addedVolumeMl);
  expect(volumes[0]).toBe(0);
  expect(volumes.at(-1)).toBe(maxVolumeMl);
  expect(new Set(volumes).size).toBe(volumes.length);
  expect(volumes.every((volume, index) => index === 0 || volume > (volumes[index - 1] ?? volume)))
    .toBe(true);
  expect(result.points.every(({ addedVolumeMl, pH }) =>
    Number.isFinite(addedVolumeMl) && Number.isFinite(pH))).toBe(true);
  for (const point of [...result.equivalencePoints, ...result.characteristicPoints]) {
    if (point.volumeMl <= maxVolumeMl) expect(volumes).toContain(point.volumeMl);
  }
}

function isMonotonic(
  points: readonly CurvePoint[],
  direction: "ascending" | "descending",
): boolean {
  return points.every((point, index) => {
    const previous = points[index - 1];
    if (previous === undefined) return true;
    return direction === "ascending"
      ? point.pH >= previous.pH - 1e-8
      : point.pH <= previous.pH + 1e-8;
  });
}

function countInWindow(points: readonly CurvePoint[], center: number, halfWidth: number): number {
  return points.filter(({ addedVolumeMl }) =>
    addedVolumeMl >= center - halfWidth && addedVolumeMl <= center + halfWidth).length;
}

describe("calculateTitrationCurve fixtures A-G", () => {
  it.each(Object.values(FIXTURES))("generates complete finite CurvePoint data for Fixture $id", (fixture) => {
    const result = calculateTitrationCurve(fixture.input);
    expectCurveIntegrity(result, EXPECTED_AUTO_MAX[fixture.id]);
    expect(result.points.length).toBeLessThan(500);
  });

  it("includes Fixture A anchors, dense equivalence data, and an increasing trend", () => {
    const result = calculateTitrationCurve(FIXTURES.A.input);
    expect(result.points.map(({ addedVolumeMl }) => addedVolumeMl)).toEqual(
      expect.arrayContaining([0, 20, 30]),
    );
    expect(countInWindow(result.points, 20, 0.5)).toBeGreaterThan(30);
    expect(isMonotonic(result.points, "ascending")).toBe(true);
  });

  it("includes weak acid/base half-equivalence anchors", () => {
    for (const fixture of [FIXTURES.B, FIXTURES.C]) {
      const volumes = calculateTitrationCurve(fixture.input).points.map(({ addedVolumeMl }) => addedVolumeMl);
      expect(volumes).toContain(10);
      expect(volumes).toContain(20);
    }
  });

  it("densifies both oxalic-acid equivalence neighborhoods", () => {
    const result = calculateTitrationCurve(FIXTURES.D.input);
    expect(result.points.map(({ addedVolumeMl }) => addedVolumeMl)).toEqual(
      expect.arrayContaining([5, 10, 15, 20]),
    );
    expect(countInWindow(result.points, 10, 0.5)).toBeGreaterThan(30);
    expect(countInWindow(result.points, 20, 0.5)).toBeGreaterThan(30);
  });

  it("densifies both sulfuric-acid equivalence neighborhoods", () => {
    const result = calculateTitrationCurve(FIXTURES.E.input);
    expect(countInWindow(result.points, 10, 0.5)).toBeGreaterThan(30);
    expect(countInWindow(result.points, 20, 0.5)).toBeGreaterThan(30);
  });

  it("densifies all phosphoric-acid equivalence neighborhoods and extends after the third", () => {
    const result = calculateTitrationCurve(FIXTURES.F.input);
    for (const target of [10, 20, 30]) {
      expect(countInWindow(result.points, target, 0.5)).toBeGreaterThan(30);
    }
    expect(result.points.at(-1)?.addedVolumeMl).toBeGreaterThan(30);
    expect(result.characteristicPoints.map(({ volumeMl }) => volumeMl)).toEqual([5, 15, 25]);
  });

  it("generates a descending Ca(OH)2 + HCl curve", () => {
    expect(isMonotonic(calculateTitrationCurve(FIXTURES.G.input).points, "descending")).toBe(true);
  });
});

describe("curve generation range, reverse direction, and determinism", () => {
  it("retains all metadata when custom max precedes later equivalence points", () => {
    const result = calculateTitrationCurve(FIXTURES.F.input, { maxVolumeMl: 12 });
    expectCurveIntegrity(result, 12);
    expect(result.equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual([10, 20, 30]);
    expect(result.characteristicPoints.map(({ volumeMl }) => volumeMl)).toEqual([5, 15, 25]);
    expect(result.points.map(({ addedVolumeMl }) => addedVolumeMl)).not.toContain(20);
  });

  it.each(REVERSE_TITRATION_INPUTS)(
    "generates finite reverse curve $analyteSubstanceId + $titrantSubstanceId",
    (input) => {
      const result = calculateTitrationCurve(input);
      const maxVolumeMl = result.points.at(-1)?.addedVolumeMl;
      if (maxVolumeMl === undefined) throw new Error("Missing curve endpoint");
      expectCurveIntegrity(result, maxVolumeMl);
      for (const point of result.equivalencePoints) {
        if (point.volumeMl <= maxVolumeMl) {
          expect(result.points.map(({ addedVolumeMl }) => addedVolumeMl)).toContain(point.volumeMl);
        }
      }
    },
  );

  it("produces a descending NaOH + HCl reverse curve", () => {
    expect(isMonotonic(calculateTitrationCurve(REVERSE_TITRATION_INPUTS[0]!).points, "descending"))
      .toBe(true);
  });

  it("is deterministic and bounded for Fixture F", () => {
    const first = calculateTitrationCurve(FIXTURES.F.input);
    const second = calculateTitrationCurve(FIXTURES.F.input);
    expect(second).toEqual(first);
    expect(first.points.length).toBeLessThanOrEqual(350);
  });
});
