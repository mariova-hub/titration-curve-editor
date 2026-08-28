import packageMetadata from "../../package.json";

import { SUBSTANCES } from "../chemistry";
import {
  AXIS_LABEL_ORIENTATIONS,
  LINE_PATTERNS,
  TICK_DIRECTIONS,
  isSolutionTitrationInput,
  type AxisStyle,
  type CharacteristicPointStyle,
  type EquivalenceGuideStyle,
  type GraphStyle,
  type GridStyle,
  type LineStyle,
  type MarkerStyle,
  type TitrationCurveInput,
} from "../domain";
import { createObjectUrlLease } from "../export";
import {
  DEFAULT_APP_DEPENDENCIES,
  parseTitrationDraft,
  type AppDependencies,
  type AppState,
  type AspectRatioPreset,
  type TitrationDraft,
} from "../ui/state";

export const TCURVE_SCHEMA_VERSION = 1 as const;
export const APP_VERSION = packageMetadata.version;
export const DEFAULT_TCURVE_FILENAME = "titration-project.tcurve";
export const TCURVE_MIME_TYPE = "application/json;charset=utf-8";
export const TCURVE_FILE_ACCEPT = ".tcurve,application/json";

const ASPECT_RATIO_PRESETS = ["free", "1:1", "4:3", "3:2", "16:9", "custom"] as const;
const X_RANGE_MODES = ["auto", "manual"] as const;
const GRAPH_PRESETS = ["exam", "teaching", "custom"] as const;
const GRAPH_BACKGROUNDS = ["white", "transparent"] as const;
const PNG_SCALES = [1, 2, 4] as const;
const PNG_BACKGROUNDS = ["preserve", "white", "transparent"] as const;
const LABEL_POSITION_MODES = ["auto", "custom"] as const;
const SUBSTANCE_IDS = new Set(SUBSTANCES.map(({ id }) => id));
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export interface SerializableAnalyteComponent {
  substanceId: string;
  concentrationMolL: number;
}

export interface SerializableSingleAnalyte {
  mode: "single";
  substanceId: string;
  concentrationMolL: number;
  volumeMl: number;
}

export interface SerializableMixedAnalyte {
  mode: "mixed";
  volumeMl: number;
  components: readonly [SerializableAnalyteComponent, SerializableAnalyteComponent];
}

export type SerializableAnalyte = SerializableSingleAnalyte | SerializableMixedAnalyte;

export interface SerializableTitrationInput {
  analyte: SerializableAnalyte;
  titrant: {
    substanceId: string;
    concentrationMolL: number;
  };
}

export interface SerializableFeatureStyle {
  showAll: boolean;
  line: LineStyle;
  marker: MarkerStyle;
}

export interface SerializableGraphStyle {
  presetOrigin: "exam" | "teaching" | "custom";
  width: number;
  height: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  curve: LineStyle;
  xAxis: AxisStyle;
  yAxis: AxisStyle;
  horizontalGrid: GridStyle;
  verticalGrid: GridStyle;
  equivalenceGuides: SerializableFeatureStyle;
  characteristicPoints: SerializableFeatureStyle;
  title: GraphStyle["title"];
  typography: GraphStyle["typography"];
  background: GraphStyle["background"];
}

export interface SerializableProjectState {
  input: SerializableTitrationInput;
  rendering: {
    graphStyle: SerializableGraphStyle;
    xRangeMode: "auto" | "manual";
    aspectRatio: {
      locked: boolean;
      widthRatio: number;
      heightRatio: number;
      preset: AspectRatioPreset;
    };
    pngExportOptions: {
      scale: 1 | 2 | 4;
      background: "preserve" | "white" | "transparent";
    };
  };
}

export interface TcurveProjectFile {
  schemaVersion: typeof TCURVE_SCHEMA_VERSION;
  appVersion: string;
  savedAt: string;
  state: SerializableProjectState;
}

export type ProjectFileErrorCode =
  | "malformed-json"
  | "invalid-project"
  | "unsupported-schema-version";

export class ProjectFileError extends Error {
  constructor(
    readonly code: ProjectFileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectFileError";
  }
}

export interface TcurveFileArtifact {
  filename: string;
  blob: Blob;
  project: TcurveProjectFile;
}

type JsonObject = Record<string, unknown>;

function invalid(path: string): never {
  throw new ProjectFileError("invalid-project", `Invalid project field: ${path}`);
}

