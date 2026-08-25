import type { SolutionComponentId } from "./solution-composition";

export type ProtonTransferMode = "donate" | "accept";
export type AnalyteProtonTransferDirection =
  | "protonation"
  | "deprotonation";

export interface FamilyProtonTransferProcess {
  kind: "family-step";
  processId: string;
  stepId: string;
  fromSpeciesId: string;
  toSpeciesId: string;
  equivalentPerSourceMole: number;
}

export interface StrongHydroxideProtonTransferProcess {
  kind: "strong-hydroxide";
  processId: string;
  equivalentPerSourceMole: number;
}

export type ProtonTransferProcess =
  | FamilyProtonTransferProcess
  | StrongHydroxideProtonTransferProcess;

export interface ProtonTransferSourceCapability {
  sourceComponentId: SolutionComponentId;
  amountMol: number;
  donateProcesses: readonly ProtonTransferProcess[];
  acceptProcesses: readonly ProtonTransferProcess[];
}

export interface ProtonTransferProfile {
  sources: readonly ProtonTransferSourceCapability[];
}

export const INCOMPATIBLE_ACID_BASE_PAIR =
  "incompatible-acid-base-pair" as const;
export const AMBIGUOUS_PROTON_TRANSFER_DIRECTION =
  "ambiguous-proton-transfer-direction" as const;

export interface SupportedProtonTransferPairing {
  status: "supported";
  candidateCount: 1;
  direction: AnalyteProtonTransferDirection;
  analyteMode: ProtonTransferMode;
  titrantMode: ProtonTransferMode;
  titrantEquivalentCapacityPerMol: number;
}

export interface IncompatibleProtonTransferPairing {
  status: "incompatible";
  candidateCount: 0;
  code: typeof INCOMPATIBLE_ACID_BASE_PAIR;
}

export interface AmbiguousProtonTransferPairing {
  status: "ambiguous";
  candidateCount: number;
  code: typeof AMBIGUOUS_PROTON_TRANSFER_DIRECTION;
}

export type ProtonTransferPairingResult =
  | SupportedProtonTransferPairing
  | IncompatibleProtonTransferPairing
  | AmbiguousProtonTransferPairing;

export interface StoichiometricCapacityContribution {
  sourceComponentId: SolutionComponentId;
  processId: string;
  kind: "family-step" | "strong-hydroxide";
  equivalentMoles: number;
}

export interface ComponentLocalStoichiometricPath {
  sourceComponentId: SolutionComponentId;
  direction: AnalyteProtonTransferDirection;
  contributions: readonly StoichiometricCapacityContribution[];
}

export interface StoichiometricBoundaryStage {
  order: number;
  contributions: readonly StoichiometricCapacityContribution[];
  incrementalEquivalentMoles: number;
  cumulativeEquivalentMoles: number;
  participatingStepIds: readonly string[];
}

export interface StoichiometricBoundaryPlan {
  direction: AnalyteProtonTransferDirection;
  stages: readonly StoichiometricBoundaryStage[];
}
