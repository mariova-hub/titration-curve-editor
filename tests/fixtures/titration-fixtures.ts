import type { TitrationInput } from "../../src/domain/titration";

export interface TitrationFixture<TInput> {
  id: string;
  description: string;
  input: TInput;
  equivalenceVolumesMl: readonly number[];
  expectedPH: ReadonlyArray<{ volumeMl: number; pH: number }>;
}

export type RegressionFixture = TitrationFixture<TitrationInput>;

export type CurveDirection = "ascending" | "descending";

export interface V11PairingContract {
  status: "supported";
  basis: "derived-capability";
  protonTransferDirection: "protonation" | "deprotonation";
}

export interface V11ContractFixture extends TitrationFixture<TitrationInput> {
  characteristicVolumesMl: readonly number[];
  expectedDirection: CurveDirection;
  exactAnchorVolumesMl: readonly number[];
  refinementTargetVolumesMl: readonly number[];
  expectedEquivalenceGuideCount: number;
  pairing: V11PairingContract;
}

export const V11_PH_TOLERANCE_DIGITS = 3;

export const FIXTURES = {
  A: {
    id: "A",
    description: "0.100 mol/L HCl 20.0 mL + 0.100 mol/L NaOH",
    input: {
      analyteSubstanceId: "hcl",
      analyteConcentrationMolL: 0.1,
      analyteVolumeMl: 20,
      titrantSubstanceId: "naoh",
      titrantConcentrationMolL: 0.1,
    },
    equivalenceVolumesMl: [20],
    expectedPH: [
      { volumeMl: 0, pH: 1 },
      { volumeMl: 20, pH: 7 },
      { volumeMl: 30, pH: 12.3010299955 },
    ],
  },
  B: {
    id: "B",
    description: "0.100 mol/L CH3COOH 20.0 mL + 0.100 mol/L NaOH",
    input: {
      analyteSubstanceId: "ch3cooh",
      analyteConcentrationMolL: 0.1,
      analyteVolumeMl: 20,
      titrantSubstanceId: "naoh",
      titrantConcentrationMolL: 0.1,
    },
    equivalenceVolumesMl: [20],
    expectedPH: [
      { volumeMl: 0, pH: 2.7886852987 },
      { volumeMl: 10, pH: 4.5709475331 },
      { volumeMl: 20, pH: 8.6347066164 },
      { volumeMl: 30, pH: 12.3010300117 },
    ],
  },
  C: {
    id: "C",
    description: "0.100 mol/L NH3 20.0 mL + 0.100 mol/L HCl",
    input: {
      analyteSubstanceId: "nh3",
      analyteConcentrationMolL: 0.1,
      analyteVolumeMl: 20,
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: 0.1,
    },
    equivalenceVolumesMl: [20],
    expectedPH: [
      { volumeMl: 0, pH: 11.1775707496 },
      { volumeMl: 10, pH: 9.3611293462 },
      { volumeMl: 20, pH: 5.3312990665 },
      { volumeMl: 30, pH: 1.6989699856 },
    ],
  },
  D: {
    id: "D",
    description: "0.0500 mol/L H2C2O4 20.0 mL + 0.100 mol/L NaOH",
    input: {
      analyteSubstanceId: "h2c2o4",
      analyteConcentrationMolL: 0.05,
      analyteVolumeMl: 20,
      titrantSubstanceId: "naoh",
      titrantConcentrationMolL: 0.1,
    },
    equivalenceVolumesMl: [10, 20],
    expectedPH: [
      { volumeMl: 0, pH: 1.4433098167 },
      { volumeMl: 10, pH: 2.7323367062 },
      { volumeMl: 20, pH: 8.1107778549 },
      { volumeMl: 30, pH: 12.3010299971 },
    ],
  },
  E: {
    id: "E",
    description: "0.0500 mol/L H2SO4 20.0 mL + 0.100 mol/L NaOH",
    input: {
      analyteSubstanceId: "h2so4",
      analyteConcentrationMolL: 0.05,
      analyteVolumeMl: 20,
      titrantSubstanceId: "naoh",
      titrantConcentrationMolL: 0.1,
    },
    equivalenceVolumesMl: [10, 20],
    expectedPH: [
      { volumeMl: 0, pH: 1.2392620321 },
      { volumeMl: 10, pH: 1.8498241021 },
      { volumeMl: 20, pH: 7.2660064697 },
      { volumeMl: 30, pH: 12.3010299955 },
    ],
  },
  F: {
    id: "F",
    description: "0.0500 mol/L H3PO4 20.0 mL + 0.100 mol/L NaOH",
    input: {
      analyteSubstanceId: "h3po4",
      analyteConcentrationMolL: 0.05,
      analyteVolumeMl: 20,
      titrantSubstanceId: "naoh",
      titrantConcentrationMolL: 0.1,
    },
    equivalenceVolumesMl: [10, 20, 30],
    expectedPH: [
      { volumeMl: 0, pH: 1.8059326721 },
      { volumeMl: 10, pH: 4.7111094110 },
      { volumeMl: 20, pH: 9.6303758286 },
      { volumeMl: 30, pH: 12.1052519935 },
      { volumeMl: 45, pH: 12.4725832338 },
    ],
  },
  G: {
    id: "G",
    description: "0.0500 mol/L Ca(OH)2 20.0 mL + 0.100 mol/L HCl",
    input: {
      analyteSubstanceId: "caoh2",
      analyteConcentrationMolL: 0.05,
      analyteVolumeMl: 20,
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: 0.1,
    },
    equivalenceVolumesMl: [20],
    expectedPH: [
      { volumeMl: 0, pH: 13 },
      { volumeMl: 20, pH: 7 },
      { volumeMl: 30, pH: 1.6989700045 },
    ],
  },
} as const satisfies Record<string, RegressionFixture>;

