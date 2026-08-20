import type { Substance } from "./chemistry";
import type { TitrationInput } from "./titration";

export type ValidationErrorCode =
  | "non-finite-number"
  | "non-positive-number"
  | "same-substance"
  | "unknown-substance"
  | "incompatible-acid-base-pair";

export type ValidationField = keyof TitrationInput | "substancePair";

export interface ValidationError {
  code: ValidationErrorCode;
  field: ValidationField;
  message: string;
}

export type ValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: ValidationError[] };

function validatePositiveFinite(
  value: number,
  field: keyof TitrationInput,
  label: string,
  errors: ValidationError[],
): void {
  if (!Number.isFinite(value)) {
    errors.push({
      code: "non-finite-number",
      field,
      message: `${label}には有限の数値を指定してください。`,
    });
    return;
  }

  if (value <= 0) {
    errors.push({
      code: "non-positive-number",
      field,
      message: `${label}には0より大きい値を指定してください。`,
    });
  }
}

function formsAcidBasePair(analyte: Substance, titrant: Substance): boolean {
  const analyteIsAcid = analyte.roles.includes("acid");
  const analyteIsBase = analyte.roles.includes("base");
  const titrantIsAcid = titrant.roles.includes("acid");
  const titrantIsBase = titrant.roles.includes("base");

  return (
    (analyteIsAcid && titrantIsBase) ||
    (analyteIsBase && titrantIsAcid)
  );
}

export function validateTitrationInput(
  input: TitrationInput,
  substances: readonly Substance[],
): ValidationResult {
  const errors: ValidationError[] = [];

  validatePositiveFinite(
    input.analyteConcentrationMolL,
    "analyteConcentrationMolL",
    "Analyte濃度",
    errors,
  );
  validatePositiveFinite(
    input.analyteVolumeMl,
    "analyteVolumeMl",
    "Analyte体積",
    errors,
  );
  validatePositiveFinite(
    input.titrantConcentrationMolL,
    "titrantConcentrationMolL",
    "Titrant濃度",
    errors,
  );

  const substanceById = new Map(
    substances.map((substance) => [substance.id, substance]),
  );
  const analyte = substanceById.get(input.analyteSubstanceId);
  const titrant = substanceById.get(input.titrantSubstanceId);

  if (analyte === undefined) {
    errors.push({
      code: "unknown-substance",
      field: "analyteSubstanceId",
      message: "Analyteの物質IDが物質マスターに登録されていません。",
    });
  }

  if (titrant === undefined) {
    errors.push({
      code: "unknown-substance",
      field: "titrantSubstanceId",
      message: "Titrantの物質IDが物質マスターに登録されていません。",
    });
  }

  if (
    analyte !== undefined &&
    titrant !== undefined &&
    analyte.id === titrant.id
  ) {
    errors.push({
      code: "same-substance",
      field: "substancePair",
      message: "AnalyteとTitrantには異なる物質を指定してください。",
    });
  } else if (
    analyte !== undefined &&
    titrant !== undefined &&
    !formsAcidBasePair(analyte, titrant)
  ) {
    errors.push({
      code: "incompatible-acid-base-pair",
      field: "substancePair",
      message: "AnalyteとTitrantには酸と塩基の組み合わせを指定してください。",
    });
  }

  return errors.length === 0
    ? { valid: true, errors: [] }
    : { valid: false, errors };
}
