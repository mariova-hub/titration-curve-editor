import { describe, expect, it } from "vitest";

import { calculatePlotArea, createCoordinateTransform } from "../../src/rendering/geometry";
import { createDefaultGraphStyle } from "../../src/rendering/graph-styles";
import { linePatternToDashArray } from "../../src/rendering/line-patterns";
import { formatTickValue } from "../../src/rendering/numbers";
import {
  calculateNiceTickInterval,
  generateMinorTicks,
  generateTicks,
} from "../../src/rendering/ticks";
import { ptToUserUnits, USER_UNITS_PER_POINT } from "../../src/rendering/units";
import { escapeXml } from "../../src/rendering/xml";

describe("rendering numeric utilities", () => {
  it.each([
    [1, 4 / 3],
    [9, 12],
    [10.5, 14],
    [12, 16],
  ])("converts %s pt to %s SVG user units", (pt, expected) => {
    expect(ptToUserUnits(pt)).toBeCloseTo(expected, 12);
  });

  it("defines one centralized point conversion ratio", () => {
    expect(USER_UNITS_PER_POINT).toBe(96 / 72);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid point size %s",
    (pt) => expect(() => ptToUserUnits(pt)).toThrow(RangeError),
  );

  it("generates major ticks from integer indexes without accumulation artifacts", () => {
    expect(generateTicks(0, 14, 2)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(generateTicks(0, 10, 2.5)).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it("generates minor ticks without duplicating major ticks", () => {
    expect(generateMinorTicks(0, 6, 1, 2)).toEqual([1, 3, 5]);
  });

  it("selects nice X intervals targeting four to seven ticks", () => {
    expect(calculateNiceTickInterval(0, 30)).toBe(5);
    expect(calculateNiceTickInterval(0, 37.5)).toBe(10);
    expect(calculateNiceTickInterval(0, 14)).toBe(2.5);
  });

  it.each([
    [0, "0"],
    [-0, "0"],
    [5, "5"],
    [10, "10"],
    [2.5, "2.5"],
    [9.99999999999998, "10"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatTickValue(value)).toBe(expected);
  });
});

describe("rendering structural utilities", () => {
  it("maps all line patterns in one deterministic utility", () => {
    expect(linePatternToDashArray("solid")).toBeUndefined();
    expect(linePatternToDashArray("dashed")).toBe("8 4");
    expect(linePatternToDashArray("dotted")).toBe("1 3");
    expect(linePatternToDashArray("dash-dot")).toBe("8 3 1 3");
  });

  it("escapes XML text and attribute metacharacters", () => {
    expect(escapeXml(`A & B <C> "D" 'E'`)).toBe(
      "A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;",
    );
  });

  it("uses one coordinate transform for X and Y", () => {
    const style = createDefaultGraphStyle(30);
    const plot = calculatePlotArea(style);
    const transform = createCoordinateTransform(style, plot);
    expect(transform.xToPx(0)).toBe(plot.left);
    expect(transform.xToPx(30)).toBe(plot.right);
    expect(transform.yToPx(0)).toBe(plot.bottom);
    expect(transform.yToPx(14)).toBe(plot.top);
    expect(transform.pointToPx(15, 7)).toEqual({
      x: (plot.left + plot.right) / 2,
      y: (plot.top + plot.bottom) / 2,
    });
  });

  it("reduces margins when labels and tick labels are hidden", () => {
    const full = createDefaultGraphStyle(30);
    const compact = {
      ...full,
      xAxis: { ...full.xAxis, showLabel: false, showTickLabels: false },
      yAxis: { ...full.yAxis, showLabel: false, showTickLabels: false },
    };
    expect(calculatePlotArea(compact).width).toBeGreaterThan(calculatePlotArea(full).width);
    expect(calculatePlotArea(compact).height).toBeGreaterThan(calculatePlotArea(full).height);
  });
});
