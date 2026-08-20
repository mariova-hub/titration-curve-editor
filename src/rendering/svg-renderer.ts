import type {
  AxisStyle,
  FeatureVisibility,
  GraphStyle,
  LineStyle,
  MarkerStyle,
} from "../domain/graph-style";
import type {
  CharacteristicPoint,
  CurvePoint,
  EquivalencePoint,
  TitrationResult,
} from "../domain/titration";
import { RenderingError } from "./errors";
import { calculatePlotArea, createCoordinateTransform, type CoordinateTransform, type PlotArea } from "./geometry";
import { renderStrokeAttributes } from "./line-patterns";
import { formatSvgNumber, formatTickValue } from "./numbers";
import {
  generateMinorTicks,
  generateTicks,
  resolveMajorTickInterval,
  resolveMinorTickInterval,
} from "./ticks";
import { escapeXml } from "./xml";

interface AxisTickModel {
  majorInterval: number;
  majorTicks: number[];
  minorTicks: number[];
}

interface AxisRenderResult {
  geometry: string;
  labels: string;
}

function validatePositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RenderingError(`${label} must be a positive finite number.`);
  }
}

function validateLineStyle(style: LineStyle, label: string): void {
  validatePositiveFinite(style.width, `${label}.width`);
  if (style.color.length === 0) throw new RenderingError(`${label}.color must not be empty.`);
}

function validateMarkerStyle(style: MarkerStyle, label: string): void {
  validatePositiveFinite(style.radius, `${label}.radius`);
  if (style.color.length === 0) throw new RenderingError(`${label}.color must not be empty.`);
}

function validateAxis(axis: AxisStyle, label: string): void {
  validateLineStyle(axis.line, `${label}.line`);
  validatePositiveFinite(axis.tickLength, `${label}.tickLength`);
  validatePositiveFinite(axis.tickWidth, `${label}.tickWidth`);
  if (axis.majorTickInterval !== "auto") {
    validatePositiveFinite(axis.majorTickInterval, `${label}.majorTickInterval`);
  }
  if (axis.minorTickInterval !== undefined && axis.minorTickInterval !== "auto") {
    validatePositiveFinite(axis.minorTickInterval, `${label}.minorTickInterval`);
  }
}

function validateResult(result: TitrationResult): void {
  if (result.points.length === 0) throw new RenderingError("TitrationResult.points must not be empty.");
  result.points.forEach((point, index) => {
    if (!Number.isFinite(point.addedVolumeMl) || !Number.isFinite(point.pH)) {
      throw new RenderingError(`Curve point ${index} must contain finite values.`);
    }
    const previous = result.points[index - 1];
    if (previous !== undefined && point.addedVolumeMl <= previous.addedVolumeMl) {
      throw new RenderingError("Curve point volumes must be strictly ascending.");
    }
  });
  for (const point of [...result.equivalencePoints, ...result.characteristicPoints]) {
    if (!Number.isFinite(point.volumeMl) || (point.pH !== undefined && !Number.isFinite(point.pH))) {
      throw new RenderingError(`Feature point ${point.id} must contain finite values.`);
    }
  }
}

function validateStyle(style: GraphStyle): PlotArea {
  validatePositiveFinite(style.width, "width");
  validatePositiveFinite(style.height, "height");
  if (
    !Number.isFinite(style.xMin) ||
    !Number.isFinite(style.xMax) ||
    style.xMax <= style.xMin
  ) {
    throw new RenderingError("xMax must be finite and greater than xMin.");
  }
  if (
    !Number.isFinite(style.yMin) ||
    !Number.isFinite(style.yMax) ||
    style.yMax <= style.yMin
  ) {
    throw new RenderingError("yMax must be finite and greater than yMin.");
  }
  validateLineStyle(style.curve, "curve");
  validateAxis(style.xAxis, "xAxis");
  validateAxis(style.yAxis, "yAxis");
  validateLineStyle(style.horizontalGrid.line, "horizontalGrid.line");
  validateLineStyle(style.verticalGrid.line, "verticalGrid.line");
  validateLineStyle(style.equivalenceGuides.line, "equivalenceGuides.line");
  validateLineStyle(style.characteristicPoints.line, "characteristicPoints.line");
  validateMarkerStyle(style.equivalenceGuides.marker, "equivalenceGuides.marker");
  validateMarkerStyle(style.characteristicPoints.marker, "characteristicPoints.marker");
  const plotArea = calculatePlotArea(style);
  if (plotArea.width <= 0 || plotArea.height <= 0) {
    throw new RenderingError("Figure is too small for the required plot margins.");
  }
  return plotArea;
}

