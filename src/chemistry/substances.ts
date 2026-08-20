import type {
  AcidBaseFamily,
  ChemicalSpecies,
  CompleteDissociationStep,
  CompleteIon,
  EquilibriumDissociationStep,
  StrongHydroxideModel,
  Substance,
} from "../domain/chemistry";

function createSpecies(
  id: string,
  formula: string,
  charge: number,
  boundProtonCount: number,
): ChemicalSpecies {
  return { id, formula, charge, boundProtonCount };
}

function createCompleteStep(
  id: string,
  order: number,
  acidSpeciesId: string,
  conjugateBaseSpeciesId: string,
): CompleteDissociationStep {
  return {
    id,
    order,
    acidSpeciesId,
    conjugateBaseSpeciesId,
    mode: "complete",
  };
}

function createPendingEquilibriumStep(
  id: string,
  order: number,
  acidSpeciesId: string,
  conjugateBaseSpeciesId: string,
): EquilibriumDissociationStep {
  return {
    id,
    order,
    acidSpeciesId,
    conjugateBaseSpeciesId,
    mode: "equilibrium",
    ka: { status: "pending" },
  };
}

function createProtonationFamilySubstance(
  definition: Omit<Substance, "acidBaseModel" | "provenance"> & {
    family: AcidBaseFamily;
  },
): Substance {
  const { family, ...substance } = definition;

  return {
    ...substance,
    acidBaseModel: { kind: "protonation-family", family },
    provenance: { status: "pending" },
  };
}

function createStrongHydroxideSubstance(
  definition: Omit<Substance, "acidBaseModel" | "provenance"> & {
    hydroxideStoichiometry: number;
    completeIons: CompleteIon[];
  },
): Substance {
  const { hydroxideStoichiometry, completeIons, ...substance } = definition;
  const acidBaseModel: StrongHydroxideModel = {
    kind: "strong-hydroxide",
    hydroxideStoichiometry,
    completeIons,
  };

  return {
    ...substance,
    acidBaseModel,
    provenance: { status: "pending" },
  };
}

const hcl = createProtonationFamilySubstance({
  id: "hcl",
  displayNameJa: "塩酸",
  formula: "HCl",
  roles: ["acid"],
  family: {
    protonCount: 1,
    species: [
      createSpecies("hcl.hcl", "HCl", 0, 1),
      createSpecies("hcl.cl", "Cl-", -1, 0),
    ],
    dissociationSteps: [
      createCompleteStep("hcl.step1", 1, "hcl.hcl", "hcl.cl"),
    ],
  },
});

const hno3 = createProtonationFamilySubstance({
  id: "hno3",
  displayNameJa: "硝酸",
  formula: "HNO3",
  roles: ["acid"],
  family: {
    protonCount: 1,
    species: [
      createSpecies("hno3.hno3", "HNO3", 0, 1),
      createSpecies("hno3.no3", "NO3-", -1, 0),
    ],
    dissociationSteps: [
      createCompleteStep("hno3.step1", 1, "hno3.hno3", "hno3.no3"),
    ],
  },
});

const h2so4 = createProtonationFamilySubstance({
  id: "h2so4",
  displayNameJa: "硫酸",
  formula: "H2SO4",
  roles: ["acid"],
  family: {
    protonCount: 2,
    species: [
      createSpecies("h2so4.h2so4", "H2SO4", 0, 2),
      createSpecies("h2so4.hso4", "HSO4-", -1, 1),
      createSpecies("h2so4.so4", "SO4^2-", -2, 0),
    ],
    dissociationSteps: [
      createCompleteStep(
        "h2so4.step1",
        1,
        "h2so4.h2so4",
        "h2so4.hso4",
      ),
      createPendingEquilibriumStep(
        "h2so4.step2",
        2,
        "h2so4.hso4",
        "h2so4.so4",
      ),
    ],
  },
});

const aceticAcid = createProtonationFamilySubstance({
  id: "ch3cooh",
  displayNameJa: "酢酸",
  formula: "CH3COOH",
  roles: ["acid"],
  family: {
    protonCount: 1,
    species: [
      createSpecies("ch3cooh.ch3cooh", "CH3COOH", 0, 1),
      createSpecies("ch3cooh.ch3coo", "CH3COO-", -1, 0),
    ],
    dissociationSteps: [
      createPendingEquilibriumStep(
        "ch3cooh.step1",
        1,
        "ch3cooh.ch3cooh",
        "ch3cooh.ch3coo",
      ),
    ],
  },
});

const oxalicAcid = createProtonationFamilySubstance({
  id: "h2c2o4",
  displayNameJa: "シュウ酸",
  formula: "H2C2O4",
  roles: ["acid"],
  family: {
    protonCount: 2,
    species: [
      createSpecies("h2c2o4.h2c2o4", "H2C2O4", 0, 2),
      createSpecies("h2c2o4.hc2o4", "HC2O4-", -1, 1),
      createSpecies("h2c2o4.c2o4", "C2O4^2-", -2, 0),
    ],
    dissociationSteps: [
      createPendingEquilibriumStep(
        "h2c2o4.step1",
        1,
        "h2c2o4.h2c2o4",
        "h2c2o4.hc2o4",
      ),
      createPendingEquilibriumStep(
        "h2c2o4.step2",
        2,
        "h2c2o4.hc2o4",
        "h2c2o4.c2o4",
      ),
    ],
  },
});

