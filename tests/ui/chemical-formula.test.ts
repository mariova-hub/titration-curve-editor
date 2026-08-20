import { describe, expect, it } from "vitest";

import { SUBSTANCES } from "../../src/chemistry";
import { formatChemicalFormulaForDisplay } from "../../src/ui";

describe("chemical formula display formatting", () => {
  it.each([
    ["H2SO4", "H₂SO₄"],
    ["H2C2O4", "H₂C₂O₄"],
    ["H3PO4", "H₃PO₄"],
    ["Ca(OH)2", "Ca(OH)₂"],
    ["NH3", "NH₃"],
    ["CH3COOH", "CH₃COOH"],
    ["Ba(OH)2", "Ba(OH)₂"],
    ["HCl", "HCl"],
  ])("formats %s as %s for UI display", (canonical, displayed) => {
    expect(formatChemicalFormulaForDisplay(canonical)).toBe(displayed);
  });

  it("supports every decimal digit", () => {
    expect(formatChemicalFormulaForDisplay("0123456789")).toBe("₀₁₂₃₄₅₆₇₈₉");
  });

  it("does not modify canonical substance formulas", () => {
    expect(SUBSTANCES.map(({ formula }) => formula)).toEqual([
      "HCl",
      "HNO3",
      "H2SO4",
      "CH3COOH",
      "H2C2O4",
      "H2CO3",
      "H3PO4",
      "NaOH",
      "KOH",
      "Ca(OH)2",
      "Ba(OH)2",
      "NH3",
    ]);
  });
});
