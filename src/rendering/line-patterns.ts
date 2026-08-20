import type { LinePattern, LineStyle } from "../domain/graph-style";
import { formatSvgNumber } from "./numbers";
import { escapeXml } from "./xml";

const DASH_ARRAY_BY_PATTERN: Readonly<Record<Exclude<LinePattern, "solid">, string>> = {
  dashed: "8 4",
  dotted: "1 3",
  "dash-dot": "8 3 1 3",
};

export function linePatternToDashArray(pattern: LinePattern): string | undefined {
  return pattern === "solid" ? undefined : DASH_ARRAY_BY_PATTERN[pattern];
}

export function renderStrokeAttributes(style: LineStyle): string {
  const dashArray = linePatternToDashArray(style.pattern);
  return [
    `stroke="${escapeXml(style.color)}"`,
    `stroke-width="${formatSvgNumber(style.width)}"`,
    dashArray === undefined ? undefined : `stroke-dasharray="${dashArray}"`,
    'stroke-linecap="round"',
    'stroke-linejoin="round"',
    'vector-effect="non-scaling-stroke"',
  ].filter((attribute): attribute is string => attribute !== undefined).join(" ");
}
