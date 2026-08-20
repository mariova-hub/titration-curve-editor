export const LINE_PATTERNS = [
  "solid",
  "dashed",
  "dotted",
  "dash-dot",
] as const;

export type LinePattern = (typeof LINE_PATTERNS)[number];

export const TICK_DIRECTIONS = ["outside", "inside", "both"] as const;

export type TickDirection = (typeof TICK_DIRECTIONS)[number];

export interface AxisLabelPosition {
  mode: "auto" | "custom";
  alongAxis: number;
  offsetPx: number;
}

export interface LineStyle {
  visible: boolean;
  width: number;
  pattern: LinePattern;
  color: string;
}

export interface AxisStyle {
  visible: boolean;
  showLabel: boolean;
  label: string;
  line: LineStyle;
  majorTickInterval: number | "auto";
  minorTickInterval?: number | "auto";
  showMajorTicks: boolean;
  showMinorTicks: boolean;
  showTickLabels: boolean;
  showZeroLabel: boolean;
  tickLength: number;
  tickWidth: number;
  tickDirection: TickDirection;
  labelPosition: AxisLabelPosition;
}

export interface GridStyle {
  visible: boolean;
  line: LineStyle;
}

export interface FeatureVisibility {
  showAll: boolean;
  visibilityById: Record<string, boolean>;
}

export interface MarkerStyle {
  visible: boolean;
  color: string;
  radius: number;
}

export interface EquivalenceGuideStyle extends FeatureVisibility {
  line: LineStyle;
  marker: MarkerStyle;
}

export interface CharacteristicPointStyle extends FeatureVisibility {
  line: LineStyle;
  marker: MarkerStyle;
}

export interface TitleStyle {
  visible: boolean;
  text: string;
}

export interface TypographyStyle {
  tickLabelFontSize: number;
  tickLabelFontFamily: string;
  axisLabelFontSize: number;
  axisLabelFontFamily: string;
  titleFontSize: number;
  titleFontFamily: string;
}

export type GraphBackground = "white" | "transparent";

export interface GraphStyle {
  presetOrigin?: "exam" | "teaching" | "custom";
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
  equivalenceGuides: EquivalenceGuideStyle;
  characteristicPoints: CharacteristicPointStyle;
  title: TitleStyle;
  typography: TypographyStyle;
  background: GraphBackground;
  annotationsVisible: boolean;
}