export const V11_CONTRACT_FIXTURES = {
  H: {
    id: "H",
    description: "0.0500 mol/L Na2CO3 20.0 mL + 0.100 mol/L HCl",
    input: {
      analyteSubstanceId: "na2co3",
      analyteConcentrationMolL: 0.05,
      analyteVolumeMl: 20,
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: 0.1,
    },
    equivalenceVolumesMl: [10, 20],
    characteristicVolumesMl: [5, 15],
    expectedPH: [
      { volumeMl: 0, pH: 11.5002912257 },
      { volumeMl: 5, pH: 10.3210443569 },
      { volumeMl: 10, pH: 8.3385863386 },
      { volumeMl: 15, pH: 6.3498894298 },
      { volumeMl: 20, pH: 3.9769474833 },
    ],
    expectedDirection: "descending",
    exactAnchorVolumesMl: [5, 10, 15, 20],
    refinementTargetVolumesMl: [10, 20],
    expectedEquivalenceGuideCount: 2,
    pairing: {
      status: "supported",
      basis: "derived-capability",
      protonTransferDirection: "protonation",
    },
  },
  I: {
    id: "I",
    description: "0.0500 mol/L NaHCO3 20.0 mL + 0.100 mol/L HCl",
    input: {
      analyteSubstanceId: "nahco3",
      analyteConcentrationMolL: 0.05,
      analyteVolumeMl: 20,
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: 0.1,
    },
    equivalenceVolumesMl: [10],
    characteristicVolumesMl: [5],
    expectedPH: [
      { volumeMl: 0, pH: 8.339056533 },
      { volumeMl: 5, pH: 6.3498820604 },
      { volumeMl: 10, pH: 3.914355218 },
    ],
    expectedDirection: "descending",
    exactAnchorVolumesMl: [5, 10],
    refinementTargetVolumesMl: [10],
    expectedEquivalenceGuideCount: 1,
    pairing: {
      status: "supported",
      basis: "derived-capability",
      protonTransferDirection: "protonation",
    },
  },
  J: {
    id: "J",
    description: "0.0500 mol/L NaHCO3 20.0 mL + 0.100 mol/L NaOH",
    input: {
      analyteSubstanceId: "nahco3",
      analyteConcentrationMolL: 0.05,
      analyteVolumeMl: 20,
      titrantSubstanceId: "naoh",
      titrantConcentrationMolL: 0.1,
    },
    equivalenceVolumesMl: [10],
    characteristicVolumesMl: [5],
    expectedPH: [
      { volumeMl: 0, pH: 8.339056533 },
      { volumeMl: 5, pH: 10.3210443569 },
      { volumeMl: 10, pH: 11.4090571928 },
    ],
    expectedDirection: "ascending",
    exactAnchorVolumesMl: [5, 10],
    refinementTargetVolumesMl: [10],
    expectedEquivalenceGuideCount: 1,
    pairing: {
      status: "supported",
      basis: "derived-capability",
      protonTransferDirection: "deprotonation",
    },
  },
} as const satisfies Record<"H" | "I" | "J", V11ContractFixture>;
