import { describe, expect, it } from "vitest";

import {
  calculatePHDetailsAtVolume,
  calculateTitrationCurve,
  CalculationError,
} from "../../src/calculation";
import {
  normalizeSolutionTitrationInput,
  validateSolutionTitrationInput,
} from "../../src/chemistry";
import type {
  SolutionTitrationInput,
  TitrationCurveInput,
  TitrationInput,
} from "../../src/domain/titration";
import {
  FIXTURES,
  V12_CONTRACT_FIXTURES,
  V12_VALIDATION_CONTRACTS,
} from "../fixtures/titration-fixtures";

function solutionInput(
  substances: readonly string[],
  titrantSubstanceId = "hcl",
): SolutionTitrationInput {
  return {
    analyteSolution: {
      totalVolumeMl: 20,
      components: substances.map((substanceId, index) => ({
        componentId: `component-${index + 1}`,
        substanceId,
        concentrationMolL: 0.01 * (index + 1),
      })),
    },
    titrantSubstanceId,
    titrantConcentrationMolL: 0.1,
  };
}

function firstError(input: SolutionTitrationInput) {
  const result = validateSolutionTitrationInput(input);
  expect(result.valid).toBe(false);
  if (result.valid) throw new Error("Expected mixed input validation to fail.");
  return result.errors[0];
}

describe("v1.2 solution input normalization", () => {
  it("normalizes Fixture K common volume, amounts, titrant, and direction", () => {
    const fixture = V12_CONTRACT_FIXTURES.K;
    const input: TitrationCurveInput = fixture.input;
    expect("analyteSolution" in input).toBe(true);

    const normalized = normalizeSolutionTitrationInput(fixture.input);

    expect(normalized.analyteSolutionVolumeL).toBeCloseTo(0.02, 15);
    expect(normalized.components).toHaveLength(2);
    expect(
      normalized.components.map(
        ({ sourceComponentId, substanceId, concentrationMolL, amountMol }) => ({
          sourceComponentId,
          substanceId,
          concentrationMolL,
          amountMol,
        }),
      ),
    ).toEqual([
      {
        sourceComponentId: "analyte-carbonate",
        substanceId: "na2co3",
        concentrationMolL: 0.05,
        amountMol: 0.001,
      },
      {
        sourceComponentId: "analyte-hydroxide",
        substanceId: "naoh",
        concentrationMolL: 0.025,
        amountMol: 0.0005,
      },
    ]);
    expect(normalized.titrant).toMatchObject({
      substanceId: "hcl",
      concentrationMolL: 0.1,
      substance: { id: "hcl" },
    });
    expect(normalized.pairing).toMatchObject({
      status: "supported",
      direction: "protonation",
      analyteMode: "accept",
      titrantMode: "donate",
    });
  });

  it("supports more than two components in the domain", () => {
    const normalized = normalizeSolutionTitrationInput(
      solutionInput(["na2co3", "naoh", "koh"]),
    );

    expect(normalized.components).toHaveLength(3);
    expect(normalized.components.map(({ amountMol }) => amountMol)).toEqual([
      0.0002,
      0.0004,
      0.0006,
    ]);
    expect(normalized.pairing.direction).toBe("protonation");
  });
});

