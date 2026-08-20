import { SUBSTANCES } from "../chemistry";
import { calculateTitrationCurve } from "../calculation";
import type { GraphStyle } from "../domain/graph-style";
import type { TitrationInput, TitrationResult } from "../domain/titration";
import { validateTitrationInput } from "../domain/validation";
import {
  applyExamPreset,
  applyTeachingPreset,
  createExamGraphStyle,
  renderTitrationSvg,
} from "../rendering";
import type { SamplingOptions } from "../sampling";

export interface TitrationDraft {
  analyteSubstanceId: string;
  analyteConcentrationMolL: string;
  analyteVolumeMl: string;
  titrantSubstanceId: string;
  titrantConcentrationMolL: string;
}

export type TitrationDraftField = keyof TitrationDraft;
export type UiErrorField = TitrationDraftField | "substancePair" | "calculation" | "rendering";

export interface UiError {
  code: string;
  field: UiErrorField;
  message: string;
}

export type ChemicalStatus = "success" | "invalid" | "calculation-error";

export interface ChemicalState {
  draft: TitrationDraft;
  validatedInput: TitrationInput | null;
  result: TitrationResult | null;
  status: ChemicalStatus;
  errors: UiError[];
  previewIsStale: boolean;
}

export interface RenderingState {
  graphStyle: GraphStyle;
  svgString: string | null;
  error: UiError | null;
  xRangeMode: "auto" | "manual";
}

export interface AppState {
  chemical: ChemicalState;
  rendering: RenderingState;
}

export interface AppDependencies {
  calculateCurve(input: TitrationInput, options?: SamplingOptions): TitrationResult;
  renderSvg(result: TitrationResult, style: GraphStyle): string;
}

export const DEFAULT_TITRATION_DRAFT: Readonly<TitrationDraft> = {
  analyteSubstanceId: "hcl",
  analyteConcentrationMolL: "0.100",
  analyteVolumeMl: "20.0",
  titrantSubstanceId: "naoh",
  titrantConcentrationMolL: "0.100",
};

export const DEFAULT_APP_DEPENDENCIES: AppDependencies = {
  calculateCurve: calculateTitrationCurve,
  renderSvg: renderTitrationSvg,
};

type DraftParseResult =
  | { ok: true; input: TitrationInput }
  | { ok: false; errors: UiError[] };

const NUMERIC_FIELDS: ReadonlyArray<{
  field: "analyteConcentrationMolL" | "analyteVolumeMl" | "titrantConcentrationMolL";
  label: string;
}> = [
  { field: "analyteConcentrationMolL", label: "滴定される水溶液の濃度" },
  { field: "analyteVolumeMl", label: "滴定される水溶液の体積" },
  { field: "titrantConcentrationMolL", label: "滴下する水溶液の濃度" },
];

function parseDraft(draft: TitrationDraft): DraftParseResult {
  const parsedValues: Partial<Record<(typeof NUMERIC_FIELDS)[number]["field"], number>> = {};
  const errors: UiError[] = [];

  for (const { field, label } of NUMERIC_FIELDS) {
    const rawValue = draft[field].trim();
    if (rawValue.length === 0) {
      errors.push({ code: "required", field, message: `${label}を入力してください。` });
      continue;
    }
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      errors.push({ code: "invalid-number", field, message: `${label}には有限の数値を入力してください。` });
      continue;
    }
    parsedValues[field] = value;
  }

  if (errors.length > 0) return { ok: false, errors };

  const input: TitrationInput = {
    analyteSubstanceId: draft.analyteSubstanceId,
    analyteConcentrationMolL: parsedValues.analyteConcentrationMolL ?? Number.NaN,
    analyteVolumeMl: parsedValues.analyteVolumeMl ?? Number.NaN,
    titrantSubstanceId: draft.titrantSubstanceId,
    titrantConcentrationMolL: parsedValues.titrantConcentrationMolL ?? Number.NaN,
  };
  const validation = validateTitrationInput(input, SUBSTANCES);
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.errors.map(({ code, field, message }) => ({ code, field, message })),
    };
  }
  return { ok: true, input };
}

function lastCurveVolume(result: TitrationResult): number {
  const lastPoint = result.points.at(-1);
  if (lastPoint === undefined) throw new Error("滴定曲線に計算点がありません。");
  return lastPoint.addedVolumeMl;
}

function calculationError(error: unknown): UiError {
  const code = error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : "calculation-failure";
  const messages: Record<string, string> = {
    "invalid-input": "入力条件が正しくありません。値と酸・塩基の組み合わせを確認してください。",
    "bracket-failure": "この条件ではpHの数値解を確定できませんでした。",
    "convergence-failure": "pH計算が収束しませんでした。入力条件を確認してください。",
    "non-finite-residual": "pH計算中に有限でない数値が発生しました。",
  };
  return {
    code,
    field: "calculation",
    message: messages[code] ?? "滴定曲線を計算できませんでした。入力条件を確認してください。",
  };
}

function renderingError(): UiError {
  return {
    code: "rendering-failure",
    field: "rendering",
    message: "現在の図版設定ではPreviewを描画できません。軸範囲や図の大きさを確認してください。",
  };
}

function renderState(
  result: TitrationResult | null,
  graphStyle: GraphStyle,
  previousSvg: string | null,
  dependencies: AppDependencies,
): Pick<RenderingState, "svgString" | "error"> {
  if (result === null) return { svgString: previousSvg, error: null };
  try {
    return { svgString: dependencies.renderSvg(result, graphStyle), error: null };
  } catch {
    return { svgString: previousSvg, error: renderingError() };
  }
}

