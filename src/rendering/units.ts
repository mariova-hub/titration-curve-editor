const CSS_PIXELS_PER_INCH = 96;
const POINTS_PER_INCH = 72;

export const USER_UNITS_PER_POINT = CSS_PIXELS_PER_INCH / POINTS_PER_INCH;

export function ptToUserUnits(pt: number): number {
  if (!Number.isFinite(pt) || pt <= 0) {
    throw new RangeError("Point size must be a positive finite number.");
  }
  return pt * USER_UNITS_PER_POINT;
}
