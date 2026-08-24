import type { DissolvedComposition } from "./solution-composition";

export type AcidBaseRole = "acid" | "base";

export interface ChemicalSpecies {
  id: string;
  formula: string;
  charge: number;
  boundProtonCount: number;
}

export interface PendingKa {
  status: "pending";
}

export interface ChemicalConstantSource {
  id: string;
  title: string;
  url: string;
  citation: string;
}

export interface ConfirmedKa {
  status: "confirmed";
  kind: "Ka";
  value: number;
  temperatureC: 25;
  source: ChemicalConstantSource;
  reviewedAt: string;
  note?: string;
}

export type KaReference = PendingKa | ConfirmedKa;

interface DissociationStepBase {
  id: string;
  order: number;
  acidSpeciesId: string;
  conjugateBaseSpeciesId: string;
}

export interface CompleteDissociationStep extends DissociationStepBase {
  mode: "complete";
  ka?: never;
}

export interface EquilibriumDissociationStep extends DissociationStepBase {
  mode: "equilibrium";
  ka: KaReference;
}

export type DissociationStep =
  | CompleteDissociationStep
  | EquilibriumDissociationStep;

export interface AcidBaseFamily {
  protonCount: number;
  species: ChemicalSpecies[];
  dissociationSteps: DissociationStep[];
}

/** Acid and base families intentionally share one protonation-state model. */
export type AcidFamily = AcidBaseFamily;
export type BaseFamily = AcidBaseFamily;

export interface CompleteIon {
  species: ChemicalSpecies;
  coefficientPerFormulaUnit: number;
  kind: "fixed" | "hydroxide";
}

export interface ProtonationFamilyModel {
  kind: "protonation-family";
  family: AcidBaseFamily;
}

export interface StrongHydroxideModel {
  kind: "strong-hydroxide";
  hydroxideStoichiometry: number;
  completeIons: CompleteIon[];
}

export type SubstanceAcidBaseModel =
  | ProtonationFamilyModel
  | StrongHydroxideModel;

export type SubstanceProvenance =
  | { status: "pending" }
  | {
      status: "reviewed";
      sourceId: string;
      reviewedAt: string;
    };

export interface Substance {
  id: string;
  displayNameJa: string;
  formula: string;
  roles: AcidBaseRole[];
  dissolvedComposition?: DissolvedComposition;
  acidBaseModel: SubstanceAcidBaseModel;
  provenance: SubstanceProvenance;
}
