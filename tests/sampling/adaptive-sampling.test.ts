import { describe, expect, it } from "vitest";

import type { CharacteristicPoint, EquivalencePoint } from "../../src/domain/titration";
import {
  determineMaxVolumeMl,
  generateSamplingVolumes,
} from "../../src/sampling";

function equivalence(volumeMl: number, order: number): EquivalencePoint {
  return { id: `eq-${order}`, order, volumeMl };
}

function characteristic(volumeMl: number, order: number): CharacteristicPoint {
  return { id: `half-${order}`, type: "half-equivalence", order, volumeMl };
}

function expectValidVolumes(volumes: readonly number[], maxVolumeMl: number): void {
  expect(volumes[0]).toBe(0);
  expect(volumes.at(-1)).toBe(maxVolumeMl);
  expect(volumes.every((volume) => Number.isFinite(volume) && volume >= 0 && volume <= maxVolumeMl))
    .toBe(true);
  expect(new Set(volumes).size).toBe(volumes.length);
  expect(volumes.every((volume, index) => index === 0 || volume > (volumes[index - 1] ?? volume)))
    .toBe(true);
}

function countInWindow(volumes: readonly number[], center: number, halfWidth: number): number {
  return volumes.filter((volume) => volume >= center - halfWidth && volume <= center + halfWidth).length;
}

describe("adaptive sampling volume generation", () => {
  it("combines base points, all equivalence windows, and characteristic anchors", () => {
    const equivalencePoints = [equivalence(10, 1), equivalence(20, 2), equivalence(30, 3)];
    const characteristicPoints = [characteristic(5, 1), characteristic(15, 2), characteristic(25, 3)];
    const volumes = generateSamplingVolumes(37.5, equivalencePoints, characteristicPoints);

    expectValidVolumes(volumes, 37.5);
    for (const point of [...equivalencePoints, ...characteristicPoints]) {
      expect(volumes).toContain(point.volumeMl);
    }
    for (const target of [10, 20, 30]) {
      expect(countInWindow(volumes, target, 0.5)).toBeGreaterThan(30);
    }
  });

  it("makes an equivalence neighborhood denser than an equal-width base region", () => {
    const volumes = generateSamplingVolumes(30, [equivalence(20, 1)], [characteristic(10, 1)]);
    expect(countInWindow(volumes, 20, 0.5)).toBeGreaterThan(countInWindow(volumes, 5, 0.5) * 5);
  });

  it("deduplicates overlapping windows and floating-point-equivalent anchors", () => {
    const volumes = generateSamplingVolumes(
      20,
      [equivalence(10, 1), equivalence(10.5, 2)],
      [characteristic(10.000000000000002, 1)],
      { basePointCount: 21, equivalenceWindowFraction: 1, equivalencePointCount: 41 },
    );
    expectValidVolumes(volumes, 20);
    expect(volumes).toContain(10);
    expect(volumes).toContain(10.5);
    expect(volumes.filter((volume) => Math.abs(volume - 10) < 1e-10)).toHaveLength(1);
  });

  it("supports a custom max before later metadata points", () => {
    const volumes = generateSamplingVolumes(
      12,
      [equivalence(10, 1), equivalence(20, 2)],
      [characteristic(5, 1), characteristic(15, 2)],
    );
    expectValidVolumes(volumes, 12);
    expect(volumes).toContain(5);
    expect(volumes).toContain(10);
    expect(volumes).not.toContain(15);
    expect(volumes).not.toContain(20);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid custom max %s", (maxVolumeMl) => {
    expect(() => determineMaxVolumeMl([equivalence(20, 1)], maxVolumeMl)).toThrow();
  });
});

describe("automatic maximum volume", () => {
  it("uses 1.5 times the last volume for a single equivalence point", () => {
    expect(determineMaxVolumeMl([equivalence(20, 1)])).toBe(30);
  });

  it("keeps an excess region after the final point in polyvalent systems", () => {
    expect(determineMaxVolumeMl([equivalence(10, 1), equivalence(20, 2)])).toBe(25);
    expect(determineMaxVolumeMl([equivalence(10, 1), equivalence(20, 2), equivalence(30, 3)]))
      .toBe(37.5);
  });
});
