import { describe, expect, it } from "vitest";

import {
  ACID_DISSOCIATION_CONSTANTS,
  KW_25C,
  NH3_KB_25C,
} from "../../src/chemistry/constants";

describe("chemistry constants", () => {
  it("fixes Kw at 1.0e-14 for 25 degrees Celsius", () => {
    expect(KW_25C).toBe(1.0e-14);
  });

  it("derives the ammonium Ka once from the reviewed ammonia Kb", () => {
    expect(NH3_KB_25C).toBe(2.3e-5);
    expect(ACID_DISSOCIATION_CONSTANTS.ammonium.value).toBe(KW_25C / NH3_KB_25C);
  });

  it("uses the high-school educational constants for acetic and oxalic acids", () => {
    expect(ACID_DISSOCIATION_CONSTANTS.aceticAcid.value).toBe(2.69e-5);
    expect(ACID_DISSOCIATION_CONSTANTS.oxalicAcid1.value).toBe(9.12e-2);
    expect(ACID_DISSOCIATION_CONSTANTS.oxalicAcid2.value).toBe(1.51e-4);
    expect(ACID_DISSOCIATION_CONSTANTS.aceticAcid.source.id).toBe(
      "chemical-handbook-basic-6-high-school-set",
    );
    expect(ACID_DISSOCIATION_CONSTANTS.oxalicAcid1.source.id).toBe(
      "chemical-handbook-basic-6-high-school-set",
    );
    expect(ACID_DISSOCIATION_CONSTANTS.oxalicAcid2.source.id).toBe(
      "chemical-handbook-basic-6-high-school-set",
    );
    expect(ACID_DISSOCIATION_CONSTANTS.ammonium.source.id).toBe(
      "chemical-handbook-basic-6-high-school-set",
    );
  });

  it("keeps the reviewed sulfate, carbonate, and phosphate values unchanged", () => {
    expect(ACID_DISSOCIATION_CONSTANTS.hso4.value).toBe(10 ** -1.983);
    expect(ACID_DISSOCIATION_CONSTANTS.carbonicAcid1.value).toBe(10 ** -6.35);
    expect(ACID_DISSOCIATION_CONSTANTS.carbonicAcid2.value).toBe(10 ** -10.33);
    expect(ACID_DISSOCIATION_CONSTANTS.phosphoricAcid1.value).toBe(10 ** -2.148);
    expect(ACID_DISSOCIATION_CONSTANTS.phosphoricAcid2.value).toBe(6.46e-8);
    expect(ACID_DISSOCIATION_CONSTANTS.phosphoricAcid3.value).toBe(4.47e-13);
  });
});
