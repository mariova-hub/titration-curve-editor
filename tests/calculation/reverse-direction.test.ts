import { describe, expect, it } from "vitest";

import { calculateEquivalencePoints, calculatePHAtVolume } from "../../src/calculation";
import type { TitrationInput } from "../../src/domain/titration";

const reverseInputs: TitrationInput[] = [
  {
    analyteSubstanceId: "naoh",
    analyteConcentrationMolL: 0.1,
    analyteVolumeMl: 20,
    titrantSubstanceId: "hcl",
    titrantConcentrationMolL: 0.1,
  },
  {
    analyteSubstanceId: "naoh",
    analyteConcentrationMolL: 0.1,
    analyteVolumeMl: 20,
    titrantSubstanceId: "ch3cooh",
    titrantConcentrationMolL: 0.1,
  },
  {
    analyteSubstanceId: "hcl",
    analyteConcentrationMolL: 0.1,
    analyteVolumeMl: 20,
    titrantSubstanceId: "nh3",
    titrantConcentrationMolL: 0.1,
  },
  {
    analyteSubstanceId: "naoh",
    analyteConcentrationMolL: 0.1,
    analyteVolumeMl: 20,
    titrantSubstanceId: "h2c2o4",
    titrantConcentrationMolL: 0.05,
  },
];

describe("reverse titration through the shared solver", () => {
  it.each(reverseInputs)(
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
