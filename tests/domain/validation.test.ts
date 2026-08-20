import { describe, expect, it } from "vitest";

import { SUBSTANCES } from "../../src/chemistry/substances";
import type { TitrationInput } from "../../src/domain/titration";
import { validateTitrationInput } from "../../src/domain/validation";

const validInput: TitrationInput = {
  analyteSubstanceId: "hcl",
  analyteConcentrationMolL: 0.1,
  analyteVolumeMl: 20,
  titrantSubstanceId: "naoh",
  titrantConcentrationMolL: 0.1,
};

function errorCodes(input: TitrationInput): string[] {
  return validateTitrationInput(input, SUBSTANCES).errors.map(({ code }) => code);
}

describe("validateTitrationInput", () => {
  it("accepts a valid acid-base input", () => {
    expect(validateTitrationInput(validInput, SUBSTANCES)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it.each([
    ["analyte concentration", { analyteConcentrationMolL: 0 }],
    ["negative analyte concentration", { analyteConcentrationMolL: -0.1 }],
    ["titrant concentration", { titrantConcentrationMolL: 0 }],
  ])("rejects non-positive %s", (_label, override) => {
    expect(errorCodes({ ...validInput, ...override })).toContain(
      "non-positive-number",
    );
  });

  it("rejects a non-positive analyte volume", () => {
    expect(errorCodes({ ...validInput, analyteVolumeMl: 0 })).toContain(
      "non-positive-number",
    );
    expect(errorCodes({ ...validInput, analyteVolumeMl: -1 })).toContain(
      "non-positive-number",
    );
  });

  it.each([
    ["analyteConcentrationMolL", Number.NaN],
    ["analyteVolumeMl", Number.NaN],
    ["titrantConcentrationMolL", Number.NaN],
  ] as const)("rejects NaN for %s", (field, value) => {
    expect(errorCodes({ ...validInput, [field]: value })).toContain(
      "non-finite-number",
    );
  });

  it.each([
    ["analyteConcentrationMolL", Number.POSITIVE_INFINITY],
    ["analyteVolumeMl", Number.NEGATIVE_INFINITY],
    ["titrantConcentrationMolL", Number.POSITIVE_INFINITY],
  ] as const)("rejects Infinity for %s", (field, value) => {
    expect(errorCodes({ ...validInput, [field]: value })).toContain(
      "non-finite-number",
    );
  });

  it("rejects an acid-acid pair", () => {
    expect(
      errorCodes({
        ...validInput,
        analyteSubstanceId: "hcl",
        titrantSubstanceId: "hno3",
      }),
    ).toContain("incompatible-acid-base-pair");
  });

  it("rejects a base-base pair", () => {
    expect(
      errorCodes({
        ...validInput,
        analyteSubstanceId: "naoh",
        titrantSubstanceId: "koh",
      }),
    ).toContain("incompatible-acid-base-pair");
  });

  it("rejects the same substance on both sides", () => {
    expect(
      errorCodes({
        ...validInput,
        analyteSubstanceId: "hcl",
        titrantSubstanceId: "hcl",
      }),
    ).toContain("same-substance");
  });

  it.each(["analyteSubstanceId", "titrantSubstanceId"] as const)(
    "rejects an unknown %s",
    (field) => {
      expect(errorCodes({ ...validInput, [field]: "unknown" })).toContain(
        "unknown-substance",
      );
    },
  );

  it("returns field-specific messages that the UI can display", () => {
    const result = validateTitrationInput(
      { ...validInput, analyteVolumeMl: Number.NaN },
      SUBSTANCES,
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatchObject({
      code: "non-finite-number",
      field: "analyteVolumeMl",
    });
    expect(result.errors[0]?.message.length).toBeGreaterThan(0);
  });
});
