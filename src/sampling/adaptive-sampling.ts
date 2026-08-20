import type { CharacteristicPoint, EquivalencePoint } from "../domain/titration";

export interface SamplingOptions {
  maxVolumeMl?: number;
  basePointCount?: number;
  equivalenceWindowFraction?: number;
  equivalencePointCount?: number;
}

export interface ResolvedSamplingOptions {
  basePointCount: number;
  equivalenceWindowFraction: number;
  equivalencePointCount: number;
}

export const DEFAULT_SAMPLING_OPTIONS: Readonly<ResolvedSamplingOptions> = {
  basePointCount: 121,
  equivalenceWindowFraction: 0.05,
  equivalencePointCount: 61,
};

export const MAX_SAMPLING_POINT_COUNT = 2_000;

interface VolumeCandidate {
  volumeMl: number;
  priority: number;
  sequence: number;
}

function requireFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number.`);
  }
}

function requirePointCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 2 || value > MAX_SAMPLING_POINT_COUNT) {
    throw new RangeError(`${label} must be an integer from 2 to ${MAX_SAMPLING_POINT_COUNT}.`);
  }
}

export function resolveSamplingOptions(
  options: SamplingOptions = {},
): ResolvedSamplingOptions {
  const resolved = {
    basePointCount: options.basePointCount ?? DEFAULT_SAMPLING_OPTIONS.basePointCount,
    equivalenceWindowFraction:
      options.equivalenceWindowFraction ?? DEFAULT_SAMPLING_OPTIONS.equivalenceWindowFraction,
    equivalencePointCount:
      options.equivalencePointCount ?? DEFAULT_SAMPLING_OPTIONS.equivalencePointCount,
  };

  requirePointCount(resolved.basePointCount, "basePointCount");
  requirePointCount(resolved.equivalencePointCount, "equivalencePointCount");
  if (
    !Number.isFinite(resolved.equivalenceWindowFraction) ||
    resolved.equivalenceWindowFraction <= 0
  ) {
    throw new RangeError("equivalenceWindowFraction must be a positive finite number.");
  }
  if (options.maxVolumeMl !== undefined) {
    requireFiniteNonNegative(options.maxVolumeMl, "maxVolumeMl");
  }
  return resolved;
}

export function determineMaxVolumeMl(
  equivalencePoints: readonly EquivalencePoint[],
  requestedMaxVolumeMl?: number,
): number {
  if (requestedMaxVolumeMl !== undefined) {
    requireFiniteNonNegative(requestedMaxVolumeMl, "maxVolumeMl");
    return requestedMaxVolumeMl;
  }

  const volumes = equivalencePoints.map(({ volumeMl }) => volumeMl).sort((a, b) => a - b);
  if (volumes.length === 0) {
    throw new RangeError("At least one equivalence point is required for automatic max volume.");
  }
  for (const volume of volumes) requireFiniteNonNegative(volume, "equivalence volume");

  const lastVolume = volumes.at(-1);
  if (lastVolume === undefined || lastVolume <= 0) {
    throw new RangeError("The last equivalence volume must be positive.");
  }
  if (volumes.length === 1) return lastVolume * 1.5;

  const first = volumes[0];
  const second = volumes[1];
  if (first === undefined || second === undefined || second <= first) {
    throw new RangeError("Equivalence volumes must be strictly ascending.");
  }
  const firstSpacing = second - first;
  return Math.max(lastVolume * 1.25, lastVolume + firstSpacing * 0.5);
}

function localEquivalenceScale(
  sortedPoints: readonly EquivalencePoint[],
  index: number,
  maxVolumeMl: number,
): number {
  const point = sortedPoints[index];
  if (point === undefined) throw new Error("Missing equivalence point.");
  const distances: number[] = [];
  const previous = sortedPoints[index - 1];
  const next = sortedPoints[index + 1];
  if (previous !== undefined && point.volumeMl > previous.volumeMl) {
    distances.push(point.volumeMl - previous.volumeMl);
  }
  if (next !== undefined && next.volumeMl > point.volumeMl) {
    distances.push(next.volumeMl - point.volumeMl);
  }
  if (distances.length > 0) return Math.min(...distances);
  if (point.volumeMl > 0) return point.volumeMl;
  return maxVolumeMl > 0 ? maxVolumeMl : 1;
}

export function generateSamplingVolumes(
  maxVolumeMl: number,
  equivalencePoints: readonly EquivalencePoint[],
  characteristicPoints: readonly CharacteristicPoint[],
  options: SamplingOptions = {},
): number[] {
  requireFiniteNonNegative(maxVolumeMl, "maxVolumeMl");
  const resolved = resolveSamplingOptions(options);
  const inRangeEquivalenceCount = equivalencePoints.filter(
    ({ volumeMl }) => Number.isFinite(volumeMl) && volumeMl >= 0 && volumeMl <= maxVolumeMl,
  ).length;
  const estimatedPointCount =
    resolved.basePointCount +
    inRangeEquivalenceCount * resolved.equivalencePointCount +
    equivalencePoints.length +
    characteristicPoints.length +
    2;
  if (estimatedPointCount > MAX_SAMPLING_POINT_COUNT) {
    throw new RangeError(`Sampling request exceeds the ${MAX_SAMPLING_POINT_COUNT}-point limit.`);
  }

  const candidates: VolumeCandidate[] = [];
  let sequence = 0;
  const addCandidate = (volumeMl: number, priority: number): void => {
    if (!Number.isFinite(volumeMl)) throw new RangeError("Sampling volume must be finite.");
    if (volumeMl < 0 || volumeMl > maxVolumeMl) return;
    candidates.push({ volumeMl, priority, sequence });
    sequence += 1;
  };

  for (let index = 0; index < resolved.basePointCount; index += 1) {
    addCandidate(maxVolumeMl * index / (resolved.basePointCount - 1), 0);
  }

  const sortedEquivalencePoints = [...equivalencePoints].sort(
    (left, right) => left.volumeMl - right.volumeMl,
  );
  sortedEquivalencePoints.forEach((point, index) => {
    requireFiniteNonNegative(point.volumeMl, "equivalence volume");
    if (point.volumeMl > maxVolumeMl) return;
    const scale = localEquivalenceScale(sortedEquivalencePoints, index, maxVolumeMl);
    const halfWidth = scale * resolved.equivalenceWindowFraction;
    const start = Math.max(0, point.volumeMl - halfWidth);
    const end = Math.min(maxVolumeMl, point.volumeMl + halfWidth);
    for (let sampleIndex = 0; sampleIndex < resolved.equivalencePointCount; sampleIndex += 1) {
      addCandidate(
        start + (end - start) * sampleIndex / (resolved.equivalencePointCount - 1),
        1,
      );
    }
    addCandidate(point.volumeMl, 4);
  });

  for (const point of characteristicPoints) {
    requireFiniteNonNegative(point.volumeMl, "characteristic volume");
    addCandidate(point.volumeMl, 3);
  }
  addCandidate(0, 4);
  addCandidate(maxVolumeMl, 4);

  candidates.sort(
    (left, right) => left.volumeMl - right.volumeMl || right.priority - left.priority || left.sequence - right.sequence,
  );
  const toleranceMl = Math.max(1e-12, maxVolumeMl * 1e-12);
  const deduplicated: VolumeCandidate[] = [];
  for (const candidate of candidates) {
    const previous = deduplicated.at(-1);
    if (previous !== undefined && Math.abs(candidate.volumeMl - previous.volumeMl) <= toleranceMl) {
      if (candidate.priority > previous.priority) deduplicated[deduplicated.length - 1] = candidate;
    } else {
      deduplicated.push(candidate);
    }
  }

  const volumes = deduplicated.map(({ volumeMl }) => volumeMl).sort((a, b) => a - b);
  if (volumes.length > MAX_SAMPLING_POINT_COUNT) {
    throw new RangeError(`Sampling result exceeds the ${MAX_SAMPLING_POINT_COUNT}-point limit.`);
  }
  return volumes;
}
