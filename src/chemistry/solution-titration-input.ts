import type { Substance } from "../domain/chemistry";
import type {
  SolutionTitrationInput,
} from "../domain/titration";
import type {
  SupportedProtonTransferPairing,
  ProtonTransferProfile,
} from "../domain/stoichiometry";
import type {
  ValidationErrorCode,
} from "../domain/validation";
import type { CompiledSolutionComposition } from "../domain/solution-composition";
import { compileSolutionComposition } from "./composition-compiler";
import {
  deriveSubstanceProtonTransferProfile,
  getProfileEquivalentCapacity,
  resolveProtonTransferPairing,
} from "./proton-transfer";
import { getSubstanceById } from "./substances";

export interface NormalizedAnalyteComponent {
  sourceComponentId: string;
  substanceId: string;
  substance: Substance;
  concentrationMolL: number;
  amountMol: number;
}

export interface NormalizedTitrantInput {
  substanceId: string;
  substance: Substance;
  concentrationMolL: number;
}

export interface NormalizedSolutionTitrationInput {
  analyteSolutionVolumeL: number;
  components: readonly NormalizedAnalyteComponent[];
  titrant: NormalizedTitrantInput;
  analyteProfile: ProtonTransferProfile;
  pairing: SupportedProtonTransferPairing;
}

export type SolutionValidationField =
  | "analyteSolution"
  | "analyteSolution.totalVolumeMl"
  | "analyteSolution.components"
  | `analyteSolution.components.${number}.componentId`
  | `analyteSolution.components.${number}.substanceId`
  | `analyteSolution.components.${number}.concentrationMolL`
  | "titrantSubstanceId"
  | "titrantConcentrationMolL";

export interface SolutionTitrationValidationError {
  code: ValidationErrorCode;
  field: SolutionValidationField;
  message: string;
}

export type SolutionTitrationValidationResult =
  | {
      valid: true;
      errors: [];
      normalizedInput: NormalizedSolutionTitrationInput;
    }
  | {
      valid: false;
      errors: [SolutionTitrationValidationError];
    };

export class SolutionTitrationInputError extends Error {
  public readonly code: ValidationErrorCode;
  public readonly field: SolutionValidationField;

  constructor(public readonly validationError: SolutionTitrationValidationError) {
    super(validationError.message);
    this.name = "SolutionTitrationInputError";
    this.code = validationError.code;
    this.field = validationError.field;
  }
}

function invalid(
  code: ValidationErrorCode,
  field: SolutionValidationField,
  message: string,
): SolutionTitrationValidationResult {
  return { valid: false, errors: [{ code, field, message }] };
}

function numericError(
  value: number,
  field: SolutionValidationField,
  label: string,
): SolutionTitrationValidationResult | undefined {
  if (!Number.isFinite(value)) {
    return invalid(
      "non-finite-number",
      field,
      `${label}には有限の数値を指定してください。`,
    );
  }
  if (value <= 0) {
    return invalid(
      "non-positive-number",
      field,
      `${label}には0より大きい値を指定してください。`,
    );
  }
  return undefined;
}

function solutionProfile(
  components: readonly NormalizedAnalyteComponent[],
  profiles: readonly ProtonTransferProfile[],
): ProtonTransferProfile {
  return {
    sources: components.flatMap((component, index) =>
      profiles[index]!.sources.map(
        (source) => ({
          ...source,
          sourceComponentId: component.sourceComponentId,
          amountMol: component.amountMol * source.amountMol,
        }),
      ),
    ),
  };
}

function componentProfiles(
  components: readonly NormalizedAnalyteComponent[],
): ProtonTransferProfile[] {
  return components.map(({ substance }) =>
    deriveSubstanceProtonTransferProfile(substance),
  );
}

