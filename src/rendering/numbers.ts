export function formatSvgNumber(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError("SVG number must be finite.");
  const normalized = Number(value.toPrecision(15));
  return Object.is(normalized, -0) || normalized === 0 ? "0" : String(normalized);
}

export function formatTickValue(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError("Tick value must be finite.");
  const normalized = Number(value.toPrecision(12));
  return Object.is(normalized, -0) || normalized === 0 ? "0" : String(normalized);
}
