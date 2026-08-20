import { describe, expect, it } from "vitest";

import type { GraphStyle } from "../../src/domain/graph-style";
import type { TitrationResult } from "../../src/domain/titration";
import { calculatePlotArea, createCoordinateTransform } from "../../src/rendering/geometry";
import { createDefaultGraphStyle, createTeachingGraphStyle } from "../../src/rendering/graph-styles";
import { formatSvgNumber } from "../../src/rendering/numbers";
import { renderTitrationSvg } from "../../src/rendering/svg-renderer";

const result: TitrationResult = {
  points: [
    { addedVolumeMl: 0, pH: 1 },
    { addedVolumeMl: 10, pH: 2 },
    { addedVolumeMl: 20, pH: 7 },
    { addedVolumeMl: 30, pH: 12 },
  ],
  equivalencePoints: [
    { id: "eq-1", order: 1, volumeMl: 10, pH: 2 },
    { id: "eq-2", order: 2, volumeMl: 20, pH: 7 },
    { id: "eq-out", order: 3, volumeMl: 40, pH: 12 },
  ],
  characteristicPoints: [
    { id: "half-1", type: "half-equivalence", order: 1, volumeMl: 5, pH: 1.5 },
    { id: "half-2", type: "half-equivalence", order: 2, volumeMl: 15, pH: 4.5 },
    { id: "half-out", type: "half-equivalence", order: 3, volumeMl: 35, pH: 10 },
  ],
};

function occurrences(svg: string, fragment: string): number {
  return svg.split(fragment).length - 1;
}

function defaultStyle(): GraphStyle {
  return createDefaultGraphStyle(30);
}

describe("SVG root, curve, and clipping", () => {
  it("renders a complete deterministic SVG root", () => {
    const style = defaultStyle();
    const first = renderTitrationSvg(result, style);
    const second = renderTitrationSvg(result, style);
    expect(second).toBe(first);
    expect(first.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(first).toContain('width="720" height="480" viewBox="0 0 720 480"');
    expect(first).toContain("<defs><clipPath id=\"titration-plot-");
    expect(first).not.toContain("NaN");
    expect(first).not.toContain("Infinity");
  });

  it("renders straight path segments through every source point", () => {
    const svg = renderTitrationSvg(result, defaultStyle());
    expect(svg).toContain('data-role="titration-curve"');
    expect(svg).toContain('data-source-point-count="4"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#000000" stroke-width="2"');
    expect(occurrences(svg.match(/ d="([^"]+)"/)?.[1] ?? "", "L ")).toBe(3);
  });

  it.each([
    ["solid", undefined],
    ["dashed", "8 4"],
    ["dotted", "1 3"],
    ["dash-dot", "8 3 1 3"],
  ] as const)("renders %s curve pattern", (pattern, dashArray) => {
    const style = defaultStyle();
    style.curve = { ...style.curve, pattern, color: "#123456", width: 3 };
    const svg = renderTitrationSvg(result, style);
    const path = svg.match(/<path data-role="titration-curve"[^>]+>/)?.[0] ?? "";
    expect(path).toContain('stroke="#123456"');
    expect(path).toContain('stroke-width="3"');
    if (dashArray === undefined) expect(path).not.toContain("stroke-dasharray");
    else expect(path).toContain(`stroke-dasharray="${dashArray}"`);
  });

  it("keeps out-of-range pH coordinates unchanged and clips only in SVG", () => {
    const style = defaultStyle();
    const outside: TitrationResult = {
      points: [
        { addedVolumeMl: 0, pH: -1 },
        { addedVolumeMl: 30, pH: 20 },
      ],
      equivalencePoints: [],
      characteristicPoints: [],
    };
    const expectedY = createCoordinateTransform(style).yToPx(20);
    const svg = renderTitrationSvg(outside, style);
    expect(outside.points[1]?.pH).toBe(20);
    expect(expectedY).toBeLessThan(calculatePlotArea(style).top);
    expect(svg).toContain(formatSvgNumber(expectedY));
    expect(svg).toContain('data-role="curve" clip-path="url(#titration-plot-');
  });

  it("uses deterministic but content-sensitive clip IDs", () => {
    const first = renderTitrationSvg(result, defaultStyle()).match(/<clipPath id="([^"]+)"/)?.[1];
    const changed = structuredClone(result);
    changed.points[1] = { addedVolumeMl: 10, pH: 3 };
    const second = renderTitrationSvg(changed, defaultStyle()).match(/<clipPath id="([^"]+)"/)?.[1];
    expect(first).toMatch(/^titration-plot-/);
    expect(second).not.toBe(first);
  });
});

