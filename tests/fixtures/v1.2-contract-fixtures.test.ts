import { describe, expect, it } from "vitest";

import {
  calculateTitrationCurve,
  createCharacteristicPointsFromEquivalencePoints,
  createEquivalencePointsFromBoundaryPlan,
  planSolutionTitrationBoundaries,
} from "../../src/calculation";
import {
  normalizeSolutionTitrationInput,
  validateSolutionTitrationInput,
} from "../../src/chemistry";

import {
  V11_PH_TOLERANCE_DIGITS,
  V12_ACCESSIBILITY_CONTRACT,
  V12_API_CONTRACT,
  V12_CONTRACT_FIXTURES,
  V12_DIAGNOSTICS_CONTRACT,
  V12_PH_TOLERANCE_DIGITS,
  V12_VALIDATION_CONTRACTS,
} from "./titration-fixtures";

describe("v1.2 Phase 0 Fixture K contract", () => {
  const fixture = V12_CONTRACT_FIXTURES.K;

  it("contains exactly Fixture K as the v1.2 contract fixture", () => {
    expect(Object.keys(V12_CONTRACT_FIXTURES)).toEqual(["K"]);
    expect(fixture.id).toBe("K");
  });

  it("fixes the mixed input identity and concentrations", () => {
    expect(fixture.input).toEqual({
      analyteSolution: {
        totalVolumeMl: 20,
        components: [
          {
            componentId: "analyte-carbonate",
            substanceId: "na2co3",
            concentrationMolL: 0.05,
          },
          {
            componentId: "analyte-hydroxide",
            substanceId: "naoh",
            concentrationMolL: 0.025,
          },
        ],
      },
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: 0.1,
    });
  });

  it("fixes derived component amounts without a production compiler", () => {
    expect(fixture.expectedComponentAmountsMol).toEqual([
      {
        componentId: "analyte-carbonate",
        substanceId: "na2co3",
        amountMol: 0.001,
      },
      {
        componentId: "analyte-hydroxide",
        substanceId: "naoh",
        amountMol: 0.0005,
      },
    ]);
  });

  it("fixes equivalence and characteristic volumes", () => {
    expect(fixture.equivalenceVolumesMl).toEqual([15, 25]);
    expect(fixture.characteristicVolumesMl).toEqual([7.5, 20]);
  });

  it("fixes all five independent golden pH anchors", () => {
    expect(fixture.expectedPH).toEqual([
      { volumeMl: 0, pH: 12.4051254613 },
      { volumeMl: 7.5, pH: 10.7703912981 },
      { volumeMl: 15, pH: 8.3383516242 },
      { volumeMl: 20, pH: 6.3498931144 },
      { volumeMl: 25, pH: 4.0025793867 },
    ]);
    expect(fixture.expectedPH.every(({ pH }) => Number.isFinite(pH))).toBe(true);
  });

  it("keeps the v1.1 pH tolerance contract", () => {
    expect(V12_PH_TOLERANCE_DIGITS).toBe(3);
    expect(V12_PH_TOLERANCE_DIGITS).toBe(V11_PH_TOLERANCE_DIGITS);
  });

  it("fixes direction, exact anchors, refinement, guides, and auto range", () => {
    expect(fixture.expectedDirection).toBe("descending");
    expect(fixture.exactAnchorVolumesMl).toEqual([7.5, 15, 20, 25]);
    expect(fixture.refinementTargetVolumesMl).toEqual([15, 25]);
    expect(fixture.expectedEquivalenceGuideCount).toBe(2);
    expect(fixture.expectedAutoRangeMl).toBe(31.25);
  });

  it("keeps Fixture K metadata internally consistent", () => {
    const exactAnchors = [
      ...new Set([
        ...fixture.characteristicVolumesMl,
        ...fixture.equivalenceVolumesMl,
      ]),
    ].sort((left, right) => left - right);
    const goldenVolumes = new Set(fixture.expectedPH.map(({ volumeMl }) => volumeMl));
    const pHValues = fixture.expectedPH.map(({ pH }) => pH);

    expect(fixture.exactAnchorVolumesMl).toEqual(exactAnchors);
    expect(fixture.exactAnchorVolumesMl.every((volumeMl) => goldenVolumes.has(volumeMl))).toBe(
      true,
    );
    expect(
      pHValues.slice(1).every((pH, index) => pH < pHValues[index]!),
    ).toBe(true);
    expect(fixture.expectedEquivalenceGuideCount).toBe(
      fixture.equivalenceVolumesMl.length,
    );
  });

  it("records the independent golden calculation provenance", () => {
    expect(fixture.goldenPHProvenance).toEqual({
      method: "independent-decimal-bisection",
      productionModuleImported: false,
      temperatureC: 25,
      decimalPrecisionDigits: 80,
      bisectionIterations: 500,
      constants: {
        pKa1: 6.35,
        pKa2: 10.33,
        kw: 1e-14,
        carbonateSourceId: "usgs-carbonic-25c",
        kwSourceId: "KW_25C",
      },
      crossCheck: "independent-double-bisection",
    });
  });
});

