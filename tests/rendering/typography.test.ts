import { describe, expect, it } from "vitest";

import type { GraphStyle } from "../../src/domain/graph-style";
import type { TitrationResult } from "../../src/domain/titration";
import { calculatePlotArea } from "../../src/rendering/geometry";
import {
  createExamGraphStyle,
  createTeachingGraphStyle,
  EXAM_TYPOGRAPHY,
  TEACHING_TYPOGRAPHY,
} from "../../src/rendering/graph-styles";
import { renderTitrationSvg } from "../../src/rendering/svg-renderer";

const result: TitrationResult = {
  points: [
    { addedVolumeMl: 0, pH: 1 },
    { addedVolumeMl: 30, pH: 12 },
  ],
  equivalencePoints: [],
  characteristicPoints: [],
};

function typographyStyle(): GraphStyle {
  const style = createExamGraphStyle(30);
  style.title = { visible: true, text: "滴定曲線" };
  style.typography = {
    tickLabelFontSize: 17,
    tickLabelFontFamily: "Arial, sans-serif",
    axisLabelFontSize: 23,
    axisLabelFontFamily: "Arial, sans-serif",
    titleFontSize: 31,
    titleFontFamily: "Arial, sans-serif",
  };
  return style;
}

describe("SVG typography", () => {
  it("uses independent tick, axis-label, and title font sizes", () => {
    const svg = renderTitrationSvg(result, typographyStyle());
    expect(svg).toMatch(/data-role="tick-label"[^>]*font-size="17"/);
    expect(svg).toMatch(/data-role="axis-label"[^>]*font-size="23"/);
    expect(svg).toMatch(/data-role="title"[^>]*font-size="31"/);
    expect(svg).toContain("滴下量 / mL");
  });

  it("increases the required margins when typography grows", () => {
    const small = typographyStyle();
    small.typography = {
      tickLabelFontSize: 8,
      tickLabelFontFamily: "Arial, sans-serif",
      axisLabelFontSize: 10,
      axisLabelFontFamily: "Arial, sans-serif",
      titleFontSize: 12,
      titleFontFamily: "Arial, sans-serif",
    };
    const large = typographyStyle();
    large.typography = {
      tickLabelFontSize: 30,
      tickLabelFontFamily: "Arial, sans-serif",
      axisLabelFontSize: 36,
      axisLabelFontFamily: "Arial, sans-serif",
      titleFontSize: 42,
      titleFontFamily: "Arial, sans-serif",
    };
    const smallPlot = calculatePlotArea(small);
    const largePlot = calculatePlotArea(large);
    expect(largePlot.left).toBeGreaterThan(smallPlot.left);
    expect(largePlot.top).toBeGreaterThan(smallPlot.top);
    expect(largePlot.bottom).toBeLessThan(smallPlot.bottom);
  });

  it.each([
    ["tickLabelFontSize", 0],
    ["axisLabelFontSize", Number.NaN],
    ["titleFontSize", Number.POSITIVE_INFINITY],
  ] as const)("rejects invalid %s", (property, value) => {
    const style = typographyStyle();
    style.typography[property] = value;
    expect(() => renderTitrationSvg(result, style)).toThrow();
  });

  it("defines explicit Exam and Teaching typography defaults", () => {
    expect(createExamGraphStyle(30).typography).toEqual(EXAM_TYPOGRAPHY);
    expect(createTeachingGraphStyle(30).typography).toEqual(TEACHING_TYPOGRAPHY);
    expect(TEACHING_TYPOGRAPHY.tickLabelFontSize).toBeGreaterThan(EXAM_TYPOGRAPHY.tickLabelFontSize);
  });
});
