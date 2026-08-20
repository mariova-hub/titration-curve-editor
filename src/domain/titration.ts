export interface TitrationInput {
  analyteSubstanceId: string;
  analyteConcentrationMolL: number;
  analyteVolumeMl: number;
  titrantSubstanceId: string;
  titrantConcentrationMolL: number;
}

export interface EquivalencePoint {
  id: string;
  order: number;
  volumeMl: number;
  pH?: number;
  classification?: "theoretical";
  stoichiometricEquivalent?: number;
  participatingStepIds?: string[];
}

export type CharacteristicPointType =
  | "initial"
  | "half-equivalence"
  | "custom";

export interface CharacteristicPoint {
  id: string;
  type: CharacteristicPointType;
  order: number;
  volumeMl: number;
  pH?: number;
  relatedEquivalencePointIds?: string[];
}

export interface CurvePoint {
  addedVolumeMl: number;
  pH: number;
}

export interface TitrationResult {
  equivalencePoints: EquivalencePoint[];
  characteristicPoints: CharacteristicPoint[];
  points: CurvePoint[];
}
