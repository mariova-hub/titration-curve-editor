import { describe, expect, it } from "vitest";

import {
  LINE_PATTERNS,
  type AxisStyle,
  type GraphStyle,
  type LinePattern,
} from "../../src/domain/graph-style";

const xAxis: AxisStyle = {
  visible: true,
  showLabel: true,
  label: "滴下量 / mL",
  line: { visible: true, width: 1, pattern: "solid", color: "#000000" },
  majorTickInterval: "auto",
  showMajorTicks: true,
  showMinorTicks: false,
  showTickLabels: true,
  showZeroLabel: true,
  tickLength: 6,
  tickWidth: 1,
  tickDirection: "outside",
  labelPosition: { mode: "auto", alongAxis: 0.5, offsetPx: 32 },
};

const yAxis: AxisStyle = {
  visible: true,
  showLabel: true,
  label: "pH",
  line: {
    visible: true,
    width: 1.5,
    pattern: "dashed",
    color: "#222222",
  },
  majorTickInterval: 2,
  minorTickInterval: 1,
  showMajorTicks: true,
  showMinorTicks: true,
  showTickLabels: false,
  showZeroLabel: false,
  tickLength: 4,
  tickWidth: 0.75,
  tickDirection: "inside",
  labelPosition: { mode: "custom", alongAxis: 0.25, offsetPx: 20 },
};

const graphStyle: GraphStyle = {
  width: 800,
  height: 500,
  xMin: 0,
  xMax: 50,
  yMin: 0,
  yMax: 14,
  curve: { visible: true, width: 2, pattern: "dash-dot", color: "#000000" },
  xAxis,
  yAxis,
  horizontalGrid: {
    visible: false,
    line: {
      visible: false,
      width: 0.5,
      pattern: "dotted",
      color: "#cccccc",
    },
  },
  verticalGrid: {
    visible: true,
    line: {
      visible: true,
      width: 0.5,
      pattern: "dashed",
      color: "#cccccc",
    },
  },
  equivalenceGuides: {
    showAll: false,
    visibilityById: { "eq-1": true, "eq-2": false },
    line: {
      visible: true,
      width: 1,
      pattern: "dashed",
      color: "#444444",
    },
    marker: { visible: true, color: "#000000", radius: 3 },
  },
  characteristicPoints: {
    showAll: false,
    visibilityById: { "half-eq-1": true, "half-eq-2": false },
    line: {
      visible: true,
      width: 0.75,
      pattern: "dotted",
      color: "#666666",
    },
    marker: { visible: true, color: "#000000", radius: 3 },
  },
  typography: {
    tickLabelFontSize: 12,
    tickLabelFontFamily: "Arial, sans-serif",
    axisLabelFontSize: 14,
    axisLabelFontFamily: "Arial, sans-serif",
    titleFontSize: 18,
    titleFontFamily: "Arial, sans-serif",
  },
  title: { visible: false, text: "滴定曲線" },
  background: "white",
  annotationsVisible: false,
};

describe("graph style model", () => {
  it("defines the four supported line patterns", () => {
    const patterns: LinePattern[] = [...LINE_PATTERNS];

    expect(patterns).toEqual(["solid", "dashed", "dotted", "dash-dot"]);
  });

  it("holds X and Y axis settings independently", () => {
    expect(graphStyle.xAxis.label).toBe("滴下量 / mL");
    expect(graphStyle.xAxis.majorTickInterval).toBe("auto");
    expect(graphStyle.xAxis.showTickLabels).toBe(true);
    expect(graphStyle.yAxis.label).toBe("pH");
    expect(graphStyle.yAxis.majorTickInterval).toBe(2);
    expect(graphStyle.yAxis.showTickLabels).toBe(false);
  });

  it("supports all-points and ID-specific feature visibility", () => {
    expect(graphStyle.equivalenceGuides.showAll).toBe(false);
    expect(graphStyle.equivalenceGuides.visibilityById).toEqual({
      "eq-1": true,
      "eq-2": false,
    });
    expect(graphStyle.characteristicPoints.visibilityById).toEqual({
      "half-eq-1": true,
      "half-eq-2": false,
    });
  });

  it("holds horizontal and vertical grids independently", () => {
    expect(graphStyle.horizontalGrid.visible).toBe(false);
    expect(graphStyle.verticalGrid.visible).toBe(true);
  });
});
