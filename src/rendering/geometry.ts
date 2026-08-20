import type { GraphStyle } from "../domain/graph-style";

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

export function calculatePlotArea(style: GraphStyle): PlotArea {
  const topMargin = style.title.visible ? 52 : 20;
  const rightMargin = 20;
  const bottomMargin = style.xAxis.visible
    ? 20 +
      (style.xAxis.showMajorTicks ? style.xAxis.tickLength : 0) +
      (style.xAxis.showTickLabels ? 22 : 0) +
      (style.xAxis.showLabel ? 30 : 0)
    : 16;
  const leftMargin = style.yAxis.visible
    ? 20 +
      (style.yAxis.showMajorTicks ? style.yAxis.tickLength : 0) +
      (style.yAxis.showTickLabels ? 38 : 0) +
      (style.yAxis.showLabel ? 30 : 0)
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
