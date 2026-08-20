import { describe, expect, it } from "vitest";

import type { TickDirection } from "../../src/domain/graph-style";
import type { TitrationResult } from "../../src/domain/titration";
import { calculatePlotArea } from "../../src/rendering/geometry";
import {
  createDefaultGraphStyle,
  createExamGraphStyle,
  createTeachingGraphStyle,
  FONT_FAMILY_PRESETS,
} from "../../src/rendering/graph-styles";
import { renderTitrationSvg } from "../../src/rendering/svg-renderer";
import { ptToUserUnits } from "../../src/rendering/units";

const result: TitrationResult = {
  points: [
    { addedVolumeMl: 0, pH: 1 },
    { addedVolumeMl: 30, pH: 12 },
  ],
  equivalencePoints: [],
  characteristicPoints: [],
};

function attribute(element: string, name: string): number {
  const value = element.match(new RegExp(`${name}="([^"]+)"`))?.[1];
  if (value === undefined) throw new Error(`Missing ${name} in ${element}`);
  return Number(value);
}

function axisGroup(svg: string, orientation: "x" | "y"): string {
  return svg.match(new RegExp(`<g data-role="${orientation}-axis">([\\s\\S]*?)</g>`))?.[1] ?? "";
}

function tickElement(
  svg: string,
  orientation: "x" | "y",
  role: "major-tick" | "minor-tick",
  value: string,
): string {
  const group = axisGroup(svg, orientation);
  return group.match(new RegExp(`<line data-role="${role}"[^>]*data-value="${value}"[^>]*/>`))?.[0] ?? "";
}

function axisLabel(svg: string, orientation: "x" | "y"): string {
  return svg.match(new RegExp(`<text data-role="axis-label" data-axis="${orientation}"[^>]*>`))?.[0] ?? "";
}

describe("tick direction rendering", () => {
  it.each([
    ["outside", 0, 6],
    ["inside", -6, 0],
    ["both", -3, 3],
  ] as const)("renders X %s ticks", (direction, startDelta, endDelta) => {
    const style = createDefaultGraphStyle(30);
    style.xAxis.tickDirection = direction;
    const plot = calculatePlotArea(style);
    const tick = tickElement(renderTitrationSvg(result, style), "x", "major-tick", "0");
    expect(tick).toContain(`data-direction="${direction}"`);
    expect(attribute(tick, "y1")).toBe(plot.bottom + startDelta);
    expect(attribute(tick, "y2")).toBe(plot.bottom + endDelta);
  });

  it.each([
    ["outside", -6, 0],
    ["inside", 0, 6],
    ["both", -3, 3],
  ] as const)("renders Y %s ticks", (direction, startDelta, endDelta) => {
    const style = createDefaultGraphStyle(30);
    style.yAxis.tickDirection = direction;
    const plot = calculatePlotArea(style);
    const tick = tickElement(renderTitrationSvg(result, style), "y", "major-tick", "0");
    expect(tick).toContain(`data-direction="${direction}"`);
    expect(attribute(tick, "x1")).toBe(plot.left + startDelta);
    expect(attribute(tick, "x2")).toBe(plot.left + endDelta);
  });

  it("keeps X and Y directions independent", () => {
    const style = createDefaultGraphStyle(30);
    style.xAxis.tickDirection = "inside";
    style.yAxis.tickDirection = "outside";
    const svg = renderTitrationSvg(result, style);
    expect(axisGroup(svg, "x")).toContain('data-direction="inside"');
    expect(axisGroup(svg, "x")).not.toContain('data-direction="outside"');
    expect(axisGroup(svg, "y")).toContain('data-direction="outside"');
    expect(axisGroup(svg, "y")).not.toContain('data-direction="inside"');
  });

  it.each(["outside", "inside", "both"] as const)(
    "applies %s to minor ticks",
    (tickDirection) => {
      const style = createDefaultGraphStyle(30);
      style.xAxis = {
        ...style.xAxis,
        tickDirection,
        showMinorTicks: true,
        minorTickInterval: 2.5,
      };
      const tick = tickElement(renderTitrationSvg(result, style), "x", "minor-tick", "2.5");
      expect(tick).toContain(`data-direction="${tickDirection}"`);
    },
  );

  it("uses outside extent in margins only for outside and both", () => {
    const style = createDefaultGraphStyle(30);
    const bottomFor = (tickDirection: TickDirection): number => {
      const changed = structuredClone(style);
      changed.xAxis.tickDirection = tickDirection;
      return calculatePlotArea(changed).bottom;
    };
    expect(bottomFor("inside")).toBe(bottomFor("outside") + 6);
    expect(bottomFor("both")).toBe(bottomFor("outside") + 3);
  });
});

