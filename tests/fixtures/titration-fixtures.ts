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

export interface V12AnalyteComponentInputContract {
  componentId: string;
  substanceId: string;
  concentrationMolL: number;
}

export interface V12SolutionTitrationInputContract {
  analyteSolution: {
    totalVolumeMl: number;
    components: readonly V12AnalyteComponentInputContract[];
  };
  titrantSubstanceId: string;
  titrantConcentrationMolL: number;
}

export interface V12ContractFixture
  extends TitrationFixture<V12SolutionTitrationInputContract> {
  expectedComponentAmountsMol: ReadonlyArray<{
    componentId: string;
    substanceId: string;
    amountMol: number;
  }>;
  characteristicVolumesMl: readonly number[];
  expectedDirection: CurveDirection;
  exactAnchorVolumesMl: readonly number[];
  refinementTargetVolumesMl: readonly number[];
  expectedEquivalenceGuideCount: number;
  expectedAutoRangeMl: number;
  goldenPHProvenance: {
    method: "independent-decimal-bisection";
    productionModuleImported: false;
    temperatureC: 25;
    decimalPrecisionDigits: 80;
    bisectionIterations: 500;
    constants: {
      pKa1: 6.35;
      pKa2: 10.33;
      kw: 1e-14;
      carbonateSourceId: "usgs-carbonic-25c";
      kwSourceId: "KW_25C";
    };
    crossCheck: "independent-double-bisection";
  };
}

export type V12ValidationContractCode =
  | "duplicate-analyte-substance"
  | "pre-equilibration-required"
  | "unsupported-stage-grouping"
  | "ambiguous-proton-transfer-direction";

export interface V12ValidationContract {
  id:
    | "duplicate-analyte-component"
    | "pre-equilibration-required"
    | "unsupported-stage-grouping"
    | "direction-ambiguity";
  trigger:
    | {
        kind: "solution-input";
        input: V12SolutionTitrationInputContract;
      }
    | {
        kind: "component-direction-set";
        componentDirections: readonly ["protonation", "deprotonation"];
      };
  expectedCode: V12ValidationContractCode;
  expectedMessage: string;
}

export const V11_PH_TOLERANCE_DIGITS = 3;
export const V12_PH_TOLERANCE_DIGITS = V11_PH_TOLERANCE_DIGITS;

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

export const V12_CONTRACT_FIXTURES = {
  K: {
    id: "K",
    description:
      "20.0 mL mixed analyte: 0.0500 mol/L Na2CO3 + 0.0250 mol/L NaOH; 0.100 mol/L HCl",
    input: {
      analyteSolution: {
        totalVolumeMl: 20,
        components: [
          {
            componentId: "analyte-carbonate",
            substanceId: "na2co3",
            concentrationMolL: 0.05,
          },
          {
            componentId: "analyte-hydroxide",
            substanceId: "naoh",
            concentrationMolL: 0.025,
          },
        ],
      },
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: 0.1,
    },
    expectedComponentAmountsMol: [
      {
        componentId: "analyte-carbonate",
        substanceId: "na2co3",
        amountMol: 0.001,
      },
      {
        componentId: "analyte-hydroxide",
        substanceId: "naoh",
        amountMol: 0.0005,
      },
    ],
    equivalenceVolumesMl: [15, 25],
    characteristicVolumesMl: [7.5, 20],
    expectedPH: [
      { volumeMl: 0, pH: 12.4051254613 },
      { volumeMl: 7.5, pH: 10.7703912981 },
      { volumeMl: 15, pH: 8.3383516242 },
      { volumeMl: 20, pH: 6.3498931144 },
      { volumeMl: 25, pH: 4.0025793867 },
    ],
    expectedDirection: "descending",
    exactAnchorVolumesMl: [7.5, 15, 20, 25],
    refinementTargetVolumesMl: [15, 25],
    expectedEquivalenceGuideCount: 2,
    expectedAutoRangeMl: 31.25,
    goldenPHProvenance: {
      method: "independent-decimal-bisection",
      productionModuleImported: false,
      temperatureC: 25,
      decimalPrecisionDigits: 80,
      bisectionIterations: 500,
      constants: {
        pKa1: 6.35,
        pKa2: 10.33,
        kw: 1e-14,
        carbonateSourceId: "usgs-carbonic-25c",
        kwSourceId: "KW_25C",
      },
      crossCheck: "independent-double-bisection",
    },
  },
} as const satisfies Record<"K", V12ContractFixture>;

