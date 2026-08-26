import { describe, expect, it } from "vitest";

import { calculatePHDetailsAtVolume } from "../../src/calculation";
import {
  adaptStrongHydroxideComposition,
  compileNormalizedAnalyteComposition,
  compileSolutionComposition,
  CompositionCompilerError,
  getFixedIonById,
  getSubstanceById,
  normalizeSolutionTitrationInput,
  SODIUM_FIXED_ION_ID,
  type CompositionCompilerLookup,
} from "../../src/chemistry";
import type { Substance } from "../../src/domain/chemistry";
import type { TitrationInput } from "../../src/domain/titration";
import { V12_CONTRACT_FIXTURES } from "../fixtures/titration-fixtures";

function requireStrongHydroxide(substanceId: string): Substance {
  const substance = getSubstanceById(substanceId);
  if (
    substance === undefined ||
    substance.acidBaseModel.kind !== "strong-hydroxide"
  ) {
    throw new Error(`Expected ${substanceId} to be a strong hydroxide.`);
  }
  return substance;
}

describe("v1.2 strong-hydroxide composition adapter", () => {
  it("adapts legacy complete-ion metadata to canonical fixed ion and capacity", () => {
    const substance = requireStrongHydroxide("naoh");
    const adapted = adaptStrongHydroxideComposition(substance, {
      sourceComponentId: "hydroxide-source",
      substanceId: substance.id,
      amountMol: 0.0005,
    });

    expect(adapted).toEqual({
      dissolvedComposition: {
        familyComponents: [],
        fixedIons: [
          {
            speciesId: SODIUM_FIXED_ION_ID,
            stoichiometryPerFormulaUnit: 1,
          },
        ],
      },
      protonTransferSource: {
        kind: "strong-hydroxide",
        sourceComponentId: "hydroxide-source",
        amountMol: 0.0005,
        hydroxideStoichiometry: 1,
      },
    });
    expect(
      adapted?.dissolvedComposition.fixedIons.some(
        ({ speciesId }) => String(speciesId) === "naoh.cation",
      ),
    ).toBe(false);
  });

  it("resolves by model and ion metadata rather than substance identity", () => {
    const source = requireStrongHydroxide("naoh");
    if (source.acidBaseModel.kind !== "strong-hydroxide") return;

    const genericSubstance: Substance = {
      ...source,
      id: "synthetic-strong-hydroxide",
      formula: "SyntheticOH",
      displayNameJa: "合成強塩基",
      acidBaseModel: {
        ...source.acidBaseModel,
        completeIons: source.acidBaseModel.completeIons.map((ion) =>
          ion.kind === "fixed"
            ? {
                ...ion,
                species: { ...ion.species, id: "synthetic.legacy-cation" },
              }
            : {
                ...ion,
                species: { ...ion.species, id: "synthetic.legacy-hydroxide" },
              },
        ),
      },
    };
    const component = {
      sourceComponentId: "generic-source",
      substanceId: genericSubstance.id,
      amountMol: 0.001,
    };
    const adapted = adaptStrongHydroxideComposition(
      genericSubstance,
      component,
    );

    expect(adapted?.dissolvedComposition.fixedIons).toEqual([
      {
        speciesId: SODIUM_FIXED_ION_ID,
        stoichiometryPerFormulaUnit: 1,
      },
    ]);

    const lookup: CompositionCompilerLookup = {
      getSubstanceById: (id) =>
        id === genericSubstance.id ? genericSubstance : undefined,
      getFixedIonById,
    };
    expect(
      compileSolutionComposition([component], 0.02, lookup).fixedIonAmounts,
    ).toEqual([
      {
        speciesId: SODIUM_FIXED_ION_ID,
        totalAmountMol: 0.001,
        contributions: [
          { sourceComponentId: "generic-source", amountMol: 0.001 },
        ],
      },
    ]);
  });

  it("fails closed when a legacy fixed ion has no canonical registry entry", () => {
    expect(() =>
      compileSolutionComposition(
        [
          {
            sourceComponentId: "potassium-source",
            substanceId: "koh",
            amountMol: 0.001,
          },
        ],
        0.02,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<CompositionCompilerError>>({
        code: "invalid-fixed-ion-reference",
      }),
    );
  });
});

describe("v1.2 Fixture K composition contract", () => {
  it("compiles carbonate and strong hydroxide into one canonical composition", () => {
    const normalized = normalizeSolutionTitrationInput(
      V12_CONTRACT_FIXTURES.K.input,
    );
    const compiled = compileNormalizedAnalyteComposition(normalized);

    expect(compiled.totalVolumeL).toBe(0.02);
    expect(compiled.familyAmounts).toEqual([
      {
        familyId: "carbonate",
        totalAmountMol: 0.001,
        contributions: [
          {
            sourceComponentId: "analyte-carbonate",
            initialSpeciesId: "h2co3.co3",
            amountMol: 0.001,
          },
        ],
      },
    ]);
    expect(compiled.fixedIonAmounts).toEqual([
      {
        speciesId: SODIUM_FIXED_ION_ID,
        totalAmountMol: 0.0025,
        contributions: [
          { sourceComponentId: "analyte-carbonate", amountMol: 0.002 },
          { sourceComponentId: "analyte-hydroxide", amountMol: 0.0005 },
        ],
      },
    ]);
    expect(compiled.protonTransferSources).toEqual([
      {
        kind: "family",
        sourceComponentId: "analyte-carbonate",
        familyId: "carbonate",
        initialSpeciesId: "h2co3.co3",
        amountMol: 0.001,
      },
      {
        kind: "strong-hydroxide",
        sourceComponentId: "analyte-hydroxide",
        amountMol: 0.0005,
        hydroxideStoichiometry: 1,
      },
    ]);
    expect(
      compiled.fixedIonAmounts.some(
        ({ speciesId }) => String(speciesId) === "naoh.cation",
      ),
    ).toBe(false);
    expect(compiled.fixedIonAmounts).toHaveLength(1);
    expect(compiled.fixedIonAmounts[0]?.totalAmountMol).toBe(0.0025);
  });
});

describe("v1.2 Phase 2 legacy diagnostics boundary", () => {
  it("preserves the single-analyte NaOH diagnostic species identity", () => {
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
      details.chargeBalance.speciesConcentrations.map(
        ({ speciesId }) => speciesId,
      ),
    ).toContain("naoh.cation");
  });
});
