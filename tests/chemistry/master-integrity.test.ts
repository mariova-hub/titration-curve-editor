import { describe, expect, it } from "vitest";

import { validateSubstanceMaster } from "../../src/chemistry/master-validation";
import { SUBSTANCES } from "../../src/chemistry/substances";

describe("substance master integrity", () => {
  it("satisfies all structural and source-metadata invariants", () => {
    expect(validateSubstanceMaster(SUBSTANCES)).toEqual([]);
  });

  it("has globally unique substance ids and family-local species ids", () => {
    expect(new Set(SUBSTANCES.map(({ id }) => id)).size).toBe(SUBSTANCES.length);
    for (const substance of SUBSTANCES) {
      if (substance.acidBaseModel.kind === "protonation-family") {
        const ids = substance.acidBaseModel.family.species.map(({ id }) => id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("does not attach fake Ka values to complete steps", () => {
    for (const substance of SUBSTANCES) {
      if (substance.acidBaseModel.kind === "protonation-family") {
        for (const step of substance.acidBaseModel.family.dissociationSteps) {
          if (step.mode === "complete") expect("ka" in step).toBe(false);
        }
      }
    }
  });
});
