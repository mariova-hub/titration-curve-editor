import { describe, expect, it } from "vitest";

import { calculateTitrationCurve } from "../../src/calculation";
import type { CurvePoint, TitrationResult } from "../../src/domain/titration";
import {
  V12_CONTRACT_FIXTURES,
  V12_PH_TOLERANCE_DIGITS,
} from "../fixtures/titration-fixtures";

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
  const volumes = result.points.map(({ addedVolumeMl }) => addedVolumeMl);
  expect(result.points.length).toBeGreaterThan(5);
  expect(
    result.points.every(
      ({ addedVolumeMl, pH }) =>
        Number.isFinite(addedVolumeMl) && Number.isFinite(pH),
    ),
  ).toBe(true);
  expect(new Set(volumes).size).toBe(volumes.length);
  expect(
    volumes.every(
      (volumeMl, index) => index === 0 || volumeMl > volumes[index - 1]!,
    ),
  ).toBe(true);
}

describe("Fixture K adaptive sampling", () => {
  const fixture = V12_CONTRACT_FIXTURES.K;
  const result = calculateTitrationCurve(fixture.input);

  it("produces a finite, deduplicated, strictly ascending full curve", () => {
    expectCurveIntegrity(result);
    expect(result.points[0]?.addedVolumeMl).toBe(0);
    expect(result.points.at(-1)?.addedVolumeMl).toBe(
      fixture.expectedAutoRangeMl,
    );
  });

  it("retains every equivalence and characteristic anchor exactly once", () => {
    for (const anchor of fixture.exactAnchorVolumesMl) {
      expect(countExact(result.points, anchor)).toBe(1);
    }
  });

  it("independently refines both equivalence neighborhoods", () => {
    const baseRegionCount = countInWindow(result.points, 2.5, 0.5);
    for (const target of fixture.refinementTargetVolumesMl) {
      const targetCount = countInWindow(result.points, target, 0.5);
      expect(targetCount).toBeGreaterThan(30);
      expect(targetCount).toBeGreaterThan(baseRegionCount * 5);
    }
  });

  it("uses the shared solver for every golden anchor", () => {
    for (const { volumeMl, pH } of fixture.expectedPH) {
      const sampled = result.points.find(
        ({ addedVolumeMl }) => addedVolumeMl === volumeMl,
      );
      expect(sampled).toBeDefined();
      expect(sampled?.pH).toBeCloseTo(pH, V12_PH_TOLERANCE_DIGITS);
    }
  });

  it("keeps the descending direction within the existing tolerance", () => {
    expect(
      result.points.every((point, index) => {
        const previous = result.points[index - 1];
        return previous === undefined || point.pH <= previous.pH + 1e-8;
      }),
    ).toBe(true);
  });
});
