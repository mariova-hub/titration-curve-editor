import { describe, expect, it } from "vitest";
import { applyPresetToState, createAppState, type TitrationDraft } from "../../src/ui";

function count(svg: string, role: string): number {
  return svg.match(new RegExp(`data-role="${role}"`, "g"))?.length ?? 0;
}

describe("Phase 5 UI integration state", () => {
  it("calculates oxalic acid and renders every equivalence guide in Teaching preset", () => {
    const draft: TitrationDraft = {
      analyteSubstanceId: "h2c2o4",
      analyteConcentrationMolL: "0.0500",
      analyteVolumeMl: "20.0",
      titrantSubstanceId: "naoh",
      titrantConcentrationMolL: "0.100",
    };
    const state = applyPresetToState(createAppState(draft), "teaching");

    expect(state.chemical.status).toBe("success");
    expect(state.chemical.result?.equivalencePoints).toHaveLength(2);
    expect(state.chemical.result?.characteristicPoints).toHaveLength(2);
    expect(count(state.rendering.svgString ?? "", "equivalence-guide")).toBe(2);
    expect(count(state.rendering.svgString ?? "", "characteristic-guide")).toBe(2);
  });

  it("calculates and renders a descending NaOH/HCl reverse titration", () => {
    const draft: TitrationDraft = {
      analyteSubstanceId: "naoh",
      analyteConcentrationMolL: "0.100",
      analyteVolumeMl: "20.0",
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: "0.100",
    };
    const state = createAppState(draft);
    const points = state.chemical.result?.points ?? [];

    expect(state.chemical.status).toBe("success");
    expect(state.chemical.result?.equivalencePoints).toHaveLength(1);
    expect(points[0]?.pH).toBeGreaterThan(points.at(-1)?.pH ?? Number.POSITIVE_INFINITY);
    expect(state.rendering.svgString).toContain('data-role="titration-curve"');
  });
});
