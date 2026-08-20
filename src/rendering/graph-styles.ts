import type {
  AxisStyle,
  GraphStyle,
  GridStyle,
  LineStyle,
  MarkerStyle,
} from "../domain/graph-style";

function line(
  width: number,
  pattern: LineStyle["pattern"],
  color: string,
  visible = true,
): LineStyle {
  return { visible, width, pattern, color };
}

function marker(visible: boolean, color: string, radius: number): MarkerStyle {
  return { visible, color, radius };
}

function axis(label: string, majorTickInterval: number | "auto"): AxisStyle {
  return {
    visible: true,
    showLabel: true,
    label,
    line: line(1, "solid", "#000000"),
    majorTickInterval,
    showMajorTicks: true,
    showMinorTicks: false,
    showTickLabels: true,
    tickLength: 6,
    tickWidth: 1,
  };
}

function grid(visible: boolean): GridStyle {
  return { visible, line: line(0.75, "dotted", "#b8b8b8", visible) };
}

export function createDefaultGraphStyle(maxVolumeMl: number): GraphStyle {
  return {
    presetOrigin: "custom",
    width: 720,
    height: 480,
    xMin: 0,
    xMax: maxVolumeMl,
    yMin: 0,
    yMax: 14,
    curve: line(2, "solid", "#000000"),
    xAxis: axis("滴下量 / mL", "auto"),
    yAxis: axis("pH", 2),
    horizontalGrid: grid(false),
    verticalGrid: grid(false),
    equivalenceGuides: {
      showAll: false,
      visibilityById: {},
      line: line(1, "dashed", "#555555"),
      marker: marker(false, "#000000", 3),
    },
    characteristicPoints: {
      showAll: false,
      visibilityById: {},
      line: line(0.8, "dotted", "#777777"),
      marker: marker(false, "#000000", 2.5),
    },
    title: { visible: false, text: "滴定曲線" },
    background: "white",
    annotationsVisible: false,
  };
}

function blackAxis(source: AxisStyle): AxisStyle {
  return {
    ...source,
    visible: true,
    showLabel: true,
    line: line(1, "solid", "#000000"),
    showMajorTicks: true,
    showMinorTicks: false,
    showTickLabels: true,
  };
}

export function applyExamPreset(style: GraphStyle): GraphStyle {
  const source = structuredClone(style);
  return {
    ...source,
    presetOrigin: "exam",
    curve: line(2, "solid", "#000000"),
    xAxis: blackAxis(source.xAxis),
    yAxis: blackAxis(source.yAxis),
    horizontalGrid: grid(false),
    verticalGrid: grid(false),
    equivalenceGuides: {
      ...source.equivalenceGuides,
      showAll: false,
      visibilityById: {},
      line: { ...source.equivalenceGuides.line, visible: false },
      marker: { ...source.equivalenceGuides.marker, visible: false },
    },
    characteristicPoints: {
      ...source.characteristicPoints,
      showAll: false,
      visibilityById: {},
      line: { ...source.characteristicPoints.line, visible: false },
      marker: { ...source.characteristicPoints.marker, visible: false },
    },
    title: { ...source.title, visible: false },
    background: "white",
    annotationsVisible: false,
  };
}

export function applyTeachingPreset(style: GraphStyle): GraphStyle {
  const source = structuredClone(style);
  return {
    ...source,
    presetOrigin: "teaching",
    curve: { ...source.curve },
    xAxis: { ...source.xAxis, visible: true, showLabel: true, showTickLabels: true },
    yAxis: { ...source.yAxis, visible: true, showLabel: true, showTickLabels: true },
    horizontalGrid: grid(true),
    verticalGrid: grid(true),
    equivalenceGuides: {
      ...source.equivalenceGuides,
      showAll: true,
      visibilityById: {},
      line: line(1, "dashed", "#555555"),
      marker: marker(true, "#222222", 3),
    },
    characteristicPoints: {
      ...source.characteristicPoints,
      showAll: true,
      visibilityById: {},
      line: line(0.8, "dotted", "#777777"),
      marker: marker(true, "#222222", 2.5),
    },
    annotationsVisible: false,
  };
}

export function createExamGraphStyle(maxVolumeMl: number): GraphStyle {
  return applyExamPreset(createDefaultGraphStyle(maxVolumeMl));
}

export function createTeachingGraphStyle(maxVolumeMl: number): GraphStyle {
  return applyTeachingPreset(createDefaultGraphStyle(maxVolumeMl));
}