function createTickModel(axis: AxisStyle, min: number, max: number): AxisTickModel {
  const majorInterval = resolveMajorTickInterval(axis, min, max);
  validatePositiveFinite(majorInterval, "resolved major tick interval");
  const minorInterval = resolveMinorTickInterval(axis, majorInterval);
  if (minorInterval !== undefined) validatePositiveFinite(minorInterval, "resolved minor tick interval");
  return {
    majorInterval,
    majorTicks: generateTicks(min, max, majorInterval),
    minorTicks:
      minorInterval === undefined ? [] : generateMinorTicks(min, max, minorInterval, majorInterval),
  };
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function isVisible(feature: FeatureVisibility, id: string): boolean {
  return feature.visibilityById[id] ?? feature.showAll;
}

function renderCurvePath(
  points: readonly CurvePoint[],
  transform: CoordinateTransform,
): string {
  return points.map((point, index) => {
    const pixel = transform.pointToPx(point.addedVolumeMl, point.pH);
    return `${index === 0 ? "M" : "L"} ${formatSvgNumber(pixel.x)} ${formatSvgNumber(pixel.y)}`;
  }).join(" ");
}

function renderGrid(
  style: GraphStyle,
  plot: PlotArea,
  transform: CoordinateTransform,
  xTicks: readonly number[],
  yTicks: readonly number[],
  clipId: string,
): string {
  const lines: string[] = [];
  if (style.horizontalGrid.visible && style.horizontalGrid.line.visible) {
    for (const value of yTicks) {
      const y = formatSvgNumber(transform.yToPx(value));
      lines.push(`<line data-role="horizontal-grid-line" data-value="${formatTickValue(value)}" x1="${formatSvgNumber(plot.left)}" y1="${y}" x2="${formatSvgNumber(plot.right)}" y2="${y}" ${renderStrokeAttributes(style.horizontalGrid.line)} />`);
    }
  }
  if (style.verticalGrid.visible && style.verticalGrid.line.visible) {
    for (const value of xTicks) {
      const x = formatSvgNumber(transform.xToPx(value));
      lines.push(`<line data-role="vertical-grid-line" data-value="${formatTickValue(value)}" x1="${x}" y1="${formatSvgNumber(plot.top)}" x2="${x}" y2="${formatSvgNumber(plot.bottom)}" ${renderStrokeAttributes(style.verticalGrid.line)} />`);
    }
  }
  return lines.length === 0
    ? ""
    : `<g data-role="grid" clip-path="url(#${clipId})">${lines.join("")}</g>`;
}

function renderFeatureGuide(
  role: "equivalence-guide" | "characteristic-guide",
  point: EquivalencePoint | CharacteristicPoint,
  line: LineStyle,
  transform: CoordinateTransform,
  plot: PlotArea,
): string {
  const x = formatSvgNumber(transform.xToPx(point.volumeMl));
  return `<line data-role="${role}" data-id="${escapeXml(point.id)}" data-order="${point.order}" x1="${x}" y1="${formatSvgNumber(plot.top)}" x2="${x}" y2="${formatSvgNumber(plot.bottom)}" ${renderStrokeAttributes(line)} />`;
}

function renderMarker(
  role: "equivalence-marker" | "characteristic-marker",
  point: EquivalencePoint | CharacteristicPoint,
  marker: MarkerStyle,
  transform: CoordinateTransform,
): string {
  if (point.pH === undefined) return "";
  const pixel = transform.pointToPx(point.volumeMl, point.pH);
  return `<circle data-role="${role}" data-id="${escapeXml(point.id)}" data-order="${point.order}" cx="${formatSvgNumber(pixel.x)}" cy="${formatSvgNumber(pixel.y)}" r="${formatSvgNumber(marker.radius)}" fill="${escapeXml(marker.color)}" />`;
}

function renderFeatures(
  result: TitrationResult,
  style: GraphStyle,
  transform: CoordinateTransform,
  plot: PlotArea,
  clipId: string,
): { guides: string; markers: string } {
  const guides: string[] = [];
  const markers: string[] = [];
  for (const point of result.equivalencePoints) {
    if (point.volumeMl < style.xMin || point.volumeMl > style.xMax || !isVisible(style.equivalenceGuides, point.id)) continue;
    if (style.equivalenceGuides.line.visible) {
      guides.push(renderFeatureGuide("equivalence-guide", point, style.equivalenceGuides.line, transform, plot));
    }
    if (style.equivalenceGuides.marker.visible) {
      markers.push(renderMarker("equivalence-marker", point, style.equivalenceGuides.marker, transform));
    }
  }
  for (const point of result.characteristicPoints) {
    if (point.volumeMl < style.xMin || point.volumeMl > style.xMax || !isVisible(style.characteristicPoints, point.id)) continue;
    if (style.characteristicPoints.line.visible) {
      guides.push(renderFeatureGuide("characteristic-guide", point, style.characteristicPoints.line, transform, plot));
    }
    if (style.characteristicPoints.marker.visible) {
      markers.push(renderMarker("characteristic-marker", point, style.characteristicPoints.marker, transform));
    }
  }
  return {
    guides: guides.length === 0 ? "" : `<g data-role="guides" clip-path="url(#${clipId})">${guides.join("")}</g>`,
    markers: markers.length === 0 ? "" : `<g data-role="markers" clip-path="url(#${clipId})">${markers.join("")}</g>`,
  };
}

function renderAxis(
  orientation: "x" | "y",
  axis: AxisStyle,
  tickModel: AxisTickModel,
  plot: PlotArea,
  transform: CoordinateTransform,
  style: GraphStyle,
): AxisRenderResult {
  if (!axis.visible) return { geometry: "", labels: "" };
  const geometry: string[] = [];
  const labels: string[] = [];
  const role = `${orientation}-axis`;
  if (axis.line.visible) {
    geometry.push(
      orientation === "x"
        ? `<line data-role="axis-line" x1="${formatSvgNumber(plot.left)}" y1="${formatSvgNumber(plot.bottom)}" x2="${formatSvgNumber(plot.right)}" y2="${formatSvgNumber(plot.bottom)}" ${renderStrokeAttributes(axis.line)} />`
        : `<line data-role="axis-line" x1="${formatSvgNumber(plot.left)}" y1="${formatSvgNumber(plot.top)}" x2="${formatSvgNumber(plot.left)}" y2="${formatSvgNumber(plot.bottom)}" ${renderStrokeAttributes(axis.line)} />`,
    );
  }
  const renderTick = (value: number, major: boolean): void => {
    const length = major ? axis.tickLength : axis.tickLength * 0.6;
    const coordinate = orientation === "x" ? transform.xToPx(value) : transform.yToPx(value);
    geometry.push(
      orientation === "x"
        ? `<line data-role="${major ? "major-tick" : "minor-tick"}" data-value="${formatTickValue(value)}" x1="${formatSvgNumber(coordinate)}" y1="${formatSvgNumber(plot.bottom)}" x2="${formatSvgNumber(coordinate)}" y2="${formatSvgNumber(plot.bottom + length)}" stroke="${escapeXml(axis.line.color)}" stroke-width="${formatSvgNumber(axis.tickWidth)}" />`
        : `<line data-role="${major ? "major-tick" : "minor-tick"}" data-value="${formatTickValue(value)}" x1="${formatSvgNumber(plot.left - length)}" y1="${formatSvgNumber(coordinate)}" x2="${formatSvgNumber(plot.left)}" y2="${formatSvgNumber(coordinate)}" stroke="${escapeXml(axis.line.color)}" stroke-width="${formatSvgNumber(axis.tickWidth)}" />`,
    );
  };
  if (axis.showMajorTicks) for (const value of tickModel.majorTicks) renderTick(value, true);
  if (axis.showMinorTicks) for (const value of tickModel.minorTicks) renderTick(value, false);
  if (axis.showTickLabels) {
    for (const value of tickModel.majorTicks) {
      const text = formatTickValue(value);
      labels.push(
        orientation === "x"
          ? `<text data-role="tick-label" data-axis="x" x="${formatSvgNumber(transform.xToPx(value))}" y="${formatSvgNumber(plot.bottom + axis.tickLength + 17)}" text-anchor="middle" font-size="12">${text}</text>`
          : `<text data-role="tick-label" data-axis="y" x="${formatSvgNumber(plot.left - axis.tickLength - 8)}" y="${formatSvgNumber(transform.yToPx(value) + 4)}" text-anchor="end" font-size="12">${text}</text>`,
      );
    }
  }
  if (axis.showLabel) {
    labels.push(
      orientation === "x"
        ? `<text data-role="axis-label" data-axis="x" x="${formatSvgNumber((plot.left + plot.right) / 2)}" y="${formatSvgNumber(style.height - 12)}" text-anchor="middle" font-size="14">${escapeXml(axis.label)}</text>`
        : `<text data-role="axis-label" data-axis="y" x="18" y="${formatSvgNumber((plot.top + plot.bottom) / 2)}" text-anchor="middle" font-size="14" transform="rotate(-90 18 ${formatSvgNumber((plot.top + plot.bottom) / 2)})">${escapeXml(axis.label)}</text>`,
    );
  }
  return {
    geometry: `<g data-role="${role}">${geometry.join("")}</g>`,
    labels: labels.join(""),
  };
}

export function renderTitrationSvg(result: TitrationResult, style: GraphStyle): string {
  validateResult(result);
  const plot = validateStyle(style);
  const transform = createCoordinateTransform(style, plot);
  const xTickModel = createTickModel(style.xAxis, style.xMin, style.xMax);
  const yTickModel = createTickModel(style.yAxis, style.yMin, style.yMax);
  const pathData = renderCurvePath(result.points, transform);
  const clipId = `titration-plot-${hashString(`${style.width}|${style.height}|${style.xMin}|${style.xMax}|${style.yMin}|${style.yMax}|${pathData}`)}`;
  const background = style.background === "white"
    ? `<rect data-role="background" x="0" y="0" width="${formatSvgNumber(style.width)}" height="${formatSvgNumber(style.height)}" fill="#ffffff" />`
    : "";
  const grid = renderGrid(
    style,
    plot,
    transform,
    xTickModel.majorTicks,
    yTickModel.majorTicks,
    clipId,
  );
  const features = renderFeatures(result, style, transform, plot, clipId);
  const xAxis = renderAxis("x", style.xAxis, xTickModel, plot, transform, style);
  const yAxis = renderAxis("y", style.yAxis, yTickModel, plot, transform, style);
  const axes = xAxis.geometry + yAxis.geometry;
  const curve = style.curve.visible
    ? `<g data-role="curve" clip-path="url(#${clipId})"><path data-role="titration-curve" data-source-point-count="${result.points.length}" d="${pathData}" fill="none" ${renderStrokeAttributes(style.curve)} /></g>`
    : "";
  const title = style.title.visible
    ? `<text data-role="title" x="${formatSvgNumber(style.width / 2)}" y="28" text-anchor="middle" font-size="18">${escapeXml(style.title.text)}</text>`
    : "";
  const labelContent = xAxis.labels + yAxis.labels + title;
  const labels = labelContent.length === 0 ? "" : `<g data-role="labels">${labelContent}</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${formatSvgNumber(style.width)}" height="${formatSvgNumber(style.height)}" viewBox="0 0 ${formatSvgNumber(style.width)} ${formatSvgNumber(style.height)}" font-family="Arial, sans-serif"><defs><clipPath id="${clipId}"><rect data-role="plot-area" x="${formatSvgNumber(plot.left)}" y="${formatSvgNumber(plot.top)}" width="${formatSvgNumber(plot.width)}" height="${formatSvgNumber(plot.height)}" /></clipPath></defs>${background}${grid}${features.guides}<g data-role="axes">${axes}</g>${curve}${features.markers}${labels}</svg>`;
}
