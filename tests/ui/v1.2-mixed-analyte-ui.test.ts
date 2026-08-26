import { describe, expect, it } from "vitest";

import { APP_TEMPLATE } from "../../src/ui/app";
import {
  addAnalyteComponent,
  createAppState,
  createSubstanceSelectionGroups,
  hasSecondAnalyteComponent,
  parseTitrationDraft,
  removeSecondAnalyteComponent,
  type TitrationDraft,
} from "../../src/ui";

const fixtureKDraft: TitrationDraft = {
  analyteSubstanceId: "na2co3",
  analyteConcentrationMolL: "0.0500",
  analyteVolumeMl: "20.0",
  analyteComponent2SubstanceId: "naoh",
  analyteComponent2ConcentrationMolL: "0.0250",
  titrantSubstanceId: "hcl",
  titrantConcentrationMolL: "0.100",
};

describe("v1.2 mixed analyte UI state", () => {
  it("defaults to the legacy single input shape", () => {
    const state = createAppState();
    const parsed = parseTitrationDraft(state.chemical.draft);

    expect(hasSecondAnalyteComponent(state.chemical.draft)).toBe(false);
    expect(parsed).toEqual({
      ok: true,
      input: {
        analyteSubstanceId: "hcl",
        analyteConcentrationMolL: 0.1,
        analyteVolumeMl: 20,
        titrantSubstanceId: "naoh",
        titrantConcentrationMolL: 0.1,
      },
    });
  });

  it("adds only one second component and removes it without losing component 1", () => {
    const initial = createAppState({
      analyteSubstanceId: "na2co3",
      analyteConcentrationMolL: "0.0500",
      analyteVolumeMl: "20.0",
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: "0.100",
    });
    const added = addAnalyteComponent(initial);
    const secondAdd = addAnalyteComponent(added);
    const removed = removeSecondAnalyteComponent(added);

    expect(hasSecondAnalyteComponent(added.chemical.draft)).toBe(true);
    expect(secondAdd).toBe(added);
    expect(hasSecondAnalyteComponent(removed.chemical.draft)).toBe(false);
    expect(removed.chemical.draft).toMatchObject({
      analyteSubstanceId: "na2co3",
      analyteConcentrationMolL: "0.0500",
      analyteVolumeMl: "20.0",
    });
  });

  it("builds Fixture K as SolutionTitrationInput and reaches Preview", () => {
    const parsed = parseTitrationDraft(fixtureKDraft);
    const state = createAppState(fixtureKDraft);

    expect(parsed).toEqual({
      ok: true,
      input: {
        analyteSolution: {
          totalVolumeMl: 20,
          components: [
            {
              componentId: "analyte-component-1",
              substanceId: "na2co3",
              concentrationMolL: 0.05,
            },
            {
              componentId: "analyte-component-2",
              substanceId: "naoh",
              concentrationMolL: 0.025,
            },
          ],
        },
        titrantSubstanceId: "hcl",
        titrantConcentrationMolL: 0.1,
      },
    });
    expect(state.chemical.status).toBe("success");
    expect(state.chemical.result?.equivalencePoints.map(({ volumeMl }) =>
      volumeMl
    )).toEqual([15, 25]);
    expect(state.rendering.svgString).toContain("<svg");
  });
});

describe("v1.2 mixed validation presentation", () => {
  it("shows the frozen duplicate message without changing either selection", () => {
    const state = createAppState({
      ...fixtureKDraft,
      analyteComponent2SubstanceId: "na2co3",
    });

    expect(state.chemical.status).toBe("invalid");
    expect(state.chemical.draft.analyteSubstanceId).toBe("na2co3");
    expect(state.chemical.draft.analyteComponent2SubstanceId).toBe("na2co3");
    expect(state.chemical.errors).toContainEqual({
      code: "duplicate-analyte-substance",
      field: "analyteComponent2SubstanceId",
      message: "同じ分析物質を複数回追加することはできません。",
    });
  });

  it("shows the frozen pre-equilibration message from production validation", () => {
    const state = createAppState({
      ...fixtureKDraft,
      analyteSubstanceId: "hcl",
      analyteComponent2SubstanceId: "naoh",
      titrantSubstanceId: "hno3",
    });

    expect(state.chemical.errors).toContainEqual({
      code: "pre-equilibration-required",
      field: "substancePair",
      message:
        "この組み合わせは滴定前に分析物質どうしが反応するため、現在は対応していません。",
    });
  });

  it("shows unsupported grouping through the existing error summary", () => {
    const state = createAppState({
      ...fixtureKDraft,
      analyteComponent2SubstanceId: "nh3",
    });

    expect(state.chemical.errors).toContainEqual({
      code: "unsupported-stage-grouping",
      field: "substancePair",
      message: "この混合組成の反応段階は現在の計算モデルでは扱えません。",
    });
  });

});

describe("v1.2 mixed analyte DOM contract", () => {
  it("keeps single labels and declares the mixed labels and focus targets", () => {
    for (const text of [
      ">物質</label>",
      "モル濃度 <span>mol/L</span>",
      "分析物質 2</label>",
      "分析物質 2 の濃度</label>",
      ">分析物質を追加</button>",
      ">分析物質 2 を削除</button>",
    ]) {
      expect(APP_TEMPLATE).toContain(text);
    }
    expect(APP_TEMPLATE).toContain('id="analyte-component-2"');
    expect(APP_TEMPLATE).toContain("hidden");
  });

  it("places both component controls before the one common volume control", () => {
    const firstSubstance = APP_TEMPLATE.indexOf('id="analyte-substance"');
    const firstConcentration = APP_TEMPLATE.indexOf('id="analyte-concentration"');
    const secondSubstance = APP_TEMPLATE.indexOf(
      'id="analyte-component-2-substance"',
    );
    const secondConcentration = APP_TEMPLATE.indexOf(
      'id="analyte-component-2-concentration"',
    );
    const commonVolume = APP_TEMPLATE.indexOf('id="analyte-volume"');

    expect(firstSubstance).toBeLessThan(firstConcentration);
    expect(firstConcentration).toBeLessThan(secondSubstance);
    expect(secondSubstance).toBeLessThan(secondConcentration);
    expect(secondConcentration).toBeLessThan(commonVolume);
    expect(APP_TEMPLATE.match(/id="analyte-volume"/g)).toHaveLength(1);
  });

  it("reuses the same fourteen-option presentation model", () => {
    const options = createSubstanceSelectionGroups().flatMap(
      ({ options: groupOptions }) => groupOptions,
    );
    expect(options).toHaveLength(14);
    expect(new Set(options.map(({ id }) => id)).size).toBe(14);
  });
});
