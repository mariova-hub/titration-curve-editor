import { describe, expect, it } from "vitest";

import { calculateEquivalencePoints, calculatePHAtVolume } from "../../src/calculation";
import { REVERSE_TITRATION_INPUTS } from "../fixtures/reverse-titration-inputs";

describe("reverse titration through the shared solver", () => {
  it.each(REVERSE_TITRATION_INPUTS)(
    "$analyteSubstanceId + $titrantSubstanceId stays finite before, at, and after equivalence",
    (input) => {
      const equivalenceVolume = calculateEquivalencePoints(input)[0]?.volumeMl;
      if (equivalenceVolume === undefined) throw new Error("Missing equivalence point");
      const pHValues = [0, equivalenceVolume, equivalenceVolume * 1.1].map((volume) =>
        calculatePHAtVolume(input, volume),
      );
      expect(pHValues.every(Number.isFinite)).toBe(true);
    },
  );
});