function objectValue(value: unknown, path: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid(path);
  return value as JsonObject;
}

function stringValue(value: unknown, path: string, maximumLength = 1_000): string {
  if (typeof value !== "string" || value.length > maximumLength) invalid(path);
  return value;
}

function nonEmptyString(value: unknown, path: string, maximumLength = 200): string {
  const result = stringValue(value, path, maximumLength);
  if (result.trim().length === 0) invalid(path);
  return result;
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") invalid(path);
  return value;
}

function finiteNumber(
  value: unknown,
  path: string,
  options: { minimum?: number; maximum?: number; exclusiveMinimum?: number } = {},
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid(path);
  if (options.minimum !== undefined && value < options.minimum) invalid(path);
  if (options.maximum !== undefined && value > options.maximum) invalid(path);
  if (options.exclusiveMinimum !== undefined && value <= options.exclusiveMinimum) invalid(path);
  return value;
}

function enumValue<const T extends readonly (string | number)[]>(
  value: unknown,
  values: T,
  path: string,
): T[number] {
  if (!values.includes(value as T[number])) invalid(path);
  return value as T[number];
}

function substanceId(value: unknown, path: string): string {
  const id = nonEmptyString(value, path);
  if (!SUBSTANCE_IDS.has(id)) invalid(path);
  return id;
}

function readColor(value: unknown, path: string): string {
  const color = stringValue(value, path, 7);
  if (!HEX_COLOR.test(color)) invalid(path);
  return color;
}

function readLineStyle(value: unknown, path: string): LineStyle {
  const source = objectValue(value, path);
  return {
    visible: booleanValue(source.visible, `${path}.visible`),
    width: finiteNumber(source.width, `${path}.width`, { exclusiveMinimum: 0, maximum: 8 }),
    pattern: enumValue(source.pattern, LINE_PATTERNS, `${path}.pattern`),
    color: readColor(source.color, `${path}.color`),
  };
}

function readMarkerStyle(value: unknown, path: string): MarkerStyle {
  const source = objectValue(value, path);
  return {
    visible: booleanValue(source.visible, `${path}.visible`),
    color: readColor(source.color, `${path}.color`),
    radius: finiteNumber(source.radius, `${path}.radius`, { exclusiveMinimum: 0, maximum: 100 }),
  };
}

function readInterval(value: unknown, path: string): number | "auto" {
  return value === "auto"
    ? "auto"
    : finiteNumber(value, path, { exclusiveMinimum: 0 });
}

function readAxisStyle(value: unknown, path: string): AxisStyle {
  const source = objectValue(value, path);
  const minorTickInterval = source.minorTickInterval === undefined
    ? undefined
    : readInterval(source.minorTickInterval, `${path}.minorTickInterval`);
  const labelPosition = objectValue(source.labelPosition, `${path}.labelPosition`);
  const axis: AxisStyle = {
    visible: booleanValue(source.visible, `${path}.visible`),
    showLabel: booleanValue(source.showLabel, `${path}.showLabel`),
    label: stringValue(source.label, `${path}.label`),
    line: readLineStyle(source.line, `${path}.line`),
    majorTickInterval: readInterval(source.majorTickInterval, `${path}.majorTickInterval`),
    showMajorTicks: booleanValue(source.showMajorTicks, `${path}.showMajorTicks`),
    showMinorTicks: booleanValue(source.showMinorTicks, `${path}.showMinorTicks`),
    showTickLabels: booleanValue(source.showTickLabels, `${path}.showTickLabels`),
    showZeroLabel: booleanValue(source.showZeroLabel, `${path}.showZeroLabel`),
    tickLength: finiteNumber(source.tickLength, `${path}.tickLength`, { minimum: 0, maximum: 100 }),
    tickWidth: finiteNumber(source.tickWidth, `${path}.tickWidth`, { exclusiveMinimum: 0, maximum: 8 }),
    tickDirection: enumValue(source.tickDirection, TICK_DIRECTIONS, `${path}.tickDirection`),
    labelOrientation: enumValue(
      source.labelOrientation,
      AXIS_LABEL_ORIENTATIONS,
      `${path}.labelOrientation`,
    ),
    labelPosition: {
      mode: enumValue(labelPosition.mode, LABEL_POSITION_MODES, `${path}.labelPosition.mode`),
      alongAxis: finiteNumber(labelPosition.alongAxis, `${path}.labelPosition.alongAxis`, {
        minimum: 0,
        maximum: 1,
      }),
      offsetPx: finiteNumber(labelPosition.offsetPx, `${path}.labelPosition.offsetPx`, {
        minimum: 0,
        maximum: 100,
      }),
    },
  };
  if (minorTickInterval !== undefined) axis.minorTickInterval = minorTickInterval;
  return axis;
}

