import { describe, expect, it, vi } from "vitest";

import { calculateTitrationCurve } from "../../src/calculation";
import type { AxisLabelOrientation } from "../../src/domain/graph-style";
import { DEFAULT_PNG_EXPORT_OPTIONS } from "../../src/ui";
import {
  calculatePlotArea,
  createExamGraphStyle,
  FONT_FAMILY_PRESETS,
  renderTitrationSvg,
} from "../../src/rendering";
import type { TitrationResult } from "../../src/domain/titration";
import {
  createAppState,
  updateGraphStyle,
  type AppDependencies,
} from "../../src/ui/state";
import { APP_TEMPLATE } from "../../src/ui/app";

const result: TitrationResult = {
  points: [
    { addedVolumeMl: 0, pH: 1 },
    { addedVolumeMl: 30, pH: 12 },
  ],
  equivalencePoints: [],
  characteristicPoints: [],
};

function yAxisLabel(svg: string): string {
  return svg.match(/<text data-role="axis-label" data-axis="y"[^>]*>/)?.[0] ?? "";
}

function xAxisLabel(svg: string): string {
  return svg.match(/<text data-role="axis-label" data-axis="x"[^>]*>/)?.[0] ?? "";
}

function attribute(element: string, name: string): string | undefined {
  return element.match(new RegExp(`${name}="([^"]+)"`))?.[1];
}

function expectAbsoluteOrientation(
  label: string,
  orientation: AxisLabelOrientation,
): void {
  expect(label).toContain(`data-orientation="${orientation}"`);
  const transforms = label.match(/rotate\(/g) ?? [];
  if (orientation === "horizontal") {
    expect(label).not.toContain(" transform=");
    expect(transforms).toHaveLength(0);
    return;
  }
  const angle = orientation === "counterclockwise" ? -90 : 90;
  expect(attribute(label, "transform")).toBe(
    `rotate(${angle} ${attribute(label, "x")} ${attribute(label, "y")})`,
  );
  expect(transforms).toHaveLength(1);
}

describe("Phase 6 follow-up Exam preset", () => {
  it("defines the Word-oriented 4:3 figure and print-safe styling", () => {
    const style = createExamGraphStyle(30);
    expect(style).toMatchObject({ width: 320, height: 240, background: "white" });
    expect(style.typography).toMatchObject({
      tickLabelFontSizePt: 10.5,
      axisLabelFontSizePt: 10.5,
      titleFontSizePt: 13.5,
    });
    expect(style.curve).toMatchObject({ width: 2, color: "#000000", pattern: "solid" });
    expect(style.xAxis.line.width).toBe(2);
    expect(style.yAxis.line.width).toBe(2);
    expect(style.xAxis.tickWidth).toBe(1.5);
    expect(style.yAxis.tickWidth).toBe(1.5);
    expect(style.horizontalGrid.visible).toBe(false);
    expect(style.verticalGrid.visible).toBe(false);
    expect(style.title.visible).toBe(false);
    expect(style.equivalenceGuides.showAll).toBe(false);
    expect(style.characteristicPoints.showAll).toBe(false);
  });

  it("keeps PNG 2x as default and retains 4x support", async () => {
    expect(DEFAULT_PNG_EXPORT_OPTIONS.scale).toBe(2);
    const { PNG_EXPORT_SCALES } = await import("../../src/export");
    expect(PNG_EXPORT_SCALES).toEqual([1, 2, 4]);
  });
});

describe("Y-axis label orientation", () => {
  it.each([
    "horizontal",
    "counterclockwise",
    "clockwise",
  ] as const)("renders the absolute %s orientation in automatic mode", (labelOrientation) => {
    const style = createExamGraphStyle(30);
    style.yAxis.labelOrientation = labelOrientation;
    const label = yAxisLabel(renderTitrationSvg(result, style));
    expect(label).toContain('data-position-mode="auto"');
    expectAbsoluteOrientation(label, labelOrientation);
  });

  it.each(
    (["horizontal", "counterclockwise", "clockwise"] as const).flatMap(
      (orientation) => ([0, 0.5, 1] as const).map((alongAxis) => [orientation, alongAxis] as const),
    ),
  )(
    "uses the custom position for %s at alongAxis=%s",
    (labelOrientation, alongAxis) => {
      const style = createExamGraphStyle(30);
      style.yAxis.label = "Hydrogen ion concentration";
      style.yAxis.labelOrientation = labelOrientation;
      style.yAxis.labelPosition = { mode: "custom", alongAxis, offsetPx: 22 };
      style.typography.axisLabelFontFamily = FONT_FAMILY_PRESETS.msMincho;
      const plot = calculatePlotArea(style);
      const expectedX = plot.left - 22;
      const expectedY = plot.bottom - alongAxis * plot.height;
      const label = yAxisLabel(renderTitrationSvg(result, style));
      expect(Number(attribute(label, "x"))).toBeCloseTo(expectedX, 6);
      expect(Number(attribute(label, "y"))).toBeCloseTo(expectedY, 6);
      expectAbsoluteOrientation(label, labelOrientation);
      expect(label).toContain("&quot;MS Mincho&quot;, serif");
    },
  );

  it("keeps rotated margins and reserves extra horizontal label width", () => {
    const counterclockwise = createExamGraphStyle(30);
    counterclockwise.yAxis.label = "Hydrogen ion concentration";
    const clockwise = structuredClone(counterclockwise);
    clockwise.yAxis.labelOrientation = "clockwise";
    const horizontal = structuredClone(counterclockwise);
    horizontal.yAxis.labelOrientation = "horizontal";
    expect(calculatePlotArea(clockwise)).toEqual(calculatePlotArea(counterclockwise));
    expect(calculatePlotArea(horizontal).left).toBeGreaterThan(
      calculatePlotArea(counterclockwise).left,
    );
  });

  it("does not add a transform to the X-axis label", () => {
    const style = createExamGraphStyle(30);
    style.yAxis.labelOrientation = "clockwise";
    const label = xAxisLabel(renderTitrationSvg(result, style));
    expect(label).not.toContain("transform=");
  });

  it("is a style-only update that preserves CurvePoint identity", () => {
    const dependencies: AppDependencies & {
      calculateCurve: ReturnType<typeof vi.fn<AppDependencies["calculateCurve"]>>;
    } = {
      calculateCurve: vi.fn(calculateTitrationCurve),
      renderSvg: renderTitrationSvg,
    };
    const initial = createAppState(undefined, dependencies);
    const points = initial.chemical.result?.points;
    const calls = dependencies.calculateCurve.mock.calls.length;
    const updated = updateGraphStyle(
      initial,
      (style) => ({
        ...style,
        yAxis: { ...style.yAxis, labelOrientation: "horizontal" },
      }),
      dependencies,
    );
    expect(updated.chemical.result?.points).toBe(points);
    expect(dependencies.calculateCurve).toHaveBeenCalledTimes(calls);
    expect(yAxisLabel(updated.rendering.svgString ?? "")).not.toContain("transform=");
  });

  it("provides Japanese UI choices for all three orientations", () => {
    expect(APP_TEMPLATE).toContain("軸ラベルの向き");
    expect(APP_TEMPLATE).toContain("横書き");
    expect(APP_TEMPLATE).toContain("左に90°回転");
    expect(APP_TEMPLATE).toContain("右に90°回転");
  });
});
