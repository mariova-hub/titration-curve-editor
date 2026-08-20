import { describe, expect, it, vi } from "vitest";

import { calculateTitrationCurve } from "../../src/calculation";
import { renderTitrationSvg } from "../../src/rendering";
import { APP_TEMPLATE } from "../../src/ui/app";
import {
  createAppState,
  updateGraphStyle,
  type AppDependencies,
} from "../../src/ui/state";

function dependencies(): AppDependencies & {
  calculateCurve: ReturnType<typeof vi.fn<AppDependencies["calculateCurve"]>>;
  renderSvg: ReturnType<typeof vi.fn<AppDependencies["renderSvg"]>>;
} {
  return {
    calculateCurve: vi.fn(calculateTitrationCurve),
    renderSvg: vi.fn(renderTitrationSvg),
  };
}

describe("Phase 5 follow-up 2 UI", () => {
  it.each([
    "目盛り線の方向",
    "外向き",
    "内向き",
    "両方向",
    "ラベル位置",
    "軸上の位置",
    "軸からの距離",
    "原点の0を表示",
    "ゴシック体",
    "明朝体",
    "MS ゴシック",
    "MS Pゴシック",
    "MS 明朝",
    "MS P明朝",
    "Century",
    "目盛り数値のフォント",
    "軸ラベルのフォント",
    "タイトルのフォント",
    "任意指定",
  ])("contains the Japanese control label %s", (label) => {
    expect(APP_TEMPLATE).toContain(label);
  });

  it("documents font fallback behavior in the UI", () => {
    expect(APP_TEMPLATE).toContain("SVGにフォントファイルは埋め込みません");
    expect(APP_TEMPLATE).toContain("代替フォント");
  });
});

describe("follow-up 2 style-only state updates", () => {
  it("changes tick direction, label position, zero label, and font without recalculation", () => {
    const deps = dependencies();
    const initial = createAppState(undefined, deps);
    const points = initial.chemical.result?.points;
    const calculationCalls = deps.calculateCurve.mock.calls.length;
    const state = updateGraphStyle(
      initial,
      (style) => ({
        ...style,
        xAxis: {
          ...style.xAxis,
          tickDirection: "inside",
          showZeroLabel: false,
          labelPosition: { mode: "custom", alongAxis: 0.75, offsetPx: 18 },
        },
        yAxis: { ...style.yAxis, tickDirection: "both", showZeroLabel: true },
        typography: {
          ...style.typography,
          tickLabelFontFamily: "Noto Sans JP",
          axisLabelFontFamily: "Noto Serif JP",
          titleFontFamily: "Arial",
        },
      }),
      deps,
    );
    expect(state.chemical.result?.points).toBe(points);
    expect(deps.calculateCurve).toHaveBeenCalledTimes(calculationCalls);
    expect(deps.renderSvg.mock.calls.length).toBeGreaterThan(1);
    expect(state.rendering.svgString).toContain('data-direction="inside"');
    expect(state.rendering.svgString).toContain('data-position-mode="custom"');
    expect(state.rendering.svgString).not.toContain('data-axis="x" data-value="0"');
    expect(state.rendering.svgString).toMatch(/data-role="tick-label"[^>]*font-family="Noto Sans JP"/);
    expect(state.rendering.svgString).toMatch(/data-role="axis-label"[^>]*font-family="Noto Serif JP"/);
  });

  it("applies three independent font families without recalculating curve points", () => {
    const deps = dependencies();
    const initial = createAppState(undefined, deps);
    const points = initial.chemical.result?.points;
    const calculationCalls = deps.calculateCurve.mock.calls.length;
    const state = updateGraphStyle(
      initial,
      (style) => ({
        ...style,
        title: { ...style.title, visible: true },
        typography: {
          ...style.typography,
          tickLabelFontFamily: '"Century", "Yu Mincho", "MS Mincho", serif',
          axisLabelFontFamily: '"MS Mincho", serif',
          titleFontFamily: '"MS Gothic", monospace',
        },
      }),
      deps,
    );

    expect(state.chemical.result?.points).toBe(points);
    expect(deps.calculateCurve).toHaveBeenCalledTimes(calculationCalls);
    expect(state.rendering.svgString).toMatch(
      /data-role="tick-label"[^>]*font-family="&quot;Century&quot;, &quot;Yu Mincho&quot;, &quot;MS Mincho&quot;, serif"/,
    );
    expect(state.rendering.svgString).toMatch(
      /data-role="axis-label"[^>]*font-family="&quot;MS Mincho&quot;, serif"/,
    );
    expect(state.rendering.svgString).toMatch(
      /data-role="title"[^>]*font-family="&quot;MS Gothic&quot;, monospace"/,
    );
  });
});