function readGridStyle(value: unknown, path: string): GridStyle {
  const source = objectValue(value, path);
  return {
    visible: booleanValue(source.visible, `${path}.visible`),
    line: readLineStyle(source.line, `${path}.line`),
  };
}

function readFeatureStyle(value: unknown, path: string): SerializableFeatureStyle {
  const source = objectValue(value, path);
  return {
    showAll: booleanValue(source.showAll, `${path}.showAll`),
    line: readLineStyle(source.line, `${path}.line`),
    marker: readMarkerStyle(source.marker, `${path}.marker`),
  };
}

function readGraphStyle(value: unknown, path: string): SerializableGraphStyle {
  const source = objectValue(value, path);
  const title = objectValue(source.title, `${path}.title`);
  const typography = objectValue(source.typography, `${path}.typography`);
  const xMin = finiteNumber(source.xMin, `${path}.xMin`);
  const xMax = finiteNumber(source.xMax, `${path}.xMax`);
  const yMin = finiteNumber(source.yMin, `${path}.yMin`);
  const yMax = finiteNumber(source.yMax, `${path}.yMax`);
  if (xMax <= xMin) invalid(`${path}.xMax`);
  if (yMax <= yMin) invalid(`${path}.yMax`);
  return {
    presetOrigin: enumValue(source.presetOrigin, GRAPH_PRESETS, `${path}.presetOrigin`),
    width: finiteNumber(source.width, `${path}.width`, { minimum: 240, maximum: 2_400 }),
    height: finiteNumber(source.height, `${path}.height`, { minimum: 180, maximum: 1_800 }),
    xMin,
    xMax,
    yMin,
    yMax,
    curve: readLineStyle(source.curve, `${path}.curve`),
    xAxis: readAxisStyle(source.xAxis, `${path}.xAxis`),
    yAxis: readAxisStyle(source.yAxis, `${path}.yAxis`),
    horizontalGrid: readGridStyle(source.horizontalGrid, `${path}.horizontalGrid`),
    verticalGrid: readGridStyle(source.verticalGrid, `${path}.verticalGrid`),
    equivalenceGuides: readFeatureStyle(source.equivalenceGuides, `${path}.equivalenceGuides`),
    characteristicPoints: readFeatureStyle(
      source.characteristicPoints,
      `${path}.characteristicPoints`,
    ),
    title: {
      visible: booleanValue(title.visible, `${path}.title.visible`),
      text: stringValue(title.text, `${path}.title.text`),
    },
    typography: {
      tickLabelFontSizePt: finiteNumber(
        typography.tickLabelFontSizePt,
        `${path}.typography.tickLabelFontSizePt`,
        { minimum: 6, maximum: 48 },
      ),
      tickLabelFontFamily: nonEmptyString(
        typography.tickLabelFontFamily,
        `${path}.typography.tickLabelFontFamily`,
      ),
      axisLabelFontSizePt: finiteNumber(
        typography.axisLabelFontSizePt,
        `${path}.typography.axisLabelFontSizePt`,
        { minimum: 6, maximum: 48 },
      ),
      axisLabelFontFamily: nonEmptyString(
        typography.axisLabelFontFamily,
        `${path}.typography.axisLabelFontFamily`,
      ),
      titleFontSizePt: finiteNumber(
        typography.titleFontSizePt,
        `${path}.typography.titleFontSizePt`,
        { minimum: 6, maximum: 48 },
      ),
      titleFontFamily: nonEmptyString(
        typography.titleFontFamily,
        `${path}.typography.titleFontFamily`,
      ),
    },
    background: enumValue(source.background, GRAPH_BACKGROUNDS, `${path}.background`),
  };
}

