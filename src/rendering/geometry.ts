import type { AxisStyle, GraphStyle } from "../domain/graph-style";
import { ptToUserUnits } from "./units";

export interface PlotArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface PlotPoint {
  x: number;
  y: number;
}

export interface CoordinateTransform {
  xToPx(value: number): number;
  yToPx(value: number): number;
  pointToPx(x: number, y: number): PlotPoint;
}

function maximumShownTickLength(axis: AxisStyle): number {
  return Math.max(
    axis.showMajorTicks ? axis.tickLength : 0,
    axis.showMinorTicks ? axis.tickLength * 0.6 : 0,
  );
}

export function getOutsideTickExtent(axis: AxisStyle): number {
  const length = maximumShownTickLength(axis);
  if (axis.tickDirection === "inside") return 0;
  return axis.tickDirection === "both" ? length / 2 : length;
}

/** A deterministic approximation used only to reserve layout space. */
export function estimateHorizontalTextWidth(text: string, fontSize: number): number {
  const widthInEm = Array.from(text).reduce(
    (sum, character) => sum + (/^[\x00-\xff]$/.test(character) ? 0.6 : 1),
    0,
  );
  return Math.max(fontSize, widthInEm * fontSize);
}

export function calculatePlotArea(style: GraphStyle): PlotArea {
  const tickLabelFontSize = ptToUserUnits(style.typography.tickLabelFontSizePt);
  const axisLabelFontSize = ptToUserUnits(style.typography.axisLabelFontSizePt);
  const titleFontSize = ptToUserUnits(style.typography.titleFontSizePt);
  const topMargin = style.title.visible
    ? Math.max(52, titleFontSize + 28)
    : 20;
  const rightMargin = 20;
  const xOutsideContent = 20 +
    getOutsideTickExtent(style.xAxis) +
    (style.xAxis.showTickLabels ? tickLabelFontSize + 10 : 0);
  const xLabelSpace = style.xAxis.labelPosition.mode === "auto"
    ? axisLabelFontSize + 16
    : style.xAxis.labelPosition.offsetPx + axisLabelFontSize + 8;
  const bottomMargin = style.xAxis.visible
    ? style.xAxis.showLabel && style.xAxis.labelPosition.mode === "custom"
      ? Math.max(xOutsideContent, xLabelSpace)
      : xOutsideContent + (style.xAxis.showLabel ? xLabelSpace : 0)
    : 16;
  const yOutsideContent = 20 +
    getOutsideTickExtent(style.yAxis) +
    (style.yAxis.showTickLabels
      ? Math.max(38, tickLabelFontSize * 3)
      : 0);
  const horizontalYLabelWidth = estimateHorizontalTextWidth(
    style.yAxis.label,
    axisLabelFontSize,
  );
  const yLabelCrossExtent = style.yAxis.labelOrientation === "horizontal"
    ? horizontalYLabelWidth / 2
    : axisLabelFontSize;
  const yLabelSpace = style.yAxis.labelPosition.mode === "auto"
    ? (style.yAxis.labelOrientation === "horizontal"
      ? horizontalYLabelWidth
      : axisLabelFontSize) + 16
    : style.yAxis.labelPosition.offsetPx + yLabelCrossExtent + 8;
  const leftMargin = style.yAxis.visible
    ? style.yAxis.showLabel && style.yAxis.labelPosition.mode === "custom"
      ? Math.max(yOutsideContent, yLabelSpace)
      : yOutsideContent + (style.yAxis.showLabel ? yLabelSpace : 0)
    : 16;
  const left = leftMargin;
  const top = topMargin;
  const right = style.width - rightMargin;
  const bottom = style.height - bottomMargin;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function createCoordinateTransform(
  style: GraphStyle,
  plotArea: PlotArea = calculatePlotArea(style),
): CoordinateTransform {
  const xToPx = (value: number): number =>
    plotArea.left + (value - style.xMin) / (style.xMax - style.xMin) * plotArea.width;
  const yToPx = (value: number): number =>
    plotArea.bottom - (value - style.yMin) / (style.yMax - style.yMin) * plotArea.height;
  return {
    xToPx,
    yToPx,
    pointToPx: (x, y) => ({ x: xToPx(x), y: yToPx(y) }),
  };
}
