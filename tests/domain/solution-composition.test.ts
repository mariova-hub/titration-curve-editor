import { describe, expect, it } from "vitest";

import type {
  CompiledSolutionComposition,
  DissolvedComposition,
  QuantifiedSolutionComponent,
} from "../../src/domain/solution-composition";

describe("solution composition domain", () => {
  it("keeps family input state and fixed ions as separate contributions", () => {
    const composition: DissolvedComposition = {
      familyComponents: [
        {
          familyId: "carbonate",
          initialSpeciesId: "h2co3.co3",
          stoichiometryPerFormulaUnit: 1,
        },
      ],
      fixedIons: [
        {
          speciesId: "ion.na",
          stoichiometryPerFormulaUnit: 2,
        },
      ],
    };

    expect(composition.familyComponents[0]).toEqual({
      familyId: "carbonate",
      initialSpeciesId: "h2co3.co3",
      stoichiometryPerFormulaUnit: 1,
    });
    expect(composition.fixedIons[0]).toEqual({
      speciesId: "ion.na",
      stoichiometryPerFormulaUnit: 2,
    });
    expect(composition.familyComponents[0]?.familyId).not.toBe(
      composition.familyComponents[0]?.initialSpeciesId,
    );
  });

  it("represents a single quantified component as a one-element array", () => {
    const components: QuantifiedSolutionComponent[] = [
      {
        sourceComponentId: "initial-component-1",
        substanceId: "substance-1",
        amountMol: 0.001,
      },
    ];

    expect(components).toHaveLength(1);
    expect(components[0]).toEqual({
      sourceComponentId: "initial-component-1",
      substanceId: "substance-1",
      amountMol: 0.001,
    });
    expect(components[0]).not.toHaveProperty("analyteSubstanceId");
    expect(components[0]).not.toHaveProperty("titrantSubstanceId");
  });

  it("represents multiple quantified components without a UI input model", () => {
    const components: QuantifiedSolutionComponent[] = [
      {
        sourceComponentId: "initial-component-1",
        substanceId: "substance-1",
        amountMol: 0.001,
      },
      {
        sourceComponentId: "initial-component-2",
        substanceId: "substance-2",
        amountMol: 0.0005,
      },
    ];

    expect(components).toHaveLength(2);
    expect(components.map(({ sourceComponentId }) => sourceComponentId)).toEqual([
      "initial-component-1",
      "initial-component-2",
    ]);
  });

  it("holds aggregated families, fixed ions, and capacity sources at solution level", () => {
    const compiled: CompiledSolutionComposition = {
      totalVolumeL: 0.02,
      familyAmounts: [
        {
          familyId: "carbonate",
          totalAmountMol: 0.001,
          contributions: [
            {
              sourceComponentId: "initial-component-1",
              initialSpeciesId: "h2co3.co3",
              amountMol: 0.001,
            },
          ],
        },
        {
          familyId: "phosphate",
          totalAmountMol: 0.0005,
          contributions: [
            {
              sourceComponentId: "initial-component-2",
              initialSpeciesId: "h3po4.h2po4",
              amountMol: 0.0005,
            },
          ],
        },
      ],
      fixedIonAmounts: [
        {
          speciesId: "ion.na",
          totalAmountMol: 0.0025,
          contributions: [
            { sourceComponentId: "initial-component-1", amountMol: 0.002 },
            { sourceComponentId: "initial-component-2", amountMol: 0.0005 },
          ],
        },
        {
          speciesId: "ion.k",
          totalAmountMol: 0.00025,
          contributions: [
            { sourceComponentId: "initial-component-3", amountMol: 0.00025 },
          ],
        },
      ],
      protonTransferSources: [
        {
          kind: "family",
          sourceComponentId: "initial-component-1",
          familyId: "carbonate",
          initialSpeciesId: "h2co3.co3",
          amountMol: 0.001,
        },
        {
          kind: "strong-hydroxide",
          sourceComponentId: "initial-component-2",
          amountMol: 0.0005,
          hydroxideStoichiometry: 1,
        },
      ],
    };

    expect(compiled.familyAmounts).toHaveLength(2);
    expect(compiled.fixedIonAmounts).toHaveLength(2);
    expect(compiled.fixedIonAmounts[0]?.contributions).toHaveLength(2);
    expect(compiled.protonTransferSources.map(({ kind }) => kind)).toEqual([
      "family",
      "strong-hydroxide",
    ]);
  });
});
