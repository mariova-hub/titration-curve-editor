import type { TitrationInput } from "../../src/domain/titration";

export const REVERSE_TITRATION_INPUTS: readonly TitrationInput[] = [
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
