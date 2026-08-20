import { describe, expect, it } from "vitest";

import {
  applyExamPreset,
  applyTeachingPreset,
  createDefaultGraphStyle,
  createExamGraphStyle,
  createTeachingGraphStyle,
} from "../../src/rendering/graph-styles";

describe("GraphStyle defaults and pure presets", () => {
  it("creates the Phase 4 publication defaults", () => {
    const style = createDefaultGraphStyle(30);
    expect(style).toMatchObject({
      width: 720,
      height: 480,
      xMin: 0,
      xMax: 30,
      yMin: 0,
      yMax: 14,
      curve: { color: "#000000", width: 2, pattern: "solid" },
      title: { visible: false },
      background: "white",
    });
    expect(style.yAxis.majorTickInterval).toBe(2);
    expect(style.yAxis.showMinorTicks).toBe(false);
  });

  it("creates a monochrome Exam preset with guides and grids off", () => {
    const style = createExamGraphStyle(30);
    expect(style.presetOrigin).toBe("exam");
    expect(style.horizontalGrid.visible).toBe(false);
    expect(style.verticalGrid.visible).toBe(false);
    expect(style.equivalenceGuides.showAll).toBe(false);
    expect(style.characteristicPoints.showAll).toBe(false);
    expect(style.title.visible).toBe(false);
    expect(style.annotationsVisible).toBe(false);
    expect(style.xAxis.showTickLabels).toBe(true);
    expect(style.xAxis.showLabel).toBe(true);
  });

  it("creates a Teaching preset with grids, guides, markers, and labels", () => {
    const style = createTeachingGraphStyle(37.5);
    expect(style.presetOrigin).toBe("teaching");
    expect(style.horizontalGrid.visible).toBe(true);
    expect(style.verticalGrid.visible).toBe(true);
    expect(style.equivalenceGuides.showAll).toBe(true);
    expect(style.equivalenceGuides.marker.visible).toBe(true);
    expect(style.characteristicPoints.showAll).toBe(true);
    expect(style.characteristicPoints.marker.visible).toBe(true);
    expect(style.xAxis.showLabel).toBe(true);
    expect(style.yAxis.showLabel).toBe(true);
  });

  it("applies presets without mutating the source style", () => {
    const source = createDefaultGraphStyle(30);
    source.title = { visible: true, text: "Original" };
    const exam = applyExamPreset(source);
    const teaching = applyTeachingPreset(source);
    expect(source.title.visible).toBe(true);
    expect(exam.title.visible).toBe(false);
    expect(teaching).not.toBe(source);
    teaching.curve.color = "#ff0000";
    expect(source.curve.color).toBe("#000000");
  });
});