export function createAppState(
  draft: TitrationDraft = { ...DEFAULT_TITRATION_DRAFT },
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  const parsed = parseDraft(draft);
  const fallbackStyle = createExamGraphStyle(30);
  if (!parsed.ok) {
    return {
      chemical: {
        draft: { ...draft },
        validatedInput: null,
        result: null,
        status: "invalid",
        errors: parsed.errors,
        previewIsStale: false,
      },
      rendering: {
        graphStyle: fallbackStyle,
        svgString: null,
        error: null,
        xRangeMode: "auto",
      },
    };
  }

  try {
    const result = dependencies.calculateCurve(parsed.input);
    const graphStyle = createExamGraphStyle(lastCurveVolume(result));
    const rendered = renderState(result, graphStyle, null, dependencies);
    return {
      chemical: {
        draft: { ...draft },
        validatedInput: parsed.input,
        result,
        status: "success",
        errors: [],
        previewIsStale: false,
      },
      rendering: {
        graphStyle,
        svgString: rendered.svgString,
        error: rendered.error,
        xRangeMode: "auto",
      },
    };
  } catch (error) {
    return {
      chemical: {
        draft: { ...draft },
        validatedInput: parsed.input,
        result: null,
        status: "calculation-error",
        errors: [calculationError(error)],
        previewIsStale: false,
      },
      rendering: {
        graphStyle: fallbackStyle,
        svgString: null,
        error: null,
        xRangeMode: "auto",
      },
    };
  }
}

function calculateForDraft(
  state: AppState,
  draft: TitrationDraft,
  dependencies: AppDependencies,
  forcedMaxVolumeMl?: number,
): AppState {
  const parsed = parseDraft(draft);
  if (!parsed.ok) {
    return {
      ...state,
      chemical: {
        ...state.chemical,
        draft,
        validatedInput: null,
        status: "invalid",
        errors: parsed.errors,
        previewIsStale: state.chemical.result !== null,
      },
    };
  }

  try {
    const options = forcedMaxVolumeMl === undefined ? {} : { maxVolumeMl: forcedMaxVolumeMl };
    const result = dependencies.calculateCurve(parsed.input, options);
    const graphStyle = state.rendering.xRangeMode === "auto" && forcedMaxVolumeMl === undefined
      ? {
          ...state.rendering.graphStyle,
          xMax: lastCurveVolume(result),
          xAxis: { ...state.rendering.graphStyle.xAxis, majorTickInterval: "auto" as const },
        }
      : state.rendering.graphStyle;
    const rendered = renderState(result, graphStyle, state.rendering.svgString, dependencies);
    return {
      chemical: {
        draft,
        validatedInput: parsed.input,
        result,
        status: "success",
        errors: [],
        previewIsStale: false,
      },
      rendering: {
        ...state.rendering,
        graphStyle,
        svgString: rendered.svgString,
        error: rendered.error,
      },
    };
  } catch (error) {
    return {
      ...state,
      chemical: {
        ...state.chemical,
        draft,
        validatedInput: parsed.input,
        status: "calculation-error",
        errors: [calculationError(error)],
        previewIsStale: state.chemical.result !== null,
      },
    };
  }
}

export function updateTitrationDraft(
  state: AppState,
  field: TitrationDraftField,
  value: string,
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  const draft = { ...state.chemical.draft, [field]: value };
  const forcedMaxVolumeMl = state.rendering.xRangeMode === "manual"
    ? state.rendering.graphStyle.xMax
    : undefined;
  return calculateForDraft(state, draft, dependencies, forcedMaxVolumeMl);
}

export function updateGraphStyle(
  state: AppState,
  update: (style: GraphStyle) => GraphStyle,
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  const graphStyle = update(structuredClone(state.rendering.graphStyle));
  const rendered = renderState(
    state.chemical.result,
    graphStyle,
    state.rendering.svgString,
    dependencies,
  );
  return {
    ...state,
    rendering: {
      ...state.rendering,
      graphStyle,
      svgString: rendered.svgString,
      error: rendered.error,
    },
  };
}

export function applyPresetToState(
  state: AppState,
  preset: "exam" | "teaching",
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  return updateGraphStyle(
    state,
    (style) => preset === "exam" ? applyExamPreset(style) : applyTeachingPreset(style),
    dependencies,
  );
}

export function updateXMax(
  state: AppState,
  xMax: number,
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  if (!Number.isFinite(xMax) || xMax <= state.rendering.graphStyle.xMin) return state;
  const withRange: AppState = {
    ...state,
    rendering: {
      ...state.rendering,
      graphStyle: {
        ...state.rendering.graphStyle,
        presetOrigin: "custom",
        xMax,
        xAxis: { ...state.rendering.graphStyle.xAxis, majorTickInterval: "auto" },
      },
      xRangeMode: "manual",
    },
  };
  return calculateForDraft(withRange, state.chemical.draft, dependencies, xMax);
}

export function useAutomaticXRange(
  state: AppState,
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  const automaticState: AppState = {
    ...state,
    rendering: { ...state.rendering, xRangeMode: "auto" },
  };
  return calculateForDraft(automaticState, state.chemical.draft, dependencies);
}

export function canExportSvg(state: AppState): boolean {
  return state.chemical.status === "success" &&
    !state.chemical.previewIsStale &&
    state.rendering.error === null &&
    state.rendering.svgString !== null;
}

export function errorsForField(state: AppState, field: UiErrorField): UiError[] {
  return state.chemical.errors.filter((error) => error.field === field);
}
