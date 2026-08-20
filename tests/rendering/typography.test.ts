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
    tickLabelFontSizePt: 9,
    tickLabelFontFamily: "Arial, sans-serif",
    axisLabelFontSizePt: 10.5,
    axisLabelFontFamily: "Arial, sans-serif",
    titleFontSizePt: 13.5,
    titleFontFamily: "Arial, sans-serif",
  };
  return style;
}

describe("SVG typography", () => {
  it("uses independent tick, axis-label, and title font sizes", () => {
    const svg = renderTitrationSvg(result, typographyStyle());
    expect(svg).toMatch(/data-role="tick-label"[^>]*font-size="9pt"/);
    expect(svg).toMatch(/data-role="axis-label"[^>]*font-size="10\.5pt"/);
    expect(svg).toMatch(/data-role="title"[^>]*font-size="13\.5pt"/);
    expect([...svg.matchAll(/font-size="([^"]+)"/g)].every((match) => match[1]?.endsWith("pt"))).toBe(true);
    expect(svg).toContain("滴下量 / mL");
  });

  it("increases the required margins when typography grows", () => {
    const small = typographyStyle();
    small.typography = {
      tickLabelFontSizePt: 9,
      tickLabelFontFamily: "Arial, sans-serif",
      axisLabelFontSizePt: 9,
      axisLabelFontFamily: "Arial, sans-serif",
      titleFontSizePt: 9,
      titleFontFamily: "Arial, sans-serif",
    };
    const large = typographyStyle();
    large.typography = {
      tickLabelFontSizePt: 18,
      tickLabelFontFamily: "Arial, sans-serif",
      axisLabelFontSizePt: 18,
      axisLabelFontFamily: "Arial, sans-serif",
      titleFontSizePt: 18,
      titleFontFamily: "Arial, sans-serif",
    };
    const smallPlot = calculatePlotArea(small);
    const largePlot = calculatePlotArea(large);
    expect(largePlot.left).toBeGreaterThan(smallPlot.left);
    expect(largePlot.bottom).toBeLessThan(smallPlot.bottom);
  });

  it.each([
    ["tickLabelFontSizePt", 0],
    ["axisLabelFontSizePt", Number.NaN],
    ["titleFontSizePt", Number.POSITIVE_INFINITY],
  ] as const)("rejects invalid %s", (property, value) => {
    const style = typographyStyle();
    style.typography[property] = value;
    expect(() => renderTitrationSvg(result, style)).toThrow();
  });

  it("defines explicit Exam and Teaching typography defaults", () => {
    expect(createExamGraphStyle(30).typography).toEqual(EXAM_TYPOGRAPHY);
    expect(createTeachingGraphStyle(30).typography).toEqual(TEACHING_TYPOGRAPHY);
    expect(EXAM_TYPOGRAPHY).toMatchObject({
      tickLabelFontSizePt: 9,
      axisLabelFontSizePt: 10.5,
      titleFontSizePt: 13.5,
    });
    expect(TEACHING_TYPOGRAPHY).toMatchObject({
      tickLabelFontSizePt: 10,
      axisLabelFontSizePt: 11,
      titleFontSizePt: 14,
    });
    expect(TEACHING_TYPOGRAPHY.tickLabelFontSizePt).toBeGreaterThan(EXAM_TYPOGRAPHY.tickLabelFontSizePt);
  });
});