describe("v1.2 Phase 0 API and diagnostics contracts", () => {
  it("selects the existing entry point with a discriminated input union", () => {
    expect(V12_API_CONTRACT).toEqual({
      strategy: "existing-entry-point-discriminated-union",
      entryPoint: "calculateTitrationCurve",
      legacyInputType: "TitrationInput",
      mixedInputType: "SolutionTitrationInput",
      unionInputType: "TitrationCurveInput",
      mixedSpecificEntryPoint: null,
      internalPipeline: "shared-composition-boundary-solver",
    });
  });

  it("freezes legacy single-input and mixed canonical diagnostic identities separately", () => {
    expect(V12_DIAGNOSTICS_CONTRACT).toEqual({
      legacySingleAnalyteNaoh: {
        speciesId: "naoh.cation",
        sourceSubstanceId: "naoh",
        exposedThrough: [
          "PHCalculationDetails.system.fixedIons",
          "PHCalculationDetails.chargeBalance.speciesConcentrations",
          "buildAnalyticalSystem",
          "evaluateChargeBalance",
        ],
        exposedInUi: false,
        exposedInTitrationResult: false,
      },
      mixedCanonicalSodium: {
        speciesId: "ion.na",
        provenance: "source-component-ids",
        exposeLegacyNaohCationId: false,
      },
      hydroxide: {
        fixedSpeciesId: null,
        diagnosticField: "hydroxideConcentrationMolL",
      },
    });
  });
});

describe("v1.2 Phase 0 validation contracts", () => {
  it("fixes runtime codes and Japanese UI messages", () => {
    expect(
      V12_VALIDATION_CONTRACTS.map(({ id, expectedCode, expectedMessage }) => ({
        id,
        expectedCode,
        expectedMessage,
      })),
    ).toEqual([
      {
        id: "duplicate-analyte-component",
        expectedCode: "duplicate-analyte-substance",
        expectedMessage: "同じ分析物質を複数回追加することはできません。",
      },
      {
        id: "pre-equilibration-required",
        expectedCode: "pre-equilibration-required",
        expectedMessage:
          "この組み合わせは滴定前に分析物質どうしが反応するため、現在は対応していません。",
      },
      {
        id: "unsupported-stage-grouping",
        expectedCode: "unsupported-stage-grouping",
        expectedMessage: "この混合組成の反応段階は現在の計算モデルでは扱えません。",
      },
      {
        id: "direction-ambiguity",
        expectedCode: "ambiguous-proton-transfer-direction",
        expectedMessage: "プロトン移動方向を一意に決定できません。",
      },
    ]);
  });

  it("keeps duplicate and pre-equilibration inputs as local fixtures", () => {
    const duplicate = V12_VALIDATION_CONTRACTS[0];
    const preEquilibration = V12_VALIDATION_CONTRACTS[1];

    expect(duplicate.trigger.kind).toBe("solution-input");
    expect(preEquilibration.trigger.kind).toBe("solution-input");
    if (
      duplicate.trigger.kind !== "solution-input" ||
      preEquilibration.trigger.kind !== "solution-input"
    ) {
      throw new Error("Expected local solution-input validation fixtures.");
    }
    expect(
      duplicate.trigger.input.analyteSolution.components.map(({ substanceId }) => substanceId),
    ).toEqual(["na2co3", "na2co3"]);
    expect(
      preEquilibration.trigger.input.analyteSolution.components.map(
        ({ substanceId }) => substanceId,
      ),
    ).toEqual(["hcl", "naoh"]);
  });

  it("keeps unsupported grouping and direction ambiguity as distinct contracts", () => {
    const grouping = V12_VALIDATION_CONTRACTS[2];
    const direction = V12_VALIDATION_CONTRACTS[3];

    expect(grouping.trigger.kind).toBe("solution-input");
    expect(direction.trigger).toEqual({
      kind: "component-direction-set",
      componentDirections: ["protonation", "deprotonation"],
    });
  });

  it("connects duplicate-analyte-substance to production mixed validation", () => {
    const contract = V12_VALIDATION_CONTRACTS[0];
    if (contract.trigger.kind !== "solution-input") throw new Error("Expected solution input");
    const result = validateSolutionTitrationInput(contract.trigger.input);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors[0]).toMatchObject({
      code: contract.expectedCode,
      message: contract.expectedMessage,
    });
  });

  it("connects pre-equilibration-required to production mixed validation", () => {
    const contract = V12_VALIDATION_CONTRACTS[1];
    if (contract.trigger.kind !== "solution-input") throw new Error("Expected solution input");
    const result = validateSolutionTitrationInput(contract.trigger.input);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors[0]).toMatchObject({
      code: contract.expectedCode,
      message: contract.expectedMessage,
    });
  });

  it("connects unsupported-stage-grouping to production mixed validation", () => {
    const contract = V12_VALIDATION_CONTRACTS[2];
    if (contract.trigger.kind !== "solution-input") throw new Error("Expected solution input");
    const result = validateSolutionTitrationInput(contract.trigger.input);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors[0]).toMatchObject({
      code: contract.expectedCode,
      message: contract.expectedMessage,
    });
  });

  it("reuses ambiguous-proton-transfer-direction for mixed direction conflicts", () => {
    const result = validateSolutionTitrationInput({
      analyteSolution: {
        totalVolumeMl: 20,
        components: [{
          componentId: "amphiprotic-analyte",
          substanceId: "nahco3",
          concentrationMolL: 0.05,
        }],
      },
      titrantSubstanceId: "nahco3",
      titrantConcentrationMolL: 0.1,
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors[0]).toMatchObject({
      code: "ambiguous-proton-transfer-direction",
      message: "プロトン移動方向を一意に決定できません。",
    });
  });
});

