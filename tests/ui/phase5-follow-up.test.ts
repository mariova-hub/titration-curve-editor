import { describe, expect, it, vi } from "vitest";

import { calculateTitrationCurve } from "../../src/calculation";
import { renderTitrationSvg } from "../../src/rendering";
import { APP_TEMPLATE } from "../../src/ui/app";
import {
  createAppState,
  selectAspectRatioPreset,
  setAspectRatioLock,
  updateAspectRatioInput,
  updateFigureHeight,
  updateFigureWidth,
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

describe("Phase 5 follow-up Japanese UI", () => {
  it.each([
    "滴定曲線エディタ",
    "滴定条件",
    "試験問題",
    "教材",
    "曲線",
    "軸",
    "目盛り",
    "図のサイズ",
    "SVGを書き出す",
  ])("contains the user-facing label %s", (label) => {
    expect(APP_TEMPLATE).toContain(label);
  });

  it("contains Japanese line patterns and accessibility-facing text", () => {
    for (const label of ["実線", "破線", "点線", "一点鎖線", "滴定曲線の設定", "プレビュー"]) {
      expect(APP_TEMPLATE).toContain(label);
    }
  });
});

describe("aspect ratio state", () => {
  it.each([
    ["3:2", 720, 480],
    ["4:3", 720, 540],
    ["1:1", 720, 720],
  ] as const)("applies %s to a %d px width", (preset, width, expectedHeight) => {
    let state = selectAspectRatioPreset(createAppState(), preset);
    state = updateFigureWidth(state, width);
    expect(state.rendering.graphStyle.height).toBe(expectedHeight);
  });

  it("supports a custom 5:4 ratio and updates either dimension without recalculation", () => {
    const deps = dependencies();
    let state = createAppState(undefined, deps);
    const calculationCalls = deps.calculateCurve.mock.calls.length;
    const points = state.chemical.result?.points;
    state = setAspectRatioLock(state, true, deps);
    state = updateAspectRatioInput(state, "width", "5", deps);
    state = updateAspectRatioInput(state, "height", "4", deps);
    state = updateFigureWidth(state, 750, deps);
    expect(state.rendering.graphStyle.height).toBe(600);
    state = updateFigureHeight(state, 400, deps);
    expect(state.rendering.graphStyle.width).toBe(500);
    expect(state.rendering.aspectRatio.preset).toBe("custom");
    expect(state.chemical.result?.points).toBe(points);
    expect(deps.calculateCurve).toHaveBeenCalledTimes(calculationCalls);
    expect(deps.renderSvg.mock.calls.length).toBeGreaterThan(1);
  });

  it("keeps width and height independent while ratio lock is off", () => {
    let state = selectAspectRatioPreset(createAppState(), "3:2");
    state = setAspectRatioLock(state, false);
    state = updateFigureWidth(state, 800);
    expect(state.rendering.graphStyle).toMatchObject({ width: 800, height: 480 });
    state = updateFigureHeight(state, 600);
    expect(state.rendering.graphStyle).toMatchObject({ width: 800, height: 600 });
  });

  it.each(["", "0", "-1", "NaN", "Infinity"])("rejects invalid ratio input %j", (value) => {
    const initial = setAspectRatioLock(createAppState(), true);
    const state = updateAspectRatioInput(initial, "width", value);
    expect(state.rendering.aspectRatio.error).not.toBeNull();
    expect(state.rendering.graphStyle.width).toBe(initial.rendering.graphStyle.width);
    expect(state.rendering.graphStyle.height).toBe(initial.rendering.graphStyle.height);
  });

  it("reflects a locked ratio in SVG width, height, and viewBox", () => {
    const state = selectAspectRatioPreset(createAppState(), "4:3");
    expect(state.rendering.svgString).toContain('width="720" height="540" viewBox="0 0 720 540"');
  });
});

describe("typography UI state", () => {
  it("updates typography and SVG without recalculating or replacing curve points", () => {
    const deps = dependencies();
    const initial = createAppState(undefined, deps);
    const calculationCalls = deps.calculateCurve.mock.calls.length;
    const points = initial.chemical.result?.points;
    const state = updateGraphStyle(
      initial,
      (style) => ({
        ...style,
        typography: {
          tickLabelFontSize: 16,
          axisLabelFontSize: 20,
          titleFontSize: 28,
        },
      }),
      deps,
    );
    expect(state.chemical.result?.points).toBe(points);
    expect(deps.calculateCurve).toHaveBeenCalledTimes(calculationCalls);
    expect(state.rendering.svgString).toContain('data-role="tick-label"');
    expect(state.rendering.svgString).toContain('font-size="16"');
  });
});