describe("axes, ticks, grids, and labels", () => {
  it("renders X and Y axes with independent line styles", () => {
    const style = defaultStyle();
    style.xAxis.line = { visible: true, width: 2, pattern: "dashed", color: "#ff0000" };
    style.yAxis.line = { visible: true, width: 3, pattern: "dotted", color: "#0000ff" };
    const svg = renderTitrationSvg(result, style);
    const xAxis = svg.match(/<g data-role="x-axis">([\s\S]*?)<\/g>/)?.[1] ?? "";
    const yAxis = svg.match(/<g data-role="y-axis">([\s\S]*?)<\/g>/)?.[1] ?? "";
    expect(xAxis).toContain('stroke="#ff0000" stroke-width="2" stroke-dasharray="8 4"');
    expect(yAxis).toContain('stroke="#0000ff" stroke-width="3" stroke-dasharray="1 3"');
  });

  it("omits one axis and all of its labels independently", () => {
    const style = defaultStyle();
    style.xAxis = { ...style.xAxis, visible: false };
    const svg = renderTitrationSvg(result, style);
    expect(svg).not.toContain('data-role="x-axis"');
    expect(svg).not.toContain('data-axis="x"');
    expect(svg).toContain('data-role="y-axis"');
  });

  it("renders standard Y major ticks and labels without floating artifacts", () => {
    const svg = renderTitrationSvg(result, defaultStyle());
    expect(occurrences(svg, 'data-axis="y"')).toBe(9);
    for (const label of [0, 2, 4, 6, 8, 10, 12, 14]) {
      expect(svg).toContain(`data-axis="y"`);
      expect(svg).toContain(`>${label}</text>`);
    }
    expect(svg).not.toContain("5.999999999");
  });

  it("toggles minor ticks and major tick labels independently", () => {
    const style = defaultStyle();
    style.yAxis = {
      ...style.yAxis,
      minorTickInterval: 1,
      showMinorTicks: true,
      showTickLabels: false,
    };
    const svg = renderTitrationSvg(result, style);
    const yAxis = svg.match(/<g data-role="y-axis">([\s\S]*?)<\/g>/)?.[1] ?? "";
    expect(occurrences(yAxis, 'data-role="minor-tick"')).toBe(7);
    expect(svg).not.toContain('data-role="tick-label" data-axis="y"');
  });

  it("renders horizontal and vertical grids independently behind axes and curve", () => {
    const style = defaultStyle();
    style.horizontalGrid = {
      visible: true,
      line: { visible: true, width: 0.5, pattern: "dotted", color: "#aaaaaa" },
    };
    const svg = renderTitrationSvg(result, style);
    expect(svg).toContain('data-role="horizontal-grid-line"');
    expect(svg).not.toContain('data-role="vertical-grid-line"');
    expect(svg.indexOf('data-role="grid"')).toBeLessThan(svg.indexOf('data-role="axes"'));
    expect(svg.indexOf('data-role="grid"')).toBeLessThan(svg.indexOf('data-role="curve"'));
  });

  it("renders axis labels and escaped title only when enabled", () => {
    const style = defaultStyle();
    style.xAxis = { ...style.xAxis, label: `A & B < "C" 'D'` };
    style.title = { visible: true, text: `T & <X> "Q" 'R'` };
    const svg = renderTitrationSvg(result, style);
    expect(svg).toContain("A &amp; B &lt; &quot;C&quot; &apos;D&apos;");
    expect(svg).toContain("T &amp; &lt;X&gt; &quot;Q&quot; &apos;R&apos;");
    style.xAxis = { ...style.xAxis, showLabel: false };
    style.title = { ...style.title, visible: false };
    const hidden = renderTitrationSvg(result, style);
    expect(hidden).not.toContain("A &amp; B");
    expect(hidden).not.toContain('data-role="title"');
  });
});

