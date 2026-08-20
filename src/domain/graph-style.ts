export const LINE_PATTERNS = [
  "solid",
  "dashed",
  "dotted",
  "dash-dot",
] as const;

export type LinePattern = (typeof LINE_PATTERNS)[number];

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
  tickLength: number;
  tickWidth: number;
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
  axisLabelFontSize: number;
  titleFontSize: number;
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
