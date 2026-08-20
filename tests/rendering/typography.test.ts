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
    axisLabelFontSize: 23,
    titleFontSize: 31,
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
    small.typography = { tickLabelFontSize: 8, axisLabelFontSize: 10, titleFontSize: 12 };
    const large = typographyStyle();
    large.typography = { tickLabelFontSize: 30, axisLabelFontSize: 36, titleFontSize: 42 };
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