describe("guides, markers, background, and validation", () => {
  it("renders all in-range equivalence and characteristic guides and markers", () => {
    const svg = renderTitrationSvg(result, createTeachingGraphStyle(30));
    expect(occurrences(svg, 'data-role="equivalence-guide"')).toBe(2);
    expect(occurrences(svg, 'data-role="characteristic-guide"')).toBe(2);
    expect(occurrences(svg, 'data-role="equivalence-marker"')).toBe(2);
    expect(occurrences(svg, 'data-role="characteristic-marker"')).toBe(2);
    expect(svg).not.toContain('data-id="eq-out"');
    expect(svg).not.toContain('data-id="half-out"');
  });

  it("supports all-off and ID-specific feature visibility", () => {
    const off = renderTitrationSvg(result, defaultStyle());
    expect(off).not.toContain('data-role="guides"');
    expect(off).not.toContain('data-role="markers"');

    const style = defaultStyle();
    style.equivalenceGuides = {
      ...style.equivalenceGuides,
      visibilityById: { "eq-2": true },
      marker: { ...style.equivalenceGuides.marker, visible: true },
    };
    const one = renderTitrationSvg(result, style);
    expect(one).toContain('data-id="eq-2"');
    expect(one).not.toContain('data-id="eq-1"');
  });

  it("renders white background and omits it for transparent style", () => {
    const white = renderTitrationSvg(result, defaultStyle());
    expect(white).toContain('<rect data-role="background"');
    const style = defaultStyle();
    style.background = "transparent";
    expect(renderTitrationSvg(result, style)).not.toContain('data-role="background"');
  });

  it("uses the documented layer order", () => {
    const svg = renderTitrationSvg(result, createTeachingGraphStyle(30));
    const roles = ["background", "grid", "guides", "axes", "curve", "markers", "labels"];
    const indexes = roles.map((role) => svg.indexOf(`data-role="${role}"`));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it.each([
    { change: (style: GraphStyle) => { style.width = 0; } },
    { change: (style: GraphStyle) => { style.height = Number.NaN; } },
    { change: (style: GraphStyle) => { style.xMax = style.xMin; } },
    { change: (style: GraphStyle) => { style.yMax = Number.POSITIVE_INFINITY; } },
    { change: (style: GraphStyle) => { style.curve.width = 0; } },
    { change: (style: GraphStyle) => { style.yAxis.majorTickInterval = 0; } },
  ])("rejects invalid GraphStyle", ({ change }) => {
    const style = defaultStyle();
    change(style);
    expect(() => renderTitrationSvg(result, style)).toThrow();
  });

  it("rejects empty, non-finite, and non-ascending curve data", () => {
    expect(() => renderTitrationSvg({ ...result, points: [] }, defaultStyle())).toThrow();
    expect(() => renderTitrationSvg({
      ...result,
      points: [{ addedVolumeMl: 0, pH: Number.NaN }],
    }, defaultStyle())).toThrow();
    expect(() => renderTitrationSvg({
      ...result,
      points: [
        { addedVolumeMl: 1, pH: 1 },
        { addedVolumeMl: 1, pH: 2 },
      ],
    }, defaultStyle())).toThrow();
  });
});
