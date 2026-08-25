import { describe, expect, it } from "vitest";

import {
  compileSolutionComposition,
  CompositionCompilerError,
  type CompositionCompilerErrorCode,
  type CompositionCompilerLookup,
} from "../../src/chemistry/composition-compiler";
import { getFixedIonById } from "../../src/chemistry/fixed-ions";
import { getSubstanceById } from "../../src/chemistry/substances";
import type { Substance } from "../../src/domain/chemistry";
import type {
  DissolvedComposition,
  QuantifiedSolutionComponent,
} from "../../src/domain/solution-composition";

function expectCompilerError(
  action: () => unknown,
  code: CompositionCompilerErrorCode,
): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(CompositionCompilerError);
  if (!(thrown instanceof CompositionCompilerError)) return;
  expect(thrown.code).toBe(code);
}

function component(
  sourceComponentId: string,
  substanceId: string,
  amountMol: number,
): QuantifiedSolutionComponent {
  return { sourceComponentId, substanceId, amountMol };
}

function lookupFor(substance: Substance): CompositionCompilerLookup {
  return {
    getSubstanceById: (id) => id === substance.id ? substance : undefined,
    getFixedIonById,
  };
}

function substanceWithComposition(
  id: string,
  dissolvedComposition: DissolvedComposition,
): Substance {
  const source = getSubstanceById("na2co3");
  if (source === undefined) throw new Error("Missing Na2CO3 test source.");
  return { ...source, id, dissolvedComposition };
}