describe("axis label positions", () => {
  it("preserves the existing automatic positions", () => {
    const style = createDefaultGraphStyle(30);
    const plot = calculatePlotArea(style);
    const svg = renderTitrationSvg(result, style);
    const xLabel = axisLabel(svg, "x");
    const yLabel = axisLabel(svg, "y");
    expect(xLabel).toContain('data-position-mode="auto"');
    expect(attribute(xLabel, "x")).toBe((plot.left + plot.right) / 2);
    const axisFontSize = ptToUserUnits(style.typography.axisLabelFontSizePt);
    expect(attribute(xLabel, "y")).toBe(style.height - Math.max(12, axisFontSize * 0.25 + 6));
    expect(attribute(yLabel, "x")).toBe(Math.max(18, axisFontSize + 4));
    expect(attribute(yLabel, "y")).toBe((plot.top + plot.bottom) / 2);
  });

  it.each([0, 0.5, 1])("places an X label at alongAxis=%s", (alongAxis) => {
    const style = createDefaultGraphStyle(30);
    style.xAxis.labelPosition = { mode: "custom", alongAxis, offsetPx: 24 };
    const plot = calculatePlotArea(style);
    const label = axisLabel(renderTitrationSvg(result, style), "x");
    expect(attribute(label, "x")).toBe(plot.left + alongAxis * plot.width);
    expect(attribute(label, "y")).toBe(plot.bottom + 24);
  });

  it.each([0, 0.5, 1])("places a Y label at alongAxis=%s with matching rotation center", (alongAxis) => {
    const style = createDefaultGraphStyle(30);
    style.yAxis.labelPosition = { mode: "custom", alongAxis, offsetPx: 26 };
    const plot = calculatePlotArea(style);
    const label = axisLabel(renderTitrationSvg(result, style), "y");
    const expectedX = plot.left - 26;
    const expectedY = plot.bottom - alongAxis * plot.height;
    expect(attribute(label, "x")).toBe(expectedX);
    expect(attribute(label, "y")).toBe(expectedY);
    expect(label).toContain(`transform="rotate(-90 ${expectedX} ${expectedY})"`);
  });

  it("uses a custom offset to reduce automatic label distance and adjusts margin", () => {
    const automatic = createDefaultGraphStyle(30);
    const custom = createDefaultGraphStyle(30);
    custom.xAxis.labelPosition = { mode: "custom", alongAxis: 0.5, offsetPx: 20 };
    expect(calculatePlotArea(custom).bottom).toBeGreaterThan(calculatePlotArea(automatic).bottom);
    const label = axisLabel(renderTitrationSvg(result, custom), "x");
    expect(attribute(label, "y")).toBe(calculatePlotArea(custom).bottom + 20);
  });

  it.each([
    { position: { mode: "custom", alongAxis: -0.1, offsetPx: 20 } },
    { position: { mode: "custom", alongAxis: 1.1, offsetPx: 20 } },
    { position: { mode: "custom", alongAxis: 0.5, offsetPx: -1 } },
  ] as const)("rejects invalid custom label position $position", ({ position }) => {
    const style = createDefaultGraphStyle(30);
    style.xAxis.labelPosition = position;
    expect(() => renderTitrationSvg(result, style)).toThrow();
  });
});

describe("independent zero labels", () => {
  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])("renders X=%s and Y=%s zero labels independently", (showX, showY) => {
    const style = createDefaultGraphStyle(30);
    style.xAxis.showZeroLabel = showX;
    style.yAxis.showZeroLabel = showY;
    const svg = renderTitrationSvg(result, style);
    expect(svg.includes('data-role="tick-label" data-axis="x" data-value="0"')).toBe(showX);
    expect(svg.includes('data-role="tick-label" data-axis="y" data-value="0"')).toBe(showY);
    expect(tickElement(svg, "x", "major-tick", "0")).not.toBe("");
    expect(tickElement(svg, "y", "major-tick", "0")).not.toBe("");
    expect(svg).toContain('data-role="tick-label" data-axis="x" data-value="5"');
    expect(svg).toContain('data-role="tick-label" data-axis="y" data-value="2"');
  });

  it("does not hide a small non-zero tick label", () => {
    const style = createDefaultGraphStyle(4e-12);
    style.xMin = 1e-12;
    style.xMax = 4e-12;
    style.xAxis.majorTickInterval = 1e-12;
    style.xAxis.showZeroLabel = false;
    const svg = renderTitrationSvg(result, style);
    expect(svg).toContain('data-role="tick-label" data-axis="x" data-value="1e-12"');
  });
});