export const V12_VALIDATION_CONTRACTS = [
  {
    id: "duplicate-analyte-component",
    trigger: {
      kind: "solution-input",
      input: {
        analyteSolution: {
          totalVolumeMl: 20,
          components: [
            {
              componentId: "component-1",
              substanceId: "na2co3",
              concentrationMolL: 0.05,
            },
            {
              componentId: "component-2",
              substanceId: "na2co3",
              concentrationMolL: 0.025,
            },
          ],
        },
        titrantSubstanceId: "hcl",
        titrantConcentrationMolL: 0.1,
      },
    },
    expectedCode: "duplicate-analyte-substance",
    expectedMessage: "同じ分析物質を複数回追加することはできません。",
  },
  {
    id: "pre-equilibration-required",
    trigger: {
      kind: "solution-input",
      input: {
        analyteSolution: {
          totalVolumeMl: 20,
          components: [
            {
              componentId: "component-acid",
              substanceId: "hcl",
              concentrationMolL: 0.05,
            },
            {
              componentId: "component-base",
              substanceId: "naoh",
              concentrationMolL: 0.025,
            },
          ],
        },
        titrantSubstanceId: "hno3",
        titrantConcentrationMolL: 0.1,
      },
    },
    expectedCode: "pre-equilibration-required",
    expectedMessage:
      "この組み合わせは滴定前に分析物質どうしが反応するため、現在は対応していません。",
  },
  {
    id: "unsupported-stage-grouping",
    trigger: {
      kind: "solution-input",
      input: {
        analyteSolution: {
          totalVolumeMl: 20,
          components: [
            {
              componentId: "component-carbonate",
              substanceId: "na2co3",
              concentrationMolL: 0.05,
            },
            {
              componentId: "component-ammonia",
              substanceId: "nh3",
              concentrationMolL: 0.025,
            },
          ],
        },
        titrantSubstanceId: "hcl",
        titrantConcentrationMolL: 0.1,
      },
    },
    expectedCode: "unsupported-stage-grouping",
    expectedMessage: "この混合組成の反応段階は現在の計算モデルでは扱えません。",
  },
  {
    id: "direction-ambiguity",
    trigger: {
      kind: "component-direction-set",
      componentDirections: ["protonation", "deprotonation"],
    },
    expectedCode: "ambiguous-proton-transfer-direction",
    expectedMessage: "プロトン移動方向を一意に決定できません。",
  },
] as const satisfies readonly V12ValidationContract[];

export const V12_API_CONTRACT = {
  strategy: "existing-entry-point-discriminated-union",
  entryPoint: "calculateTitrationCurve",
  legacyInputType: "TitrationInput",
  mixedInputType: "SolutionTitrationInput",
  unionInputType: "TitrationCurveInput",
  mixedSpecificEntryPoint: null,
  internalPipeline: "shared-composition-boundary-solver",
} as const;

export const V12_DIAGNOSTICS_CONTRACT = {
  legacySingleAnalyteNaoh: {
    speciesId: "naoh.cation",
    sourceSubstanceId: "naoh",
    exposedThrough: [
      "PHCalculationDetails.system.fixedIons",
      "PHCalculationDetails.chargeBalance.speciesConcentrations",
      "buildAnalyticalSystem",
      "evaluateChargeBalance",
    ],
    exposedInUi: false,
    exposedInTitrationResult: false,
  },
  mixedCanonicalSodium: {
    speciesId: "ion.na",
    provenance: "source-component-ids",
    exposeLegacyNaohCationId: false,
  },
  hydroxide: {
    fixedSpeciesId: null,
    diagnosticField: "hydroxideConcentrationMolL",
  },
} as const;

export const V12_ACCESSIBILITY_CONTRACT = {
  namingMechanism: "visible-label-for" as const,
  singleComponentAccessibleNames: {
    analyteSubstance: "物質",
    analyteConcentration: "モル濃度 mol/L",
    commonVolume: "体積 mL",
    titrantSubstance: "物質",
    titrantConcentration: "モル濃度 mol/L",
  },
  twoComponentAccessibleNames: [
    "分析物質 1",
    "分析物質 1 の濃度",
    "分析物質 2",
    "分析物質 2 の濃度",
    "分析物質を追加",
    "分析物質 2 を削除",
  ],
  legacyControlRelativeOrder: [
    "analyte-substance",
    "analyte-concentration",
    "analyte-volume",
    "titrant-substance",
    "titrant-concentration",
  ],
  focusAfterAdd: "analyte-component-2-substance",
  focusAfterDelete: "add-analyte-component",
} as const;