const carbonicAcid = createProtonationFamilySubstance({
  id: "h2co3",
  displayNameJa: "炭酸",
  formula: "H2CO3",
  roles: ["acid"],
  family: {
    protonCount: 2,
    species: [
      createSpecies("h2co3.h2co3", "H2CO3", 0, 2),
      createSpecies("h2co3.hco3", "HCO3-", -1, 1),
      createSpecies("h2co3.co3", "CO3^2-", -2, 0),
    ],
    dissociationSteps: [
      createPendingEquilibriumStep(
        "h2co3.step1",
        1,
        "h2co3.h2co3",
        "h2co3.hco3",
      ),
      createPendingEquilibriumStep(
        "h2co3.step2",
        2,
        "h2co3.hco3",
        "h2co3.co3",
      ),
    ],
  },
});

const phosphoricAcid = createProtonationFamilySubstance({
  id: "h3po4",
  displayNameJa: "リン酸",
  formula: "H3PO4",
  roles: ["acid"],
  family: {
    protonCount: 3,
    species: [
      createSpecies("h3po4.h3po4", "H3PO4", 0, 3),
      createSpecies("h3po4.h2po4", "H2PO4-", -1, 2),
      createSpecies("h3po4.hpo4", "HPO4^2-", -2, 1),
      createSpecies("h3po4.po4", "PO4^3-", -3, 0),
    ],
    dissociationSteps: [
      createPendingEquilibriumStep(
        "h3po4.step1",
        1,
        "h3po4.h3po4",
        "h3po4.h2po4",
      ),
      createPendingEquilibriumStep(
        "h3po4.step2",
        2,
        "h3po4.h2po4",
        "h3po4.hpo4",
      ),
      createPendingEquilibriumStep(
        "h3po4.step3",
        3,
        "h3po4.hpo4",
        "h3po4.po4",
      ),
    ],
  },
});

function createHydroxideIons(
  substanceId: string,
  cationFormula: string,
  cationCharge: number,
  hydroxideStoichiometry: number,
): CompleteIon[] {
  return [
    {
      species: createSpecies(
        `${substanceId}.cation`,
        cationFormula,
        cationCharge,
        0,
      ),
      coefficientPerFormulaUnit: 1,
    },
    {
      species: createSpecies(`${substanceId}.oh`, "OH-", -1, 0),
      coefficientPerFormulaUnit: hydroxideStoichiometry,
    },
  ];
}

const sodiumHydroxide = createStrongHydroxideSubstance({
  id: "naoh",
  displayNameJa: "水酸化ナトリウム",
  formula: "NaOH",
  roles: ["base"],
  hydroxideStoichiometry: 1,
  completeIons: createHydroxideIons("naoh", "Na+", 1, 1),
});

const potassiumHydroxide = createStrongHydroxideSubstance({
  id: "koh",
  displayNameJa: "水酸化カリウム",
  formula: "KOH",
  roles: ["base"],
  hydroxideStoichiometry: 1,
  completeIons: createHydroxideIons("koh", "K+", 1, 1),
});

const calciumHydroxide = createStrongHydroxideSubstance({
  id: "caoh2",
  displayNameJa: "水酸化カルシウム",
  formula: "Ca(OH)2",
  roles: ["base"],
  hydroxideStoichiometry: 2,
  completeIons: createHydroxideIons("caoh2", "Ca^2+", 2, 2),
});

const bariumHydroxide = createStrongHydroxideSubstance({
  id: "baoh2",
  displayNameJa: "水酸化バリウム",
  formula: "Ba(OH)2",
  roles: ["base"],
  hydroxideStoichiometry: 2,
  completeIons: createHydroxideIons("baoh2", "Ba^2+", 2, 2),
});

const ammonia = createProtonationFamilySubstance({
  id: "nh3",
  displayNameJa: "アンモニア",
  formula: "NH3",
  roles: ["base"],
  family: {
    protonCount: 1,
    species: [
      createSpecies("nh3.nh4", "NH4+", 1, 1),
      createSpecies("nh3.nh3", "NH3", 0, 0),
    ],
    dissociationSteps: [
      createPendingEquilibriumStep(
        "nh3.step1",
        1,
        "nh3.nh4",
        "nh3.nh3",
      ),
    ],
  },
});

export const SUBSTANCES: readonly Substance[] = [
  hcl,
  hno3,
  h2so4,
  aceticAcid,
  oxalicAcid,
  carbonicAcid,
  phosphoricAcid,
  sodiumHydroxide,
  potassiumHydroxide,
  calciumHydroxide,
  bariumHydroxide,
  ammonia,
];

const substanceById = new Map(
  SUBSTANCES.map((substance) => [substance.id, substance]),
);

export function getSubstanceById(id: string): Substance | undefined {
  return substanceById.get(id);
}
