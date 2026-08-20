import { describe, expect, it, vi } from "vitest";

import { calculateTitrationCurve } from "../../src/calculation";
import { PNG_MIME_TYPE } from "../../src/export";
import { renderTitrationSvg } from "../../src/rendering";
import { APP_TEMPLATE } from "../../src/ui/app";
import { exportPngFromState } from "../../src/ui/png-export-action";
import {
  canExportPng,
  createAppState,
  updatePngExportOptions,
  updateTitrationDraft,
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

describe("PNG export UI and state", () => {
  it("provides Japanese controls for 1x, 2x, and 4x PNG export", () => {
    for (const text of [
      "PNGファイル名",
      "PNG出力倍率",
      "1倍",
      "2倍",
      "4倍",
      "PNG背景",
      "SVG設定を使用",
      "PNGを書き出す",
    ]) {
      expect(APP_TEMPLATE).toContain(text);
    }
  });

  it("defaults to 2x and preserved SVG background", () => {
    expect(createAppState().rendering.pngExportOptions).toEqual({
      scale: 2,
      background: "preserve",
    });
  });

  it("changes PNG settings without changing points or rerunning calculation/rendering", () => {
    const deps = dependencies();
    const initial = createAppState(undefined, deps);
    const points = initial.chemical.result?.points;
    const calculationCalls = deps.calculateCurve.mock.calls.length;
    const renderingCalls = deps.renderSvg.mock.calls.length;
    const state = updatePngExportOptions(initial, {
      scale: 4,
      background: "transparent",
    });
    expect(state.chemical.result?.points).toBe(points);
    expect(deps.calculateCurve).toHaveBeenCalledTimes(calculationCalls);
    expect(deps.renderSvg).toHaveBeenCalledTimes(renderingCalls);
  });

  it("exports the current SVG string without rerunning calculation or rendering", async () => {
    const deps = dependencies();
    const state = createAppState(undefined, deps);
    const calculationCalls = deps.calculateCurve.mock.calls.length;
    const renderingCalls = deps.renderSvg.mock.calls.length;
    const blob = new Blob(["png"], { type: PNG_MIME_TYPE });
    const convert = vi.fn(async () => blob);
    const download = vi.fn();
    await exportPngFromState(state, "curve.png", { convert, download });
    expect(convert).toHaveBeenCalledWith(
      state.rendering.svgString,
      state.rendering.pngExportOptions,
    );
    expect(download).toHaveBeenCalledWith(blob, "curve.png");
    expect(deps.calculateCurve).toHaveBeenCalledTimes(calculationCalls);
    expect(deps.renderSvg).toHaveBeenCalledTimes(renderingCalls);
  });

  it("rejects PNG export for a stale preview", async () => {
    const initial = createAppState();
    const stale = updateTitrationDraft(initial, "analyteConcentrationMolL", "");
    const convert = vi.fn(async () => new Blob(["png"], { type: PNG_MIME_TYPE }));
    expect(stale.chemical.previewIsStale).toBe(true);
    expect(canExportPng(stale)).toBe(false);
    await expect(
      exportPngFromState(stale, "curve.png", { convert, download: vi.fn() }),
    ).rejects.toThrow("current valid preview");
    expect(convert).not.toHaveBeenCalled();
  });
});
