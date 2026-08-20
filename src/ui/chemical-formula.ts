const SUBSCRIPT_DIGITS: Readonly<Record<string, string>> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

/** Converts digits for UI display without changing the canonical formula. */
export function formatChemicalFormulaForDisplay(formula: string): string {
  return formula.replace(/[0-9]/g, (digit) => SUBSCRIPT_DIGITS[digit] ?? digit);
}
