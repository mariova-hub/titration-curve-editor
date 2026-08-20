import type { AxisStyle } from "../domain/graph-style";

function candidateIntervals(range: number): number[] {
  const exponent = Math.floor(Math.log10(range));
  const candidates: number[] = [];
  for (let power = exponent - 2; power <= exponent + 1; power += 1) {
    const magnitude = 10 ** power;
    for (const multiplier of [1, 2, 2.5, 5, 10]) {
      candidates.push(multiplier * magnitude);
    }
  }
  return [...new Set(candidates)].sort((a, b) => a - b);
}

function tickCount(min: number, max: number, interval: number): number {
  const start = Math.ceil(min / interval - 1e-12);
  const end = Math.floor(max / interval + 1e-12);
  return Math.max(0, end - start + 1);
}

export function calculateNiceTickInterval(min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    throw new RangeError("Nice tick range must be finite and increasing.");
  }
  const candidates = candidateIntervals(max - min);
  const preferred = candidates.filter((interval) => {
    const count = tickCount(min, max, interval);
    return count >= 4 && count <= 7;
  });
  const pool = preferred.length > 0 ? preferred : candidates;
  const selected = pool.reduce((best, interval) => {
    const score = Math.abs(tickCount(min, max, interval) - 6);
    const bestScore = Math.abs(tickCount(min, max, best) - 6);
    return score < bestScore || (score === bestScore && interval < best) ? interval : best;
  });
  return selected;
}

export function resolveMajorTickInterval(
  axis: AxisStyle,
  min: number,
  max: number,
): number {
  return axis.majorTickInterval === "auto"
    ? calculateNiceTickInterval(min, max)
    : axis.majorTickInterval;
}

export function resolveMinorTickInterval(axis: AxisStyle, majorInterval: number): number | undefined {
  if (!axis.showMinorTicks || axis.minorTickInterval === undefined) return undefined;
  return axis.minorTickInterval === "auto" ? majorInterval / 2 : axis.minorTickInterval;
}

export function generateTicks(min: number, max: number, interval: number): number[] {
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    !Number.isFinite(interval) ||
    max <= min ||
    interval <= 0
  ) {
    throw new RangeError("Tick range and interval must be finite, positive, and increasing.");
  }
  const startIndex = Math.ceil(min / interval - 1e-12);
  const endIndex = Math.floor(max / interval + 1e-12);
  const ticks: number[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const value = Number((index * interval).toPrecision(14));
    ticks.push(Object.is(value, -0) ? 0 : value);
  }
  return ticks;
}

export function generateMinorTicks(
  min: number,
  max: number,
  minorInterval: number,
  majorInterval: number,
): number[] {
  return generateTicks(min, max, minorInterval).filter((value) => {
    const ratio = value / majorInterval;
    return Math.abs(ratio - Math.round(ratio)) > 1e-10;
  });
}