describe("font-family rendering", () => {
  it("defines the Windows Japanese and Century font presets", () => {
    expect(FONT_FAMILY_PRESETS.msGothic).toBe('"MS Gothic", monospace');
    expect(FONT_FAMILY_PRESETS.msPGothic).toBe('"MS PGothic", sans-serif');
    expect(FONT_FAMILY_PRESETS.msMincho).toBe('"MS Mincho", serif');
    expect(FONT_FAMILY_PRESETS.msPMincho).toBe('"MS PMincho", serif');
    expect(FONT_FAMILY_PRESETS.century).toBe(
      '"Century", "Yu Mincho", "MS Mincho", serif',
    );
  });

  it.each(Object.entries(FONT_FAMILY_PRESETS))(
    "renders the %s font preset on tick labels",
    (_preset, fontFamily) => {
      const style = createDefaultGraphStyle(30);
      style.typography.tickLabelFontFamily = fontFamily;
      const svg = renderTitrationSvg(result, style);
      const escaped = fontFamily.replaceAll('"', "&quot;");
      expect(svg).toMatch(
        new RegExp(`data-role="tick-label"[^>]*font-family="${escaped}"`),
      );
    },
  );

  it("renders independent tick, axis-label, and title font families", () => {
    const style = createDefaultGraphStyle(30);
    style.title.visible = true;
    style.typography.tickLabelFontFamily = FONT_FAMILY_PRESETS.century;
    style.typography.axisLabelFontFamily = FONT_FAMILY_PRESETS.msMincho;
    style.typography.titleFontFamily = FONT_FAMILY_PRESETS.msGothic;
    const svg = renderTitrationSvg(result, style);
    expect(svg).toMatch(
      /data-role="tick-label"[^>]*font-family="&quot;Century&quot;, &quot;Yu Mincho&quot;, &quot;MS Mincho&quot;, serif"/,
    );
    expect(svg).toMatch(
      /data-role="axis-label"[^>]*font-family="&quot;MS Mincho&quot;, serif"/,
    );
    expect(svg).toMatch(
      /data-role="title"[^>]*font-family="&quot;MS Gothic&quot;, monospace"/,
    );
  });

  it("escapes custom font-family attributes independently", () => {
    const style = createDefaultGraphStyle(30);
    style.title.visible = true;
    style.typography.tickLabelFontFamily = "Tick & Font";
    style.typography.axisLabelFontFamily = 'Axis <Font> "A"';
    style.typography.titleFontFamily = "Title 'Font'";
    const svg = renderTitrationSvg(result, style);
    expect(svg).toMatch(/data-role="tick-label"[^>]*font-family="Tick &amp; Font"/);
    expect(svg).toMatch(
      /data-role="axis-label"[^>]*font-family="Axis &lt;Font&gt; &quot;A&quot;"/,
    );
    expect(svg).toMatch(/data-role="title"[^>]*font-family="Title &apos;Font&apos;"/);
  });

  it.each([
    "tickLabelFontFamily",
    "axisLabelFontFamily",
    "titleFontFamily",
  ] as const)("rejects an empty %s", (property) => {
    const style = createDefaultGraphStyle(30);
    style.typography[property] = "   ";
    expect(() => renderTitrationSvg(result, style)).toThrow();
  });

  it("defines deterministic Exam and Teaching font defaults", () => {
    for (const typography of [
      createExamGraphStyle(30).typography,
      createTeachingGraphStyle(30).typography,
    ]) {
      expect(typography.tickLabelFontFamily).toBe(FONT_FAMILY_PRESETS.sansSerif);
      expect(typography.axisLabelFontFamily).toBe(FONT_FAMILY_PRESETS.sansSerif);
      expect(typography.titleFontFamily).toBe(FONT_FAMILY_PRESETS.sansSerif);
    }
  });
});