describe("solution composition compiler", () => {
  it("compiles one Na2CO3 component through the generic path", () => {
    const result = compileSolutionComposition(
      [component("source-carbonate", "na2co3", 0.001)],
      0.02,
    );

    expect(result.totalVolumeL).toBe(0.02);
    expect(result.familyAmounts).toEqual([
      {
        familyId: "carbonate",
        totalAmountMol: 0.001,
        contributions: [
          {
            sourceComponentId: "source-carbonate",
            initialSpeciesId: "h2co3.co3",
            amountMol: 0.001,
          },
        ],
      },
    ]);
    expect(result.fixedIonAmounts).toEqual([
      {
        speciesId: "ion.na",
        totalAmountMol: 0.002,
        contributions: [
          { sourceComponentId: "source-carbonate", amountMol: 0.002 },
        ],
      },
    ]);
    expect(result.protonTransferSources).toEqual([
      {
        kind: "family",
        sourceComponentId: "source-carbonate",
        familyId: "carbonate",
        initialSpeciesId: "h2co3.co3",
        amountMol: 0.001,
      },
    ]);
  });

  it("compiles one NaHCO3 component through the same generic path", () => {
    const result = compileSolutionComposition(
      [component("source-bicarbonate", "nahco3", 0.001)],
      0.02,
    );

    expect(result.familyAmounts).toEqual([
      {
        familyId: "carbonate",
        totalAmountMol: 0.001,
        contributions: [
          {
            sourceComponentId: "source-bicarbonate",
            initialSpeciesId: "h2co3.hco3",
            amountMol: 0.001,
          },
        ],
      },
    ]);
    expect(result.fixedIonAmounts).toEqual([
      {
        speciesId: "ion.na",
        totalAmountMol: 0.001,
        contributions: [
          { sourceComponentId: "source-bicarbonate", amountMol: 0.001 },
        ],
      },
    ]);
  });

  it("aggregates multiple sources without losing their initial species", () => {
    const result = compileSolutionComposition(
      [
        component("source-carbonate", "na2co3", 0.001),
        component("source-bicarbonate", "nahco3", 0.002),
      ],
      0.05,
    );

    expect(result.familyAmounts).toHaveLength(1);
    expect(result.familyAmounts[0]).toEqual({
      familyId: "carbonate",
      totalAmountMol: 0.003,
      contributions: [
        {
          sourceComponentId: "source-carbonate",
          initialSpeciesId: "h2co3.co3",
          amountMol: 0.001,
        },
        {
          sourceComponentId: "source-bicarbonate",
          initialSpeciesId: "h2co3.hco3",
          amountMol: 0.002,
        },
      ],
    });
    expect(result.fixedIonAmounts).toHaveLength(1);
    expect(result.fixedIonAmounts[0]).toEqual({
      speciesId: "ion.na",
      totalAmountMol: 0.004,
      contributions: [
        { sourceComponentId: "source-carbonate", amountMol: 0.002 },
        { sourceComponentId: "source-bicarbonate", amountMol: 0.002 },
      ],
    });
    expect(result.protonTransferSources).toHaveLength(2);
  });

  it.each([0, -0.02, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid total volume %s",
    (totalVolumeL) => {
      expectCompilerError(
        () => compileSolutionComposition(
          [component("source", "na2co3", 0.001)],
          totalVolumeL,
        ),
        "invalid-total-volume",
      );
    },
  );

  it.each([-0.001, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid component amount %s",
    (amountMol) => {
      expectCompilerError(
        () => compileSolutionComposition(
          [component("source", "na2co3", amountMol)],
          0.02,
        ),
        "invalid-component-amount",
      );
    },
  );

  it("accepts a zero amount as a valid component with no contributions", () => {
    expect(
      compileSolutionComposition(
        [component("zero-source", "na2co3", 0)],
        0.02,
      ),
    ).toEqual({
      totalVolumeL: 0.02,
      familyAmounts: [],
      fixedIonAmounts: [],
      protonTransferSources: [],
    });
  });

  it("rejects an empty component list and duplicate source ids", () => {
    expectCompilerError(
      () => compileSolutionComposition([], 0.02),
      "empty-component-list",
    );
    expectCompilerError(
      () => compileSolutionComposition(
        [
          component("duplicate", "na2co3", 0.001),
          component("duplicate", "nahco3", 0.001),
        ],
        0.02,
      ),
      "duplicate-source-component-id",
    );
  });

  it("rejects unknown substances and existing substances without composition", () => {
    expectCompilerError(
      () => compileSolutionComposition(
        [component("unknown-source", "unknown", 0.001)],
        0.02,
      ),
      "unknown-substance",
    );
    expectCompilerError(
      () => compileSolutionComposition(
        [component("legacy-source", "hcl", 0.001)],
        0.02,
      ),
      "missing-dissolved-composition",
    );
  });

  it("rejects an unknown fixed-ion registry reference", () => {
    const substance = substanceWithComposition("invalid-fixed-ion", {
      familyComponents: [
        {
          familyId: "carbonate",
          initialSpeciesId: "h2co3.co3",
          stoichiometryPerFormulaUnit: 1,
        },
      ],
      fixedIons: [
        { speciesId: "ion.unknown", stoichiometryPerFormulaUnit: 2 },
      ],
    });

    expectCompilerError(
      () => compileSolutionComposition(
        [component("invalid-fixed-source", substance.id, 0.001)],
        0.02,
        lookupFor(substance),
      ),
      "invalid-fixed-ion-reference",
    );
  });

  it.each([
    ["invalid-family", "unknown-family", "h2co3.co3", "invalid-family-reference"],
    ["invalid-species", "carbonate", "h2co3.unknown", "invalid-initial-species-reference"],
  ] as const)(
    "rejects broken family metadata for %s",
    (id, familyId, initialSpeciesId, errorCode) => {
      const substance = substanceWithComposition(id, {
        familyComponents: [
          {
            familyId,
            initialSpeciesId,
            stoichiometryPerFormulaUnit: 1,
          },
        ],
        fixedIons: [],
      });

      expectCompilerError(
        () => compileSolutionComposition(
          [component("invalid-family-source", substance.id, 0.001)],
          0.02,
          lookupFor(substance),
        ),
        errorCode,
      );
    },
  );

  it("rejects an invalid master coefficient instead of silently compiling it", () => {
    const substance = substanceWithComposition("invalid-coefficient", {
      familyComponents: [
        {
          familyId: "carbonate",
          initialSpeciesId: "h2co3.co3",
          stoichiometryPerFormulaUnit: 0,
        },
      ],
      fixedIons: [],
    });

    expectCompilerError(
      () => compileSolutionComposition(
        [component("invalid-coefficient-source", substance.id, 0.001)],
        0.02,
        lookupFor(substance),
      ),
      "invalid-composition-coefficient",
    );
  });
});
