export interface TitrationInput {
  analyteSubstanceId: string;
  analyteConcentrationMolL: number;
  analyteVolumeMl: number;
  titrantSubstanceId: string;
  titrantConcentrationMolL: number;
}

export interface AnalyteComponentInput {
  componentId: string;
  substanceId: string;
  concentrationMolL: number;
}

export interface AnalyteSolutionInput {
  totalVolumeMl: number;
  components: readonly AnalyteComponentInput[];
}

export interface SolutionTitrationInput {
  analyteSolution: AnalyteSolutionInput;
  titrantSubstanceId: string;
  titrantConcentrationMolL: number;
}

export type TitrationCurveInput = TitrationInput | SolutionTitrationInput;

export function isSolutionTitrationInput(
  input: TitrationCurveInput,
): input is SolutionTitrationInput {
  return "analyteSolution" in input;
}

export interface EquivalencePoint {
  id: string;
  order: number;
  volumeMl: number;
  pH?: number;
  classification?: "theoretical";
  stoichiometricEquivalent?: number;
  participatingStepIds?: string[];
  cumulativeEquivalentMoles?: number;
  participatingProcessIds?: string[];
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