function readAnalyte(value: unknown, path: string): SerializableAnalyte {
  const source = objectValue(value, path);
  if (source.mode === "single") {
    return {
      mode: "single",
      substanceId: substanceId(source.substanceId, `${path}.substanceId`),
      concentrationMolL: finiteNumber(source.concentrationMolL, `${path}.concentrationMolL`, {
        exclusiveMinimum: 0,
      }),
      volumeMl: finiteNumber(source.volumeMl, `${path}.volumeMl`, { exclusiveMinimum: 0 }),
    };
  }
  if (source.mode === "mixed") {
    if (!Array.isArray(source.components) || source.components.length !== 2) {
      invalid(`${path}.components`);
    }
    const components = source.components.map((component, index) => {
      const item = objectValue(component, `${path}.components.${index}`);
      return {
        substanceId: substanceId(item.substanceId, `${path}.components.${index}.substanceId`),
        concentrationMolL: finiteNumber(
          item.concentrationMolL,
          `${path}.components.${index}.concentrationMolL`,
          { exclusiveMinimum: 0 },
        ),
      };
    });
    return {
      mode: "mixed",
      volumeMl: finiteNumber(source.volumeMl, `${path}.volumeMl`, { exclusiveMinimum: 0 }),
      components: [components[0]!, components[1]!],
    };
  }
  return invalid(`${path}.mode`);
}

function inputToDraft(input: SerializableTitrationInput): TitrationDraft {
  if (input.analyte.mode === "single") {
    return {
      analyteSubstanceId: input.analyte.substanceId,
      analyteConcentrationMolL: String(input.analyte.concentrationMolL),
      analyteVolumeMl: String(input.analyte.volumeMl),
      titrantSubstanceId: input.titrant.substanceId,
      titrantConcentrationMolL: String(input.titrant.concentrationMolL),
    };
  }
  return {
    analyteSubstanceId: input.analyte.components[0].substanceId,
    analyteConcentrationMolL: String(input.analyte.components[0].concentrationMolL),
    analyteVolumeMl: String(input.analyte.volumeMl),
    analyteComponent2SubstanceId: input.analyte.components[1].substanceId,
    analyteComponent2ConcentrationMolL: String(input.analyte.components[1].concentrationMolL),
    titrantSubstanceId: input.titrant.substanceId,
    titrantConcentrationMolL: String(input.titrant.concentrationMolL),
  };
}

function readProjectState(value: unknown): SerializableProjectState {
  const source = objectValue(value, "state");
  const input = objectValue(source.input, "state.input");
  const titrant = objectValue(input.titrant, "state.input.titrant");
  const rendering = objectValue(source.rendering, "state.rendering");
  const aspectRatio = objectValue(rendering.aspectRatio, "state.rendering.aspectRatio");
  const pngExportOptions = objectValue(
    rendering.pngExportOptions,
    "state.rendering.pngExportOptions",
  );
  const result: SerializableProjectState = {
    input: {
      analyte: readAnalyte(input.analyte, "state.input.analyte"),
      titrant: {
        substanceId: substanceId(titrant.substanceId, "state.input.titrant.substanceId"),
        concentrationMolL: finiteNumber(
          titrant.concentrationMolL,
          "state.input.titrant.concentrationMolL",
          { exclusiveMinimum: 0 },
        ),
      },
    },
    rendering: {
      graphStyle: readGraphStyle(rendering.graphStyle, "state.rendering.graphStyle"),
      xRangeMode: enumValue(rendering.xRangeMode, X_RANGE_MODES, "state.rendering.xRangeMode"),
      aspectRatio: {
        locked: booleanValue(aspectRatio.locked, "state.rendering.aspectRatio.locked"),
        widthRatio: finiteNumber(
          aspectRatio.widthRatio,
          "state.rendering.aspectRatio.widthRatio",
          { exclusiveMinimum: 0 },
        ),
        heightRatio: finiteNumber(
          aspectRatio.heightRatio,
          "state.rendering.aspectRatio.heightRatio",
          { exclusiveMinimum: 0 },
        ),
        preset: enumValue(
          aspectRatio.preset,
          ASPECT_RATIO_PRESETS,
          "state.rendering.aspectRatio.preset",
        ),
      },
      pngExportOptions: {
        scale: enumValue(pngExportOptions.scale, PNG_SCALES, "state.rendering.pngExportOptions.scale"),
        background: enumValue(
          pngExportOptions.background,
          PNG_BACKGROUNDS,
          "state.rendering.pngExportOptions.background",
        ),
      },
    },
  };
  const parsed = parseTitrationDraft(inputToDraft(result.input));
  if (!parsed.ok) invalid("state.input");
  return result;
}

