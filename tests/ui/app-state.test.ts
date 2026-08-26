import { describe, expect, it, vi } from "vitest";
import { calculateTitrationCurve } from "../../src/calculation";
import { renderTitrationSvg } from "../../src/rendering";
import {
  applyPresetToState,
  canExportSvg,
  createAppState,
  DEFAULT_TITRATION_DRAFT,
  updateGraphStyle,
  updateTitrationDraft,
  updateXMax,
  type AppDependencies,
} from "../../src/ui";

function createDependencies(): AppDependencies & {
  calculateCurve: ReturnType<typeof vi.fn<AppDependencies["calculateCurve"]>>;
  renderSvg: ReturnType<typeof vi.fn<AppDependencies["renderSvg"]>>;
} {
  return {
    calculateCurve: vi.fn(calculateTitrationCurve),
    renderSvg: vi.fn(renderTitrationSvg),
  };
}

describe("Phase 5 application state", () => {
  it("creates a valid HCl/NaOH initial state with an Exam SVG preview", () => {
    const state = createAppState();

    expect(state.chemical.status).toBe("success");
    expect(state.chemical.validatedInput).toEqual({
      analyteSubstanceId: "hcl",
      analyteConcentrationMolL: 0.1,
      analyteVolumeMl: 20,
      titrantSubstanceId: "naoh",
      titrantConcentrationMolL: 0.1,
    });
    expect(state.chemical.result?.equivalencePoints).toHaveLength(1);
    expect(state.rendering.graphStyle.presetOrigin).toBe("exam");
    expect(state.rendering.svgString).toContain("<svg");
    expect(canExportSvg(state)).toBe(true);
  });

  it("keeps the last valid preview but disables export during partial invalid input", () => {
    const initial = createAppState();
    const svg = initial.rendering.svgString;
    const state = updateTitrationDraft(initial, "analyteConcentrationMolL", "");

    expect(state.chemical.status).toBe("invalid");
    expect(state.chemical.previewIsStale).toBe(true);
    expect(state.chemical.errors[0]?.field).toBe("analyteConcentrationMolL");
    expect(state.rendering.svgString).toBe(svg);
    expect(canExportSvg(state)).toBe(false);
  });

  it("reports acid plus acid through the domain validation path", () => {
    const state = updateTitrationDraft(createAppState(), "titrantSubstanceId", "hno3");

    expect(state.chemical.status).toBe("invalid");
    expect(state.chemical.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "incompatible-acid-base-pair" })]),
    );
  });

  it("applies Teaching preset without recalculating curve points", () => {
    const dependencies = createDependencies();
    const initial = createAppState({ ...DEFAULT_TITRATION_DRAFT }, dependencies);
    const points = initial.chemical.result?.points;
    const calculationCalls = dependencies.calculateCurve.mock.calls.length;
    const state = applyPresetToState(initial, "teaching", dependencies);

    expect(dependencies.calculateCurve).toHaveBeenCalledTimes(calculationCalls);
    expect(dependencies.renderSvg.mock.calls.length).toBeGreaterThan(1);
    expect(state.chemical.result?.points).toBe(points);
    expect(state.rendering.graphStyle.presetOrigin).toBe("teaching");
    expect(state.rendering.graphStyle.equivalenceGuides.showAll).toBe(true);
  });

  it("updates style and SVG without changing chemical result or recalculating", () => {
    const dependencies = createDependencies();
    const initial = createAppState({ ...DEFAULT_TITRATION_DRAFT }, dependencies);
    const result = initial.chemical.result;
    const calls = dependencies.calculateCurve.mock.calls.length;
    const state = updateGraphStyle(
      initial,
      (style) => ({ ...style, curve: { ...style.curve, width: 4, color: "#2255aa" } }),
      dependencies,
    );

    expect(dependencies.calculateCurve).toHaveBeenCalledTimes(calls);
    expect(state.chemical.result).toBe(result);
    expect(state.rendering.svgString).toContain('stroke="#2255aa"');
    expect(state.rendering.svgString).toContain('stroke-width="4"');
  });

  it("recalculates when a chemical input changes", () => {
    const dependencies = createDependencies();
    const initial = createAppState({ ...DEFAULT_TITRATION_DRAFT }, dependencies);
    const calls = dependencies.calculateCurve.mock.calls.length;
    const state = updateTitrationDraft(
      initial,
      "analyteConcentrationMolL",
      "0.200",
      dependencies,
    );

    expect(dependencies.calculateCurve).toHaveBeenCalledTimes(calls + 1);
    expect(state.chemical.status).toBe("success");
    expect(state.chemical.validatedInput).toMatchObject({
      analyteConcentrationMolL: 0.2,
    });
    expect(state.chemical.result).not.toBe(initial.chemical.result);
  });

  it("recalculates sampling when X max is changed manually", () => {
    const dependencies = createDependencies();
    const initial = createAppState({ ...DEFAULT_TITRATION_DRAFT }, dependencies);
    const state = updateXMax(initial, 40, dependencies);

    expect(state.rendering.xRangeMode).toBe("manual");
    expect(state.rendering.graphStyle.xMax).toBe(40);
    expect(state.chemical.result?.points.at(-1)?.addedVolumeMl).toBe(40);
    expect(dependencies.calculateCurve.mock.lastCall?.[1]).toEqual({ maxVolumeMl: 40 });
  });
});