function requiresPreEquilibration(
  profiles: readonly ProtonTransferProfile[],
): boolean {
  for (let left = 0; left < profiles.length; left += 1) {
    const leftProfile = profiles[left]!;
    for (let right = left + 1; right < profiles.length; right += 1) {
      const rightProfile = profiles[right]!;
      if (
        (getProfileEquivalentCapacity(leftProfile, "donate") > 0 &&
          getProfileEquivalentCapacity(rightProfile, "accept") > 0) ||
        (getProfileEquivalentCapacity(leftProfile, "accept") > 0 &&
          getProfileEquivalentCapacity(rightProfile, "donate") > 0)
      ) {
        return true;
      }
    }
  }
  return false;
}

function requiresUnsupportedStageGrouping(
  components: readonly NormalizedAnalyteComponent[],
): boolean {
  if (components.length <= 1) return false;

  const familyIds = new Set(
    components.flatMap(({ substance }) =>
      substance.acidBaseModel.kind === "protonation-family"
        ? [substance.acidBaseModel.family.id]
        : [],
    ),
  );
  return familyIds.size !== 1;
}

export function validateSolutionTitrationInput(
  input: SolutionTitrationInput,
): SolutionTitrationValidationResult {
  if (
    "analyteSubstanceId" in input ||
    "analyteConcentrationMolL" in input ||
    "analyteVolumeMl" in input
  ) {
    return invalid(
      "invalid-titration-input-shape",
      "analyteSolution",
      "単一分析物質入力と混合分析溶液入力を同時に指定することはできません。",
    );
  }

  if (input.analyteSolution.components.length === 0) {
    return invalid(
      "invalid-analyte-component-count",
      "analyteSolution.components",
      "分析物質を1件以上指定してください。",
    );
  }

  const volumeError = numericError(
    input.analyteSolution.totalVolumeMl,
    "analyteSolution.totalVolumeMl",
    "分析溶液の体積",
  );
  if (volumeError !== undefined) return volumeError;

  const titrantConcentrationError = numericError(
    input.titrantConcentrationMolL,
    "titrantConcentrationMolL",
    "滴下する水溶液の濃度",
  );
  if (titrantConcentrationError !== undefined) {
    return titrantConcentrationError;
  }

  for (const [index, component] of input.analyteSolution.components.entries()) {
    const concentrationError = numericError(
      component.concentrationMolL,
      `analyteSolution.components.${index}.concentrationMolL`,
      `分析物質${index + 1}の濃度`,
    );
    if (concentrationError !== undefined) return concentrationError;
  }

  const componentIds = new Set<string>();
  for (const [index, component] of input.analyteSolution.components.entries()) {
    if (component.componentId.trim().length === 0) {
      return invalid(
        "invalid-source-component-id",
        `analyteSolution.components.${index}.componentId`,
        "分析物質のcomponent IDには空でない値を指定してください。",
      );
    }
    if (componentIds.has(component.componentId)) {
      return invalid(
        "duplicate-source-component-id",
        `analyteSolution.components.${index}.componentId`,
        "分析物質のcomponent IDは重複できません。",
      );
    }
    componentIds.add(component.componentId);
  }

  const substances: Substance[] = [];
  for (const [index, component] of input.analyteSolution.components.entries()) {
    const substance = getSubstanceById(component.substanceId);
    if (substance === undefined) {
      return invalid(
        "unknown-substance",
        `analyteSolution.components.${index}.substanceId`,
        "分析物質の物質IDが物質マスターに登録されていません。",
      );
    }
    substances.push(substance);
  }
  const titrantSubstance = getSubstanceById(input.titrantSubstanceId);
  if (titrantSubstance === undefined) {
    return invalid(
      "unknown-substance",
      "titrantSubstanceId",
      "滴下する水溶液の物質IDが物質マスターに登録されていません。",
    );
  }

  const substanceIds = new Set<string>();
  for (const [index, component] of input.analyteSolution.components.entries()) {
    if (substanceIds.has(component.substanceId)) {
      return invalid(
        "duplicate-analyte-substance",
        `analyteSolution.components.${index}.substanceId`,
        "同じ分析物質を複数回追加することはできません。",
      );
    }
    substanceIds.add(component.substanceId);
  }

  const analyteSolutionVolumeL = input.analyteSolution.totalVolumeMl / 1000;
  const components: NormalizedAnalyteComponent[] = input.analyteSolution.components.map(
    (component, index) => ({
      sourceComponentId: component.componentId,
      substanceId: component.substanceId,
      substance: substances[index]!,
      concentrationMolL: component.concentrationMolL,
      amountMol: component.concentrationMolL * analyteSolutionVolumeL,
    }),
  );
  for (const [index, component] of components.entries()) {
    if (!Number.isFinite(component.amountMol)) {
      return invalid(
        "non-finite-number",
        `analyteSolution.components.${index}.concentrationMolL`,
        `分析物質${index + 1}の物質量を有限値として導出できません。`,
      );
    }
  }

  let profiles: ProtonTransferProfile[];
  try {
    profiles = componentProfiles(components);
  } catch {
    return invalid(
      "unsupported-analyte-component",
      "analyteSolution.components",
      "この分析物質は現在のcomposition modelでは扱えません。",
    );
  }
  if (requiresPreEquilibration(profiles)) {
    return invalid(
      "pre-equilibration-required",
      "analyteSolution.components",
      "この組み合わせは滴定前に分析物質どうしが反応するため、現在は対応していません。",
    );
  }

  const analyteProfile = solutionProfile(components, profiles);
  let titrantProfile: ProtonTransferProfile;
  try {
    titrantProfile = deriveSubstanceProtonTransferProfile(titrantSubstance);
  } catch {
    return invalid(
      "unsupported-analyte-component",
      "titrantSubstanceId",
      "この滴下物質は現在のcomposition modelでは扱えません。",
    );
  }
  const pairing = resolveProtonTransferPairing(analyteProfile, titrantProfile);
  if (pairing.status !== "supported") {
    return invalid(
      pairing.code,
      "analyteSolution",
      pairing.status === "ambiguous"
        ? "プロトン移動方向を一意に決定できません。"
        : "滴定される水溶液と滴下する水溶液には、酸と塩基の組み合わせを指定してください。",
    );
  }

  if (
    profiles.some(
      (profile) =>
        getProfileEquivalentCapacity(profile, pairing.analyteMode) <= 0,
    )
  ) {
    return invalid(
      "incompatible-analyte-component",
      "analyteSolution.components",
      "すべての分析物質が同じプロトン移動方向へ参加できる必要があります。",
    );
  }

  if (requiresUnsupportedStageGrouping(components)) {
    return invalid(
      "unsupported-stage-grouping",
      "analyteSolution.components",
      "この混合組成の反応段階は現在の計算モデルでは扱えません。",
    );
  }

  return {
    valid: true,
    errors: [],
    normalizedInput: {
      analyteSolutionVolumeL,
      components,
      titrant: {
        substanceId: titrantSubstance.id,
        substance: titrantSubstance,
        concentrationMolL: input.titrantConcentrationMolL,
      },
      analyteProfile,
      pairing,
    },
  };
}

export function normalizeSolutionTitrationInput(
  input: SolutionTitrationInput,
): NormalizedSolutionTitrationInput {
  const result = validateSolutionTitrationInput(input);
  if (!result.valid) {
    throw new SolutionTitrationInputError(result.errors[0]);
  }
  return result.normalizedInput;
}

/** Compiles only the normalized analyte solution; it does not plan boundaries or solve pH. */
export function compileNormalizedAnalyteComposition(
  input: NormalizedSolutionTitrationInput,
): CompiledSolutionComposition {
  return compileSolutionComposition(
    input.components.map(({ sourceComponentId, substanceId, amountMol }) => ({
      sourceComponentId,
      substanceId,
      amountMol,
    })),
    input.analyteSolutionVolumeL,
  );
}