function serializeInput(input: TitrationCurveInput): SerializableTitrationInput {
  if (isSolutionTitrationInput(input)) {
    if (input.analyteSolution.components.length !== 2) invalid("state.input.analyte.components");
    return {
      analyte: {
        mode: "mixed",
        volumeMl: input.analyteSolution.totalVolumeMl,
        components: [
          {
            substanceId: input.analyteSolution.components[0]!.substanceId,
            concentrationMolL: input.analyteSolution.components[0]!.concentrationMolL,
          },
          {
            substanceId: input.analyteSolution.components[1]!.substanceId,
            concentrationMolL: input.analyteSolution.components[1]!.concentrationMolL,
          },
        ],
      },
      titrant: {
        substanceId: input.titrantSubstanceId,
        concentrationMolL: input.titrantConcentrationMolL,
      },
    };
  }
  return {
    analyte: {
      mode: "single",
      substanceId: input.analyteSubstanceId,
      concentrationMolL: input.analyteConcentrationMolL,
      volumeMl: input.analyteVolumeMl,
    },
    titrant: {
      substanceId: input.titrantSubstanceId,
      concentrationMolL: input.titrantConcentrationMolL,
    },
  };
}

function serializeFeatureStyle(
  feature: EquivalenceGuideStyle | CharacteristicPointStyle,
): SerializableFeatureStyle {
  return {
    showAll: feature.showAll,
    line: { ...feature.line },
    marker: { ...feature.marker },
  };
}

function serializeGraphStyle(style: GraphStyle): SerializableGraphStyle {
  return {
    presetOrigin: style.presetOrigin ?? "custom",
    width: style.width,
    height: style.height,
    xMin: style.xMin,
    xMax: style.xMax,
    yMin: style.yMin,
    yMax: style.yMax,
    curve: { ...style.curve },
    xAxis: structuredClone(style.xAxis),
    yAxis: structuredClone(style.yAxis),
    horizontalGrid: structuredClone(style.horizontalGrid),
    verticalGrid: structuredClone(style.verticalGrid),
    equivalenceGuides: serializeFeatureStyle(style.equivalenceGuides),
    characteristicPoints: serializeFeatureStyle(style.characteristicPoints),
    title: { ...style.title },
    typography: { ...style.typography },
    background: style.background,
  };
}

function deserializeGraphStyle(style: SerializableGraphStyle): GraphStyle {
  return {
    ...structuredClone(style),
    equivalenceGuides: {
      ...structuredClone(style.equivalenceGuides),
      visibilityById: {},
    },
    characteristicPoints: {
      ...structuredClone(style.characteristicPoints),
      visibilityById: {},
    },
    annotationsVisible: false,
  };
}

export function canSaveProject(state: AppState): boolean {
  const widthRatio = Number(state.rendering.aspectRatio.widthRatioInput.trim());
  const heightRatio = Number(state.rendering.aspectRatio.heightRatioInput.trim());
  return state.chemical.status === "success" &&
    !state.chemical.previewIsStale &&
    state.chemical.validatedInput !== null &&
    Number.isFinite(widthRatio) &&
    widthRatio > 0 &&
    Number.isFinite(heightRatio) &&
    heightRatio > 0;
}

export function serializeProject(
  state: AppState,
  appVersion = APP_VERSION,
  savedAt = new Date().toISOString(),
): TcurveProjectFile {
  if (!canSaveProject(state) || state.chemical.validatedInput === null) {
    throw new ProjectFileError("invalid-project", "Only a current valid project can be saved.");
  }
  const widthRatio = Number(state.rendering.aspectRatio.widthRatioInput);
  const heightRatio = Number(state.rendering.aspectRatio.heightRatioInput);
  const project: TcurveProjectFile = {
    schemaVersion: TCURVE_SCHEMA_VERSION,
    appVersion,
    savedAt,
    state: {
      input: serializeInput(state.chemical.validatedInput),
      rendering: {
        graphStyle: serializeGraphStyle(state.rendering.graphStyle),
        xRangeMode: state.rendering.xRangeMode,
        aspectRatio: {
          locked: state.rendering.aspectRatio.locked,
          widthRatio,
          heightRatio,
          preset: state.rendering.aspectRatio.preset,
        },
        pngExportOptions: {
          scale: state.rendering.pngExportOptions.scale as 1 | 2 | 4,
          background: state.rendering.pngExportOptions.background,
        },
      },
    },
  };
  return validateTcurveProject(project);
}

