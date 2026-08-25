import { describe, expect, it } from "vitest";

import { calculateTitrationCurve } from "../../src/calculation";
import type { CurvePoint, TitrationResult } from "../../src/domain/titration";
import {
  V11_CONTRACT_FIXTURES,
  V11_PH_TOLERANCE_DIGITS,
} from "../fixtures/titration-fixtures";

function volumes(result: TitrationResult): number[] {
  return result.points.map(({ addedVolumeMl }) => addedVolumeMl);
}

function countExact(points: readonly CurvePoint[], volumeMl: number): number {
  return points.filter(({ addedVolumeMl }) => addedVolumeMl === volumeMl).length;
}

function countInWindow(
  points: readonly CurvePoint[],
  centerMl: number,
  halfWidthMl: number,
): number {
  return points.filter(
    ({ addedVolumeMl }) =>
      addedVolumeMl >= centerMl - halfWidthMl &&
      addedVolumeMl <= centerMl + halfWidthMl,
  ).length;
}

function expectCurveIntegrity(result: TitrationResult): void {
  const sampledVolumes = volumes(result);
  expect(
    result.points.every(
      ({ addedVolumeMl, pH }) =>
        Number.isFinite(addedVolumeMl) && Number.isFinite(pH),
    ),
  ).toBe(true);
  expect(new Set(sampledVolumes).size).toBe(sampledVolumes.length);
  expect(
    sampledVolumes.every(
      (volumeMl, index) =>
        index === 0 || volumeMl > sampledVolumes[index - 1]!,
    ),
  ).toBe(true);
}

function expectAnchorPH(
  result: TitrationResult,
  expected: readonly { volumeMl: number; pH: number }[],
): void {
  for (const { volumeMl, pH } of expected) {
    const point = result.points.find(
      ({ addedVolumeMl }) => addedVolumeMl === volumeMl,
    );
    expect(point).toBeDefined();
    expect(point?.pH).toBeCloseTo(pH, V11_PH_TOLERANCE_DIGITS);
  }
}

describe("Fixture H adaptive sampling", () => {
  const fixture = V11_CONTRACT_FIXTURES.H;
  const result = calculateTitrationCurve(fixture.input);

  it("derives characteristic volumes from consecutive boundary intervals", () => {
    expect(result.equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual([
      10,
      20,
    ]);
    expect(result.characteristicPoints.map(({ volumeMl }) => volumeMl)).toEqual([
      5,
      15,
    ]);
  });

  it("retains every exact anchor exactly once without duplicate volumes", () => {
    expectCurveIntegrity(result);
    for (const anchor of fixture.exactAnchorVolumesMl) {
      expect(countExact(result.points, anchor)).toBe(1);
    }
  });

  it("independently refines both equivalence neighborhoods", () => {
    const baseRegionCount = countInWindow(result.points, 2.5, 0.5);
    expect(countInWindow(result.points, 10, 0.5)).toBeGreaterThan(30);
    expect(countInWindow(result.points, 20, 0.5)).toBeGreaterThan(30);
    expect(countInWindow(result.points, 10, 0.5)).toBeGreaterThan(
      baseRegionCount * 5,
    );
    expect(countInWindow(result.points, 20, 0.5)).toBeGreaterThan(
      baseRegionCount * 5,
    );
  });

  it("uses solver-evaluated anchor pH and extends past the final equivalence", () => {
    expectAnchorPH(
      result,
      fixture.expectedPH.filter(({ volumeMl }) => volumeMl > 0),
    );
    expect(result.points.at(-1)?.addedVolumeMl).toBe(25);
    expect(result.points.at(-1)?.addedVolumeMl).toBeGreaterThan(20);
  });

  it("keeps the finite curve descending within the existing numerical tolerance", () => {
    expectCurveIntegrity(result);
    expect(
      result.points.every((point, index) => {
        const previous = result.points[index - 1];
        return previous === undefined || point.pH <= previous.pH + 1e-8;
      }),
    ).toBe(true);
  });
});

describe("Fixture I/J adaptive sampling", () => {
  it.each([
    ["I", "descending"],
    ["J", "ascending"],
  ] as const)(
    "keeps Fixture %s anchors, refinement, finite values, and %s direction",
    (fixtureId, direction) => {
      const fixture = V11_CONTRACT_FIXTURES[fixtureId];
      const result = calculateTitrationCurve(fixture.input);

      expectCurveIntegrity(result);
      expect(result.characteristicPoints.map(({ volumeMl }) => volumeMl)).toEqual([
        5,
      ]);
      expect(result.equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual([
        10,
      ]);
      for (const anchor of fixture.exactAnchorVolumesMl) {
        expect(countExact(result.points, anchor)).toBe(1);
      }
      expect(countInWindow(result.points, 10, 0.5)).toBeGreaterThan(30);
      expectAnchorPH(
        result,
        fixture.expectedPH.filter(({ volumeMl }) => volumeMl > 0),
      );
      expect(result.points.at(-1)?.addedVolumeMl).toBe(15);
      expect(
        result.points.every((point, index) => {
          const previous = result.points[index - 1];
          if (previous === undefined) return true;
          return direction === "ascending"
            ? point.pH >= previous.pH - 1e-8
            : point.pH <= previous.pH + 1e-8;
        }),
      ).toBe(true);
    },
  );
});
