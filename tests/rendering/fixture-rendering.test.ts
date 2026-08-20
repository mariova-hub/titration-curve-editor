import { describe, expect, it } from "vitest";

import { calculateTitrationCurve } from "../../src/calculation";
import { createTeachingGraphStyle } from "../../src/rendering/graph-styles";
import { renderTitrationSvg } from "../../src/rendering/svg-renderer";
import { FIXTURES } from "../fixtures/titration-fixtures";

function occurrences(svg: string, fragment: string): number {
  return svg.split(fragment).length - 1;
}

describe("Fixture SVG rendering", () => {
  it.each([FIXTURES.A, FIXTURES.D, FIXTURES.F, FIXTURES.G])(
    "renders Fixture $id as finite publication SVG",
    (fixture) => {
      const result = calculateTitrationCurve(fixture.input);
      const maxVolumeMl = result.points.at(-1)?.addedVolumeMl;
      if (maxVolumeMl === undefined) throw new Error("Missing curve endpoint");
      const svg = renderTitrationSvg(result, createTeachingGraphStyle(maxVolumeMl));
      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('data-role="titration-curve"');
      expect(svg).toContain(`data-source-point-count="${result.points.length}"`);
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("Infinity");
    },
  );

  it("renders all three H3PO4 equivalence guides", () => {
    const result = calculateTitrationCurve(FIXTURES.F.input);
    const svg = renderTitrationSvg(result, createTeachingGraphStyle(37.5));
    expect(occurrences(svg, 'data-role="equivalence-guide"')).toBe(3);
    expect(occurrences(svg, 'data-role="equivalence-marker"')).toBe(3);
  });

  it("renders both H2C2O4 equivalence guides", () => {
    const result = calculateTitrationCurve(FIXTURES.D.input);
    const svg = renderTitrationSvg(result, createTeachingGraphStyle(25));
    expect(occurrences(svg, 'data-role="equivalence-guide"')).toBe(2);
    expect(occurrences(svg, 'data-role="equivalence-marker"')).toBe(2);
  });
});