describe("v1.2 mixed validation", () => {
  it("returns the frozen duplicate code and message without merging", () => {
    const contract = V12_VALIDATION_CONTRACTS[0];
    if (contract.trigger.kind !== "solution-input") {
      throw new Error("Expected a solution-input contract.");
    }
    expect(firstError(contract.trigger.input)).toMatchObject({
      code: "duplicate-analyte-substance",
      message: "同じ分析物質を複数回追加することはできません。",
    });
  });

  it.each([
    ["HCl + NaOH", solutionInput(["hcl", "naoh"], "hno3")],
    ["NaHCO3 + NaOH", solutionInput(["nahco3", "naoh"], "hcl")],
  ])("rejects %s before titrant direction resolution", (_label, input) => {
    expect(firstError(input)).toMatchObject({
      code: "pre-equilibration-required",
      message:
        "この組み合わせは滴定前に分析物質どうしが反応するため、現在は対応していません。",
    });
  });

  it("allows Na2CO3 + NaOH without substance-name branching", () => {
    const result = validateSolutionTitrationInput(
      V12_CONTRACT_FIXTURES.K.input,
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.normalizedInput.pairing.direction).toBe("protonation");
  });

  it("reuses candidate-zero and ambiguous pairing codes", () => {
    expect(firstError(solutionInput(["na2co3"], "naoh")).code).toBe(
      "incompatible-acid-base-pair",
    );
    expect(firstError(solutionInput(["nahco3"], "nahco3")).code).toBe(
      "ambiguous-proton-transfer-direction",
    );
  });

  it("rejects multiple unaligned families after direction validation", () => {
    expect(firstError(solutionInput(["na2co3", "nh3"]))).toMatchObject({
      code: "unsupported-stage-grouping",
      message: "この混合組成の反応段階は現在の計算モデルでは扱えません。",
    });
  });

  it("rejects empty components and invalid numeric values", () => {
    const base = solutionInput(["na2co3"]);
    expect(firstError({
      ...base,
      analyteSolution: {
        ...base.analyteSolution,
        components: [],
      },
    }).code).toBe("invalid-analyte-component-count");
    expect(firstError({
      ...base,
      analyteSolution: { ...base.analyteSolution, totalVolumeMl: 0 },
    }).code).toBe("non-positive-number");
    expect(firstError({
      ...base,
      analyteSolution: {
        ...base.analyteSolution,
        components: [{
          ...base.analyteSolution.components[0]!,
          concentrationMolL: 0,
        }],
      },
    }).code).toBe("non-positive-number");
    expect(firstError({
      ...base,
      titrantConcentrationMolL: Number.NaN,
    }).code).toBe("non-finite-number");
  });

  it("rejects unknown substances and duplicate source component IDs deterministically", () => {
    expect(firstError(solutionInput(["missing"]))).toMatchObject({
      code: "unknown-substance",
      field: "analyteSolution.components.0.substanceId",
    });
    const duplicateSourceIds = solutionInput(["na2co3", "naoh"]);
    const components = duplicateSourceIds.analyteSolution.components.map(
      (component) => ({ ...component, componentId: "same-source" }),
    );
    expect(
      firstError({
        ...duplicateSourceIds,
        analyteSolution: { ...duplicateSourceIds.analyteSolution, components },
      }),
    ).toMatchObject({ code: "duplicate-source-component-id" });
    expect(firstError({
      ...solutionInput(["na2co3"]),
      titrantSubstanceId: "missing",
    })).toMatchObject({
      code: "unknown-substance",
      field: "titrantSubstanceId",
    });
    const emptySourceId = solutionInput(["na2co3"]);
    expect(firstError({
      ...emptySourceId,
      analyteSolution: {
        ...emptySourceId.analyteSolution,
        components: [{
          ...emptySourceId.analyteSolution.components[0]!,
          componentId: " ",
        }],
      },
    })).toMatchObject({ code: "invalid-source-component-id" });
  });

  it("rejects an object that mixes both discriminated input shapes", () => {
    const hybrid = {
      ...solutionInput(["na2co3"]),
      analyteSubstanceId: "hcl",
      analyteConcentrationMolL: 0.1,
      analyteVolumeMl: 20,
    };

    expect(firstError(hybrid)).toMatchObject({
      code: "invalid-titration-input-shape",
      message: "単一分析物質入力と混合分析溶液入力を同時に指定することはできません。",
    });
  });
});

describe("calculateTitrationCurve input dispatch", () => {
  it("keeps the existing TitrationInput path and result unchanged", () => {
    const input: TitrationInput = FIXTURES.A.input;
    const result = calculateTitrationCurve(input);

    expect(result.equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual([20]);
    expect(result.points.find(({ addedVolumeMl }) => addedVolumeMl === 20)?.pH)
      .toBeCloseTo(7, 3);
  });

  it("validates mixed input before dispatching it to the shared solver", () => {
    const result = calculateTitrationCurve(V12_CONTRACT_FIXTURES.K.input);
    expect(result.equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual([
      15,
      25,
    ]);
    expect(result.points.every(({ pH }) => Number.isFinite(pH))).toBe(true);

    const duplicate = V12_VALIDATION_CONTRACTS[0];
    if (duplicate.trigger.kind !== "solution-input") {
      throw new Error("Expected a solution-input contract.");
    }
    expect(() => calculateTitrationCurve(duplicate.trigger.input)).toThrowError(
      expect.objectContaining({
        code: "invalid-input",
        message: "同じ分析物質を複数回追加することはできません。",
      }),
    );
  });

  it("preserves legacy NaOH diagnostic identities", () => {
    const input: TitrationInput = {
      analyteSubstanceId: "naoh",
      analyteConcentrationMolL: 0.1,
      analyteVolumeMl: 20,
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: 0.1,
    };
    const details = calculatePHDetailsAtVolume(input, 5);

    expect(details.system.fixedIons.map(({ species }) => species.id)).toContain(
      "naoh.cation",
    );
    expect(
      details.chargeBalance.speciesConcentrations.map(({ speciesId }) => speciesId),
    ).toContain("naoh.cation");
    expect(() => calculateTitrationCurve(input)).not.toThrow();
    expect(CalculationError).toBeDefined();
  });
});
