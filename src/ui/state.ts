import { validateAnalyticalSystemInput } from "../chemistry";
import { calculateTitrationCurve } from "../calculation";
import type { GraphStyle } from "../domain/graph-style";
import type { TitrationInput, TitrationResult } from "../domain/titration";
import type { ValidationError } from "../domain/validation";
import type { PngBackgroundMode, PngExportOptions, PngExportScale } from "../export";
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
  aspectRatio: AspectRatioState;
  pngExportOptions: PngExportOptions;
}

export type AspectRatioPreset = "free" | "1:1" | "4:3" | "3:2" | "16:9" | "custom";

export interface AspectRatioState {
  locked: boolean;
  widthRatioInput: string;
  heightRatioInput: string;
  preset: AspectRatioPreset;
  error: string | null;
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

export const ASPECT_RATIO_PRESETS: Readonly<Record<Exclude<AspectRatioPreset, "custom">, readonly [number, number] | null>> = {
  free: null,
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:2": [3, 2],
  "16:9": [16, 9],
};

const DEFAULT_ASPECT_RATIO: Readonly<AspectRatioState> = {
  locked: true,
  widthRatioInput: "4",
  heightRatioInput: "3",
  preset: "4:3",
  error: null,
};

export const DEFAULT_PNG_EXPORT_OPTIONS: Readonly<PngExportOptions> = {
  scale: 2,
  background: "preserve",
};

type DraftParseResult =
  | { ok: true; input: TitrationInput }
  | { ok: false; errors: UiError[] };

export function toUiValidationErrors(
  errors: readonly ValidationError[],
): UiError[] {
  return errors.map(({ code, field, message }) => ({ code, field, message }));
}

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
  const validation = validateAnalyticalSystemInput(input);
  if (!validation.valid) {
    return {
      ok: false,
      errors: toUiValidationErrors(validation.errors),
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
    message: "現在の図版設定ではプレビューを描画できません。軸範囲や図の大きさを確認してください。",
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
        aspectRatio: { ...DEFAULT_ASPECT_RATIO },
        pngExportOptions: { ...DEFAULT_PNG_EXPORT_OPTIONS },
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
        aspectRatio: { ...DEFAULT_ASPECT_RATIO },
        pngExportOptions: { ...DEFAULT_PNG_EXPORT_OPTIONS },
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
        aspectRatio: { ...DEFAULT_ASPECT_RATIO },
        pngExportOptions: { ...DEFAULT_PNG_EXPORT_OPTIONS },
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
  const updated = updateGraphStyle(
    state,
    (style) => preset === "exam" ? applyExamPreset(style) : applyTeachingPreset(style),
    dependencies,
  );
  const [widthRatio, heightRatio] = preset === "exam" ? [4, 3] : [3, 2];
  return {
    ...updated,
    rendering: {
      ...updated.rendering,
      aspectRatio: {
        locked: true,
        widthRatioInput: String(widthRatio),
        heightRatioInput: String(heightRatio),
        preset: preset === "exam" ? "4:3" : "3:2",
        error: null,
      },
    },
  };
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

function parseAspectRatio(aspectRatio: AspectRatioState): readonly [number, number] | null {
  const widthRatio = Number(aspectRatio.widthRatioInput.trim());
  const heightRatio = Number(aspectRatio.heightRatioInput.trim());
  if (
    aspectRatio.widthRatioInput.trim().length === 0 ||
    aspectRatio.heightRatioInput.trim().length === 0 ||
    !Number.isFinite(widthRatio) ||
    !Number.isFinite(heightRatio) ||
    widthRatio <= 0 ||
    heightRatio <= 0
  ) {
    return null;
  }
  return [widthRatio, heightRatio];
}

function aspectRatioError(): string {
  return "横比率と縦比率には0より大きい有限の数値を入力してください。";
}

function roundFigureDimension(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function updateFigureStyle(
  state: AppState,
  width: number,
  height: number,
  aspectRatio: AspectRatioState,
  dependencies: AppDependencies,
): AppState {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return state;
  }
  const updated = updateGraphStyle(
    state,
    (style) => ({ ...style, presetOrigin: "custom", width, height }),
    dependencies,
  );
  return {
    ...updated,
    rendering: { ...updated.rendering, aspectRatio: { ...aspectRatio, error: null } },
  };
}

export function setAspectRatioLock(
  state: AppState,
  locked: boolean,
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  if (!locked) {
    return {
      ...state,
      rendering: {
        ...state.rendering,
        aspectRatio: { ...state.rendering.aspectRatio, locked: false, preset: "free", error: null },
      },
    };
  }
  const ratio = parseAspectRatio(state.rendering.aspectRatio);
  if (ratio === null) {
    return {
      ...state,
      rendering: {
        ...state.rendering,
        aspectRatio: { ...state.rendering.aspectRatio, error: aspectRatioError() },
      },
    };
  }
  const [widthRatio, heightRatio] = ratio;
  const aspectRatio = { ...state.rendering.aspectRatio, locked: true, error: null };
  return updateFigureStyle(
    state,
    state.rendering.graphStyle.width,
    roundFigureDimension(state.rendering.graphStyle.width * heightRatio / widthRatio),
    aspectRatio,
    dependencies,
  );
}

export function selectAspectRatioPreset(
  state: AppState,
  preset: Exclude<AspectRatioPreset, "custom">,
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  const ratio = ASPECT_RATIO_PRESETS[preset];
  if (ratio === null) {
    return {
      ...state,
      rendering: {
        ...state.rendering,
        aspectRatio: { ...state.rendering.aspectRatio, locked: false, preset: "free", error: null },
      },
    };
  }
  const [widthRatio, heightRatio] = ratio;
  const aspectRatio: AspectRatioState = {
    locked: true,
    widthRatioInput: String(widthRatio),
    heightRatioInput: String(heightRatio),
    preset,
    error: null,
  };
  return updateFigureStyle(
    state,
    state.rendering.graphStyle.width,
    roundFigureDimension(state.rendering.graphStyle.width * heightRatio / widthRatio),
    aspectRatio,
    dependencies,
  );
}

export function updateAspectRatioInput(
  state: AppState,
  side: "width" | "height",
  rawValue: string,
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  const aspectRatio: AspectRatioState = {
    ...state.rendering.aspectRatio,
    widthRatioInput: side === "width" ? rawValue : state.rendering.aspectRatio.widthRatioInput,
    heightRatioInput: side === "height" ? rawValue : state.rendering.aspectRatio.heightRatioInput,
    preset: "custom",
    error: null,
  };
  const ratio = parseAspectRatio(aspectRatio);
  if (ratio === null) {
    return {
      ...state,
      rendering: {
        ...state.rendering,
        aspectRatio: { ...aspectRatio, error: aspectRatioError() },
      },
    };
  }
  if (!aspectRatio.locked) {
    return {
      ...state,
      rendering: { ...state.rendering, aspectRatio },
    };
  }
  const [widthRatio, heightRatio] = ratio;
  return updateFigureStyle(
    state,
    state.rendering.graphStyle.width,
    roundFigureDimension(state.rendering.graphStyle.width * heightRatio / widthRatio),
    aspectRatio,
    dependencies,
  );
}

export function updateFigureWidth(
  state: AppState,
  width: number,
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  if (!Number.isFinite(width) || width <= 0) return state;
  const ratio = parseAspectRatio(state.rendering.aspectRatio);
  const height = state.rendering.aspectRatio.locked && ratio !== null
    ? roundFigureDimension(width * ratio[1] / ratio[0])
    : state.rendering.graphStyle.height;
  return updateFigureStyle(state, width, height, state.rendering.aspectRatio, dependencies);
}

export function updateFigureHeight(
  state: AppState,
  height: number,
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  if (!Number.isFinite(height) || height <= 0) return state;
  const ratio = parseAspectRatio(state.rendering.aspectRatio);
  const width = state.rendering.aspectRatio.locked && ratio !== null
    ? roundFigureDimension(height * ratio[0] / ratio[1])
    : state.rendering.graphStyle.width;
  return updateFigureStyle(state, width, height, state.rendering.aspectRatio, dependencies);
}

export function canExportSvg(state: AppState): boolean {
  return state.chemical.status === "success" &&
    !state.chemical.previewIsStale &&
    state.rendering.error === null &&
    state.rendering.svgString !== null;
}

export function canExportPng(state: AppState): boolean {
  return canExportSvg(state);
}

export function updatePngExportOptions(
  state: AppState,
  update: Partial<{ scale: PngExportScale; background: PngBackgroundMode }>,
): AppState {
  return {
    ...state,
    rendering: {
      ...state.rendering,
      pngExportOptions: { ...state.rendering.pngExportOptions, ...update },
    },
  };
}

export function errorsForField(state: AppState, field: UiErrorField): UiError[] {
  return state.chemical.errors.filter((error) => error.field === field);
}
