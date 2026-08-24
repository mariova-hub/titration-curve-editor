import { describe, expect, it } from "vitest";

import {
  FIXED_IONS,
  getFixedIonById,
  SODIUM_FIXED_ION_ID,
} from "../../src/chemistry/fixed-ions";
import { getSubstanceById } from "../../src/chemistry/substances";

describe("fixed-ion registry", () => {
  it("registers canonical sodium with charge +1", () => {
    expect(SODIUM_FIXED_ION_ID).toBe("ion.na");
    expect(getFixedIonById(SODIUM_FIXED_ION_ID)).toEqual({
      id: "ion.na",
      formula: "Na+",
      charge: 1,
      boundProtonCount: 0,
    });
  });

  it("keeps every canonical fixed-ion id unique", () => {
    const ids = FIXED_IONS.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns undefined for an unknown id", () => {
    expect(getFixedIonById("ion.unknown")).toBeUndefined();
  });

  it("does not migrate the existing NaOH diagnostic species id", () => {
    const sodiumHydroxide = getSubstanceById("naoh");

    if (
      sodiumHydroxide === undefined ||
      sodiumHydroxide.acidBaseModel.kind !== "strong-hydroxide"
    ) {
      throw new Error("Expected the existing NaOH strong-hydroxide model.");
    }

    expect(getFixedIonById("naoh.cation")).toBeUndefined();
    expect(FIXED_IONS.map(({ id }) => id)).not.toContain("naoh.cation");
    expect(
      sodiumHydroxide.acidBaseModel.completeIons.find(({ kind }) => kind === "fixed")
        ?.species.id,
    ).toBe("naoh.cation");
    expect(sodiumHydroxide.dissolvedComposition).toBeUndefined();
  });
});