export function migrateProjectToCurrentSchema(value: unknown): unknown {
  const source = objectValue(value, "project");
  if (!("schemaVersion" in source)) invalid("schemaVersion");
  if (typeof source.schemaVersion !== "number" || !Number.isInteger(source.schemaVersion)) {
    invalid("schemaVersion");
  }
  if (source.schemaVersion > TCURVE_SCHEMA_VERSION) {
    throw new ProjectFileError(
      "unsupported-schema-version",
      `Unsupported project schema version: ${String(source.schemaVersion)}`,
    );
  }
  if (source.schemaVersion !== TCURVE_SCHEMA_VERSION) invalid("schemaVersion");
  return source;
}

export function validateTcurveProject(value: unknown): TcurveProjectFile {
  const source = objectValue(value, "project");
  if (source.schemaVersion !== TCURVE_SCHEMA_VERSION) invalid("schemaVersion");
  const appVersion = nonEmptyString(source.appVersion, "appVersion", 100);
  const savedAt = nonEmptyString(source.savedAt, "savedAt", 100);
  if (!Number.isFinite(Date.parse(savedAt))) invalid("savedAt");
  return {
    schemaVersion: TCURVE_SCHEMA_VERSION,
    appVersion,
    savedAt,
    state: readProjectState(source.state),
  };
}

export function parseTcurveFile(text: string): TcurveProjectFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new ProjectFileError("malformed-json", "Project file is not valid JSON.");
  }
  return validateTcurveProject(migrateProjectToCurrentSchema(parsed));
}

export function restoreProjectState(
  project: TcurveProjectFile,
  dependencies: AppDependencies = DEFAULT_APP_DEPENDENCIES,
): AppState {
  const validatedProject = validateTcurveProject(project);
  const draft = inputToDraft(validatedProject.state.input);
  const parsed = parseTitrationDraft(draft);
  if (!parsed.ok) invalid("state.input");
  const savedRendering = validatedProject.state.rendering;
  const options = savedRendering.xRangeMode === "manual"
    ? { maxVolumeMl: savedRendering.graphStyle.xMax }
    : undefined;
  const result = dependencies.calculateCurve(parsed.input, options);
  const lastPoint = result.points.at(-1);
  if (lastPoint === undefined) invalid("state.input");
  const graphStyle = deserializeGraphStyle(savedRendering.graphStyle);
  if (savedRendering.xRangeMode === "auto") graphStyle.xMax = lastPoint.addedVolumeMl;
  const svgString = dependencies.renderSvg(result, graphStyle);
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
      graphStyle,
      svgString,
      error: null,
      xRangeMode: savedRendering.xRangeMode,
      aspectRatio: {
        locked: savedRendering.aspectRatio.locked,
        widthRatioInput: String(savedRendering.aspectRatio.widthRatio),
        heightRatioInput: String(savedRendering.aspectRatio.heightRatio),
        preset: savedRendering.aspectRatio.preset,
        error: null,
      },
      pngExportOptions: { ...savedRendering.pngExportOptions },
    },
  };
}

function normalizeProjectFilename(filename: string): string {
  const trimmed = filename.trim();
  if (trimmed.length === 0) return DEFAULT_TCURVE_FILENAME;
  return trimmed.toLowerCase().endsWith(".tcurve") ? trimmed : `${trimmed}.tcurve`;
}

export function createTcurveFile(
  state: AppState,
  filename = DEFAULT_TCURVE_FILENAME,
  appVersion = APP_VERSION,
): TcurveFileArtifact {
  const project = serializeProject(state, appVersion);
  return {
    filename: normalizeProjectFilename(filename),
    blob: new Blob([`${JSON.stringify(project, null, 2)}\n`], { type: TCURVE_MIME_TYPE }),
    project,
  };
}

export function downloadProjectFile(
  state: AppState,
  filename = DEFAULT_TCURVE_FILENAME,
): void {
  const artifact = createTcurveFile(state, filename);
  const lease = createObjectUrlLease(artifact.blob);
  let cleanupScheduled = false;
  try {
    const link = document.createElement("a");
    link.href = lease.url;
    link.download = artifact.filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => lease.revoke(), 1_000);
    cleanupScheduled = true;
  } finally {
    if (!cleanupScheduled) lease.revoke();
  }
}

export function projectFileErrorMessage(error: unknown): string {
  if (error instanceof ProjectFileError && error.code === "unsupported-schema-version") {
    return "このプロジェクトファイルは新しい形式のため、このバージョンでは開けません。";
  }
  return "このプロジェクトファイルを読み込めませんでした。内容を確認してください。";
}
