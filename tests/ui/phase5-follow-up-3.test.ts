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
} {
  return {
    calculateCurve: vi.fn(calculateTitrationCurve),
    renderSvg: renderTitrationSvg,
  };
}

describe("Phase 5 follow-up 3 typography UI", () => {
  it("shows point units and 0.5 point steps for all typography sizes", () => {
    expect(APP_TEMPLATE.match(/<span>pt<\/span>/g)).toHaveLength(3);
    for (const id of [
      "tick-label-font-size",
      "axis-label-font-size",
      "title-font-size",
    ]) {
      expect(APP_TEMPLATE).toMatch(
        new RegExp(`id="${id}"[^>]*min="6"[^>]*max="48"[^>]*step="0\\.5"`),
      );
    }
  });

  it("starts with the Exam point-size preset", () => {
    expect(createAppState().rendering.graphStyle.typography).toMatchObject({
      tickLabelFontSizePt: 10.5,
      axisLabelFontSizePt: 10.5,
      titleFontSizePt: 13.5,
    });
  });

  it("accepts 10.5 pt without recalculating curve points", () => {
    const deps = dependencies();
    const initial = createAppState(undefined, deps);
    const points = initial.chemical.result?.points;
    const calculationCalls = deps.calculateCurve.mock.calls.length;
    const state = updateGraphStyle(
      initial,
      (style) => ({
        ...style,
        typography: { ...style.typography, tickLabelFontSizePt: 10.5 },
      }),
      deps,
    );

    expect(state.chemical.result?.points).toBe(points);
    expect(deps.calculateCurve).toHaveBeenCalledTimes(calculationCalls);
    expect(state.rendering.svgString).toMatch(
      /data-role="tick-label"[^>]*font-size="10\.5pt"/,
    );
  });
});
