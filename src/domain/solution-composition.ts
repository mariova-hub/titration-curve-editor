export type AcidBaseFamilyId = string;
export type ChemicalSpeciesId = string;
export type FixedIonId = `ion.${string}`;
export type SolutionComponentId = string;
export type SubstanceId = string;

export interface InitialFamilyComponent {
  familyId: AcidBaseFamilyId;
  initialSpeciesId: ChemicalSpeciesId;
  stoichiometryPerFormulaUnit: number;
}

export interface FixedIonComponent {
  speciesId: FixedIonId;
  stoichiometryPerFormulaUnit: number;
}

export interface DissolvedComposition {
  familyComponents: readonly InitialFamilyComponent[];
  fixedIons: readonly FixedIonComponent[];
}

export interface QuantifiedSolutionComponent {
  sourceComponentId: SolutionComponentId;
  substanceId: SubstanceId;
  amountMol: number;
}

export interface FamilyAmountContribution {
  sourceComponentId: SolutionComponentId;
  initialSpeciesId: ChemicalSpeciesId;
  amountMol: number;
}

export interface AggregatedFamilyAmount {
  familyId: AcidBaseFamilyId;
  totalAmountMol: number;
  contributions: readonly FamilyAmountContribution[];
}

export interface FixedIonAmountContribution {
  sourceComponentId: SolutionComponentId;
  amountMol: number;
}

export interface AggregatedFixedIonAmount {
  speciesId: FixedIonId;
  totalAmountMol: number;
  contributions: readonly FixedIonAmountContribution[];
}

export interface FamilyProtonTransferCapacitySource {
  kind: "family";
  sourceComponentId: SolutionComponentId;
  familyId: AcidBaseFamilyId;
  initialSpeciesId: ChemicalSpeciesId;
  amountMol: number;
}

export interface StrongHydroxideProtonTransferCapacitySource {
  kind: "strong-hydroxide";
  sourceComponentId: SolutionComponentId;
  amountMol: number;
  hydroxideStoichiometry: number;
}

export type ProtonTransferCapacitySource =
  | FamilyProtonTransferCapacitySource
  | StrongHydroxideProtonTransferCapacitySource;

export interface CompiledSolutionComposition {
  totalVolumeL: number;
  familyAmounts: readonly AggregatedFamilyAmount[];
  fixedIonAmounts: readonly AggregatedFixedIonAmount[];
  protonTransferSources: readonly ProtonTransferCapacitySource[];
}