describe("v1.2 Phase 0 accessibility contracts", () => {
  it("preserves single-component accessible names and relative control order", () => {
    expect(V12_ACCESSIBILITY_CONTRACT.namingMechanism).toBe("visible-label-for");
    expect(V12_ACCESSIBILITY_CONTRACT.singleComponentAccessibleNames).toEqual({
      analyteSubstance: "物質",
      analyteConcentration: "モル濃度 mol/L",
      commonVolume: "体積 mL",
      titrantSubstance: "物質",
      titrantConcentration: "モル濃度 mol/L",
    });
    expect(V12_ACCESSIBILITY_CONTRACT.legacyControlRelativeOrder).toEqual([
      "analyte-substance",
      "analyte-concentration",
      "analyte-volume",
      "titrant-substance",
      "titrant-concentration",
    ]);
  });

  it("fixes two-component accessible names and focus return targets", () => {
    expect(V12_ACCESSIBILITY_CONTRACT.twoComponentAccessibleNames).toEqual([
      "分析物質 1",
      "分析物質 1 の濃度",
      "分析物質 2",
      "分析物質 2 の濃度",
      "分析物質を追加",
      "分析物質 2 を削除",
    ]);
    expect(V12_ACCESSIBILITY_CONTRACT.focusAfterAdd).toBe(
      "analyte-component-2-substance",
    );
    expect(V12_ACCESSIBILITY_CONTRACT.focusAfterDelete).toBe(
      "add-analyte-component",
    );
  });

  it.todo("connects the frozen accessible names and focus order to the mixed UI");
});

describe("v1.2 production integration contracts (Phase 1 and later)", () => {
  it("normalizes Fixture K through the mixed input compiler", () => {
    const normalized = normalizeSolutionTitrationInput(V12_CONTRACT_FIXTURES.K.input);
    expect(normalized.analyteSolutionVolumeL).toBe(0.02);
    expect(
      normalized.components.map(({ sourceComponentId, substanceId, amountMol }) => ({
        componentId: sourceComponentId,
        substanceId,
        amountMol,
      })),
    ).toEqual(V12_CONTRACT_FIXTURES.K.expectedComponentAmountsMol);
    expect(normalized.pairing.direction).toBe("protonation");
  });
  it("builds Fixture K boundaries and characteristics in the shared planner", () => {
    const normalized = normalizeSolutionTitrationInput(V12_CONTRACT_FIXTURES.K.input);
    const planned = planSolutionTitrationBoundaries(normalized);
    const equivalencePoints = createEquivalencePointsFromBoundaryPlan(
      planned,
      normalized.titrant.concentrationMolL,
    );
    const characteristicPoints =
      createCharacteristicPointsFromEquivalencePoints(equivalencePoints);

    expect(planned.boundaryPlan.stages.map((stage) => ({
      incremental: stage.incrementalEquivalentMoles,
      cumulative: stage.cumulativeEquivalentMoles,
    }))).toEqual([
      { incremental: 0.0015, cumulative: 0.0015 },
      { incremental: 0.001, cumulative: 0.0025 },
    ]);
    expect(equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual(
      V12_CONTRACT_FIXTURES.K.equivalenceVolumesMl,
    );
    expect(characteristicPoints.map(({ volumeMl }) => volumeMl)).toEqual(
      V12_CONTRACT_FIXTURES.K.characteristicVolumesMl,
    );
  });
  it("matches Fixture K golden pH in the shared solver", () => {
    const result = calculateTitrationCurve(V12_CONTRACT_FIXTURES.K.input);
    const pHByVolume = new Map(
      result.points.map(({ addedVolumeMl, pH }) => [addedVolumeMl, pH]),
    );

    for (const golden of V12_CONTRACT_FIXTURES.K.expectedPH) {
      expect(pHByVolume.get(golden.volumeMl)).toBeCloseTo(
        golden.pH,
        V12_PH_TOLERANCE_DIGITS,
      );
    }
  });
  it.todo("samples all Fixture K anchors and both refinement targets");
  it.todo("renders and exports two Fixture K equivalence guides");
  it.todo("uses 31.25 mL as Fixture K automatic range");
});
