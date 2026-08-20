import { SUBSTANCES } from "../chemistry";
import type { AxisStyle, GraphStyle, LinePattern } from "../domain/graph-style";
import { downloadSvg } from "../export";
import { calculateNiceTickInterval } from "../rendering";
import {
  applyPresetToState,
  canExportSvg,
  createAppState,
  errorsForField,
  updateGraphStyle,
  updateTitrationDraft,
  updateXMax,
  useAutomaticXRange,
  type AppState,
  type TitrationDraftField,
  type UiErrorField,
} from "./state";

const PATTERNS: ReadonlyArray<{ value: LinePattern; label: string }> = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "dash-dot", label: "Dash-dot" },
];

function patternOptions(): string {
  return PATTERNS.map(({ value, label }) => `<option value="${value}">${label}</option>`).join("");
}

const APP_TEMPLATE = `
  <div class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">高校化学・図版作成ツール</p>
        <h1>Titration Curve Editor</h1>
      </div>
      <p class="temperature-note">25 ℃固定・活量補正なし</p>
    </header>
    <main class="editor-layout">
      <aside class="controls-panel" aria-label="滴定曲線の設定">
        <div class="controls-heading">
          <h2>Controls</h2>
          <p>滴定条件と図版設定は独立して更新されます。</p>
        </div>

        <details open>
          <summary>Titration</summary>
          <div class="section-content">
            <fieldset>
              <legend>滴定される水溶液（Analyte）</legend>
              <label for="analyte-substance">物質</label>
              <select id="analyte-substance" data-draft-field="analyteSubstanceId"></select>
              <p class="field-error" id="error-analyte-substance" aria-live="polite"></p>

              <label for="analyte-concentration">濃度 <span>mol/L</span></label>
              <input id="analyte-concentration" data-draft-field="analyteConcentrationMolL" type="number" min="0" step="any" inputmode="decimal" />
              <p class="field-error" id="error-analyte-concentration" aria-live="polite"></p>

              <label for="analyte-volume">体積 <span>mL</span></label>
              <input id="analyte-volume" data-draft-field="analyteVolumeMl" type="number" min="0" step="any" inputmode="decimal" />
              <p class="field-error" id="error-analyte-volume" aria-live="polite"></p>
            </fieldset>

            <fieldset>
              <legend>滴下する水溶液（Titrant）</legend>
              <label for="titrant-substance">物質</label>
              <select id="titrant-substance" data-draft-field="titrantSubstanceId"></select>
              <p class="field-error" id="error-titrant-substance" aria-live="polite"></p>

              <label for="titrant-concentration">濃度 <span>mol/L</span></label>
              <input id="titrant-concentration" data-draft-field="titrantConcentrationMolL" type="number" min="0" step="any" inputmode="decimal" />
              <p class="field-error" id="error-titrant-concentration" aria-live="polite"></p>
            </fieldset>
            <p class="field-error error-summary" id="error-substance-pair" aria-live="polite"></p>
          </div>
        </details>

        <details open>
          <summary>Preset</summary>
          <div class="section-content preset-buttons" role="group" aria-label="図版プリセット">
            <button type="button" id="preset-exam">Exam</button>
            <button type="button" id="preset-teaching">Teaching</button>
            <p class="control-help">適用後も各設定を変更できます。</p>
          </div>
        </details>

        <details open>
          <summary>Curve Style</summary>
          <div class="section-content control-grid">
            <label for="curve-width">線幅</label>
            <input id="curve-width" type="number" min="0.5" max="8" step="0.1" />
            <label for="curve-pattern">線種</label>
            <select id="curve-pattern">${patternOptions()}</select>
            <label for="curve-color">線色</label>
            <input id="curve-color" type="color" />
          </div>
        </details>

        <details>
          <summary>Axes</summary>
          <div class="section-content axis-columns">
            <fieldset>
              <legend>X axis</legend>
              <label class="check-row"><input id="x-axis-visible" type="checkbox" /> 軸を表示</label>
              <div class="control-grid">
                <label for="x-min">最小値</label><input id="x-min" type="number" step="any" />
                <label for="x-max">最大値</label><input id="x-max" type="number" min="0" step="any" />
                <span></span><button type="button" id="x-range-auto" class="secondary-button">自動範囲</button>
                <label for="x-axis-width">線幅</label><input id="x-axis-width" type="number" min="0.5" max="8" step="0.1" />
                <label for="x-axis-pattern">線種</label><select id="x-axis-pattern">${patternOptions()}</select>
                <label for="x-axis-color">線色</label><input id="x-axis-color" type="color" />
              </div>
            </fieldset>
            <fieldset>
              <legend>Y axis</legend>
              <label class="check-row"><input id="y-axis-visible" type="checkbox" /> 軸を表示</label>
              <div class="control-grid">
                <label for="y-min">最小値</label><input id="y-min" type="number" step="any" />
                <label for="y-max">最大値</label><input id="y-max" type="number" step="any" />
                <label for="y-axis-width">線幅</label><input id="y-axis-width" type="number" min="0.5" max="8" step="0.1" />
                <label for="y-axis-pattern">線種</label><select id="y-axis-pattern">${patternOptions()}</select>
                <label for="y-axis-color">線色</label><input id="y-axis-color" type="color" />
              </div>
            </fieldset>
          </div>
        </details>

        <details>
          <summary>Ticks</summary>
          <div class="section-content axis-columns">
            <fieldset>
              <legend>X ticks</legend>
              <label class="check-row"><input id="x-major-visible" type="checkbox" /> Major ticks</label>
              <label class="check-row"><input id="x-tick-labels" type="checkbox" /> 数値を表示</label>
              <label class="check-row"><input id="x-major-auto" type="checkbox" /> Major interval Auto</label>
              <label for="x-major-interval">Major interval</label>
              <input id="x-major-interval" type="number" min="0" step="any" />
              <label class="check-row"><input id="x-minor-visible" type="checkbox" /> Minor ticks</label>
              <label for="x-minor-interval">Minor interval</label>
              <input id="x-minor-interval" type="number" min="0" step="any" />
            </fieldset>
            <fieldset>
              <legend>Y ticks</legend>
              <label class="check-row"><input id="y-major-visible" type="checkbox" /> Major ticks</label>
              <label class="check-row"><input id="y-tick-labels" type="checkbox" /> 数値を表示</label>
              <label class="check-row"><input id="y-major-auto" type="checkbox" /> Major interval Auto</label>
              <label for="y-major-interval">Major interval</label>
              <input id="y-major-interval" type="number" min="0" step="any" />
              <label class="check-row"><input id="y-minor-visible" type="checkbox" /> Minor ticks</label>
              <label for="y-minor-interval">Minor interval</label>
              <input id="y-minor-interval" type="number" min="0" step="any" />
            </fieldset>
          </div>
        </details>

        <details>
          <summary>Grid</summary>
          <div class="section-content">
            <label class="check-row"><input id="horizontal-grid" type="checkbox" /> Horizontal Grid</label>
            <label class="check-row"><input id="vertical-grid" type="checkbox" /> Vertical Grid</label>
          </div>
        </details>

        <details>
          <summary>Guides / Markers</summary>
          <div class="section-content axis-columns">
            <fieldset>
              <legend>当量点</legend>
              <label class="check-row"><input id="equivalence-guides" type="checkbox" /> Guides</label>
              <label class="check-row"><input id="equivalence-markers" type="checkbox" /> Markers</label>
              <div class="control-grid">
                <label for="equivalence-width">線幅</label><input id="equivalence-width" type="number" min="0.5" max="8" step="0.1" />
                <label for="equivalence-pattern">線種</label><select id="equivalence-pattern">${patternOptions()}</select>
                <label for="equivalence-color">線色</label><input id="equivalence-color" type="color" />
              </div>
            </fieldset>
            <fieldset>
              <legend>特徴点</legend>
              <label class="check-row"><input id="characteristic-guides" type="checkbox" /> Guides</label>
              <label class="check-row"><input id="characteristic-markers" type="checkbox" /> Markers</label>
              <div class="control-grid">
                <label for="characteristic-width">線幅</label><input id="characteristic-width" type="number" min="0.5" max="8" step="0.1" />
                <label for="characteristic-pattern">線種</label><select id="characteristic-pattern">${patternOptions()}</select>
                <label for="characteristic-color">線色</label><input id="characteristic-color" type="color" />
              </div>
            </fieldset>
          </div>
        </details>

        <details>
          <summary>Figure Size</summary>
          <div class="section-content control-grid">
            <label for="figure-width">幅 px</label><input id="figure-width" type="number" min="320" max="2400" step="1" />
            <label for="figure-height">高さ px</label><input id="figure-height" type="number" min="240" max="1800" step="1" />
            <label for="background">背景</label>
            <select id="background"><option value="white">White</option><option value="transparent">Transparent</option></select>
          </div>
        </details>

        <details>
          <summary>Title / Labels</summary>
          <div class="section-content">
            <label class="check-row"><input id="title-visible" type="checkbox" /> タイトルを表示</label>
            <label for="title-text">タイトル</label><input id="title-text" type="text" />
            <fieldset>
              <legend>X label</legend>
              <label class="check-row"><input id="x-label-visible" type="checkbox" /> 表示</label>
              <label for="x-label-text">文字列</label><input id="x-label-text" type="text" />
            </fieldset>
            <fieldset>
              <legend>Y label</legend>
              <label class="check-row"><input id="y-label-visible" type="checkbox" /> 表示</label>
              <label for="y-label-text">文字列</label><input id="y-label-text" type="text" />
            </fieldset>
          </div>
        </details>

        <details open>
          <summary>Export</summary>
          <div class="section-content">
            <label for="export-filename">ファイル名</label>
            <input id="export-filename" type="text" value="titration-curve.svg" />
            <button type="button" id="export-svg" class="primary-button">Export SVG</button>
            <p class="control-help">Previewと同じSVG文字列を保存します。</p>
          </div>
        </details>
      </aside>

      <section class="preview-panel" aria-labelledby="preview-heading">
        <div class="preview-header">
          <div>
            <p class="eyebrow">Live SVG</p>
            <h2 id="preview-heading">Preview</h2>
          </div>
          <p id="calculation-status" class="status-message" role="status" aria-live="polite"></p>
        </div>
        <p id="error-calculation" class="field-error error-summary" role="alert"></p>
        <div id="preview-canvas" class="preview-canvas" aria-label="滴定曲線のプレビュー"></div>
        <div class="preview-footer">
          <span id="point-summary"></span>
          <button type="button" id="export-svg-footer" class="primary-button">Export SVG</button>
        </div>
      </section>
    </main>
  </div>
`;

function requiredElement<T extends HTMLElement>(root: ParentNode, id: string): T {
  const element = root.querySelector<HTMLElement>(`#${id}`);
  if (element === null) throw new Error(`Missing UI element: ${id}`);
  return element as T;
}

function setValue(element: HTMLInputElement | HTMLSelectElement, value: string): void {
  if (element.value !== value) element.value = value;
}

function setCheckbox(element: HTMLInputElement, checked: boolean): void {
  if (element.checked !== checked) element.checked = checked;
}

function populateSubstances(select: HTMLSelectElement): void {
  select.replaceChildren();
  for (const role of ["acid", "base"] as const) {
    const group = document.createElement("optgroup");
    group.label = role === "acid" ? "酸" : "塩基";
    for (const substance of SUBSTANCES.filter(({ roles }) => roles.includes(role))) {
      const option = document.createElement("option");
      option.value = substance.id;
      option.textContent = `${substance.displayNameJa} (${substance.formula})`;
      group.append(option);
    }
    select.append(group);
  }
}

function numberValue(input: HTMLInputElement, constraint: (value: number) => boolean): number | null {
  const value = input.valueAsNumber;
  const valid = Number.isFinite(value) && constraint(value);
  input.setCustomValidity(valid ? "" : "有効な数値を入力してください。");
  if (!valid) input.reportValidity();
  return valid ? value : null;
}

function axisWith(style: GraphStyle, orientation: "x" | "y", update: (axis: AxisStyle) => AxisStyle): GraphStyle {
  return orientation === "x"
    ? { ...style, presetOrigin: "custom", xAxis: update(style.xAxis) }
    : { ...style, presetOrigin: "custom", yAxis: update(style.yAxis) };
}

export function mountApp(root: HTMLElement): void {
  root.innerHTML = APP_TEMPLATE;
  const analyteSelect = requiredElement<HTMLSelectElement>(root, "analyte-substance");
  const titrantSelect = requiredElement<HTMLSelectElement>(root, "titrant-substance");
  populateSubstances(analyteSelect);
  populateSubstances(titrantSelect);

  let state = createAppState();
  const preview = requiredElement<HTMLElement>(root, "preview-canvas");
  const status = requiredElement<HTMLElement>(root, "calculation-status");
  const exportButtons = [
    requiredElement<HTMLButtonElement>(root, "export-svg"),
    requiredElement<HTMLButtonElement>(root, "export-svg-footer"),
  ];

  const draftControls: ReadonlyArray<{
    id: string;
    field: TitrationDraftField;
    event: "input" | "change";
  }> = [
    { id: "analyte-substance", field: "analyteSubstanceId", event: "change" },
    { id: "analyte-concentration", field: "analyteConcentrationMolL", event: "input" },
    { id: "analyte-volume", field: "analyteVolumeMl", event: "input" },
    { id: "titrant-substance", field: "titrantSubstanceId", event: "change" },
    { id: "titrant-concentration", field: "titrantConcentrationMolL", event: "input" },
  ];

  function showError(id: string, field: UiErrorField): void {
    const target = requiredElement<HTMLElement>(root, id);
    const messages = errorsForField(state, field).map(({ message }) => message);
    target.textContent = messages.join(" ");
    const control = root.querySelector<HTMLElement>(`[data-draft-field="${field}"]`);
    if (control !== null) {
      if (messages.length > 0) control.setAttribute("aria-invalid", "true");
      else control.removeAttribute("aria-invalid");
    }
  }

  function syncAxis(orientation: "x" | "y", axis: AxisStyle): void {
    setCheckbox(requiredElement<HTMLInputElement>(root, `${orientation}-axis-visible`), axis.visible);
    setValue(requiredElement<HTMLInputElement>(root, `${orientation}-axis-width`), String(axis.line.width));
    setValue(requiredElement<HTMLSelectElement>(root, `${orientation}-axis-pattern`), axis.line.pattern);
    setValue(requiredElement<HTMLInputElement>(root, `${orientation}-axis-color`), axis.line.color);
    setCheckbox(requiredElement<HTMLInputElement>(root, `${orientation}-major-visible`), axis.showMajorTicks);
    setCheckbox(requiredElement<HTMLInputElement>(root, `${orientation}-tick-labels`), axis.showTickLabels);
    const auto = axis.majorTickInterval === "auto";
    setCheckbox(requiredElement<HTMLInputElement>(root, `${orientation}-major-auto`), auto);
    const intervalInput = requiredElement<HTMLInputElement>(root, `${orientation}-major-interval`);
    const style = state.rendering.graphStyle;
    const min = orientation === "x" ? style.xMin : style.yMin;
    const max = orientation === "x" ? style.xMax : style.yMax;
    setValue(intervalInput, String(auto ? calculateNiceTickInterval(min, max) : axis.majorTickInterval));
    intervalInput.disabled = auto;
    setCheckbox(requiredElement<HTMLInputElement>(root, `${orientation}-minor-visible`), axis.showMinorTicks);
    setValue(
      requiredElement<HTMLInputElement>(root, `${orientation}-minor-interval`),
      String(axis.minorTickInterval === undefined || axis.minorTickInterval === "auto"
        ? calculateNiceTickInterval(min, max) / 2
        : axis.minorTickInterval),
    );
    setCheckbox(requiredElement<HTMLInputElement>(root, `${orientation}-label-visible`), axis.showLabel);
    setValue(requiredElement<HTMLInputElement>(root, `${orientation}-label-text`), axis.label);
  }

  function syncControls(): void {
    const { draft, result, status: chemicalStatus, previewIsStale } = state.chemical;
    for (const { id, field } of draftControls) {
      setValue(requiredElement<HTMLInputElement | HTMLSelectElement>(root, id), draft[field]);
    }
    showError("error-analyte-substance", "analyteSubstanceId");
    showError("error-analyte-concentration", "analyteConcentrationMolL");
    showError("error-analyte-volume", "analyteVolumeMl");
    showError("error-titrant-substance", "titrantSubstanceId");
    showError("error-titrant-concentration", "titrantConcentrationMolL");
    showError("error-substance-pair", "substancePair");
    const calculationMessages = [
      ...errorsForField(state, "calculation"),
      ...(state.rendering.error === null ? [] : [state.rendering.error]),
    ];
    requiredElement<HTMLElement>(root, "error-calculation").textContent = calculationMessages
      .map(({ message }) => message)
      .join(" ");

    if (chemicalStatus === "success") status.textContent = "計算済み・Previewは最新です";
    else if (previewIsStale) status.textContent = "入力を確認してください。直前の有効なPreviewを表示中です";
    else status.textContent = "入力を確認してください";

    if (state.rendering.svgString === null) {
      preview.replaceChildren();
      const empty = document.createElement("p");
      empty.className = "empty-preview";
      empty.textContent = "有効な滴定条件を入力するとPreviewが表示されます。";
      preview.append(empty);
    } else {
      // Only the escaped, deterministic output of renderTitrationSvg is inserted here.
      preview.innerHTML = state.rendering.svgString;
    }

    const style = state.rendering.graphStyle;
    setValue(requiredElement<HTMLInputElement>(root, "curve-width"), String(style.curve.width));
    setValue(requiredElement<HTMLSelectElement>(root, "curve-pattern"), style.curve.pattern);
    setValue(requiredElement<HTMLInputElement>(root, "curve-color"), style.curve.color);
    setValue(requiredElement<HTMLInputElement>(root, "x-min"), String(style.xMin));
    setValue(requiredElement<HTMLInputElement>(root, "x-max"), String(style.xMax));
    setValue(requiredElement<HTMLInputElement>(root, "y-min"), String(style.yMin));
    setValue(requiredElement<HTMLInputElement>(root, "y-max"), String(style.yMax));
    syncAxis("x", style.xAxis);
    syncAxis("y", style.yAxis);
    setCheckbox(requiredElement<HTMLInputElement>(root, "horizontal-grid"), style.horizontalGrid.visible);
    setCheckbox(requiredElement<HTMLInputElement>(root, "vertical-grid"), style.verticalGrid.visible);
    setCheckbox(requiredElement<HTMLInputElement>(root, "equivalence-guides"), style.equivalenceGuides.showAll && style.equivalenceGuides.line.visible);
    setCheckbox(requiredElement<HTMLInputElement>(root, "equivalence-markers"), style.equivalenceGuides.showAll && style.equivalenceGuides.marker.visible);
    setValue(requiredElement<HTMLInputElement>(root, "equivalence-width"), String(style.equivalenceGuides.line.width));
    setValue(requiredElement<HTMLSelectElement>(root, "equivalence-pattern"), style.equivalenceGuides.line.pattern);
    setValue(requiredElement<HTMLInputElement>(root, "equivalence-color"), style.equivalenceGuides.line.color);
    setCheckbox(requiredElement<HTMLInputElement>(root, "characteristic-guides"), style.characteristicPoints.showAll && style.characteristicPoints.line.visible);
    setCheckbox(requiredElement<HTMLInputElement>(root, "characteristic-markers"), style.characteristicPoints.showAll && style.characteristicPoints.marker.visible);
    setValue(requiredElement<HTMLInputElement>(root, "characteristic-width"), String(style.characteristicPoints.line.width));
    setValue(requiredElement<HTMLSelectElement>(root, "characteristic-pattern"), style.characteristicPoints.line.pattern);
    setValue(requiredElement<HTMLInputElement>(root, "characteristic-color"), style.characteristicPoints.line.color);
    setValue(requiredElement<HTMLInputElement>(root, "figure-width"), String(style.width));
    setValue(requiredElement<HTMLInputElement>(root, "figure-height"), String(style.height));
    setValue(requiredElement<HTMLSelectElement>(root, "background"), style.background);
    setCheckbox(requiredElement<HTMLInputElement>(root, "title-visible"), style.title.visible);
    setValue(requiredElement<HTMLInputElement>(root, "title-text"), style.title.text);
    requiredElement<HTMLButtonElement>(root, "preset-exam").setAttribute("aria-pressed", String(style.presetOrigin === "exam"));
    requiredElement<HTMLButtonElement>(root, "preset-teaching").setAttribute("aria-pressed", String(style.presetOrigin === "teaching"));
    const exportEnabled = canExportSvg(state);
    for (const button of exportButtons) button.disabled = !exportEnabled;
    requiredElement<HTMLElement>(root, "point-summary").textContent = result === null
      ? ""
      : `${result.points.length} points / ${result.equivalencePoints.length} equivalence points`;
  }

  function commit(nextState: AppState): void {
    state = nextState;
    syncControls();
  }

  function styleOnly(update: (style: GraphStyle) => GraphStyle): void {
    commit(updateGraphStyle(state, (style) => ({ ...update(style), presetOrigin: "custom" })));
  }

  for (const { id, field, event } of draftControls) {
    const control = requiredElement<HTMLInputElement | HTMLSelectElement>(root, id);
    control.addEventListener(event, () => commit(updateTitrationDraft(state, field, control.value)));
  }

  requiredElement<HTMLButtonElement>(root, "preset-exam").addEventListener("click", () => commit(applyPresetToState(state, "exam")));
  requiredElement<HTMLButtonElement>(root, "preset-teaching").addEventListener("click", () => commit(applyPresetToState(state, "teaching")));

  const bindNumber = (
    id: string,
    constraint: (value: number) => boolean,
    update: (style: GraphStyle, value: number) => GraphStyle,
  ): void => {
    const input = requiredElement<HTMLInputElement>(root, id);
    input.addEventListener("change", () => {
      const value = numberValue(input, constraint);
      if (value !== null) styleOnly((style) => update(style, value));
    });
  };
  const bindCheck = (id: string, update: (style: GraphStyle, checked: boolean) => GraphStyle): void => {
    const input = requiredElement<HTMLInputElement>(root, id);
    input.addEventListener("change", () => styleOnly((style) => update(style, input.checked)));
  };
  const bindSelect = (id: string, update: (style: GraphStyle, value: string) => GraphStyle): void => {
    const select = requiredElement<HTMLSelectElement>(root, id);
    select.addEventListener("change", () => styleOnly((style) => update(style, select.value)));
  };
  const bindText = (id: string, update: (style: GraphStyle, value: string) => GraphStyle): void => {
    const input = requiredElement<HTMLInputElement>(root, id);
    input.addEventListener("input", () => styleOnly((style) => update(style, input.value)));
  };

  bindNumber("curve-width", (value) => value >= 0.5 && value <= 8, (style, width) => ({ ...style, curve: { ...style.curve, width } }));
  bindSelect("curve-pattern", (style, pattern) => ({ ...style, curve: { ...style.curve, pattern: pattern as LinePattern } }));
  bindSelect("curve-color", (style, color) => ({ ...style, curve: { ...style.curve, color } }));

  for (const orientation of ["x", "y"] as const) {
    bindCheck(`${orientation}-axis-visible`, (style, visible) => axisWith(style, orientation, (axis) => ({ ...axis, visible })));
    bindNumber(`${orientation}-axis-width`, (value) => value >= 0.5 && value <= 8, (style, width) => axisWith(style, orientation, (axis) => ({ ...axis, line: { ...axis.line, width } })));
    bindSelect(`${orientation}-axis-pattern`, (style, pattern) => axisWith(style, orientation, (axis) => ({ ...axis, line: { ...axis.line, pattern: pattern as LinePattern } })));
    bindSelect(`${orientation}-axis-color`, (style, color) => axisWith(style, orientation, (axis) => ({ ...axis, line: { ...axis.line, color } })));
    bindCheck(`${orientation}-major-visible`, (style, showMajorTicks) => axisWith(style, orientation, (axis) => ({ ...axis, showMajorTicks })));
    bindCheck(`${orientation}-tick-labels`, (style, showTickLabels) => axisWith(style, orientation, (axis) => ({ ...axis, showTickLabels })));
    bindCheck(`${orientation}-minor-visible`, (style, showMinorTicks) => axisWith(style, orientation, (axis) => ({ ...axis, showMinorTicks, minorTickInterval: axis.minorTickInterval ?? "auto" })));
    bindCheck(`${orientation}-label-visible`, (style, showLabel) => axisWith(style, orientation, (axis) => ({ ...axis, showLabel })));
    bindText(`${orientation}-label-text`, (style, label) => axisWith(style, orientation, (axis) => ({ ...axis, label })));

    const auto = requiredElement<HTMLInputElement>(root, `${orientation}-major-auto`);
    auto.addEventListener("change", () => styleOnly((style) => {
      const min = orientation === "x" ? style.xMin : style.yMin;
      const max = orientation === "x" ? style.xMax : style.yMax;
      return axisWith(style, orientation, (axis) => ({
        ...axis,
        majorTickInterval: auto.checked ? "auto" : calculateNiceTickInterval(min, max),
      }));
    }));
    bindNumber(`${orientation}-major-interval`, (value) => value > 0, (style, majorTickInterval) => axisWith(style, orientation, (axis) => ({ ...axis, majorTickInterval })));
    bindNumber(`${orientation}-minor-interval`, (value) => value > 0, (style, minorTickInterval) => axisWith(style, orientation, (axis) => ({ ...axis, minorTickInterval })));
  }

  bindNumber("x-min", (value) => value < state.rendering.graphStyle.xMax, (style, xMin) => ({ ...style, xMin }));
  const xMaxInput = requiredElement<HTMLInputElement>(root, "x-max");
  xMaxInput.addEventListener("change", () => {
    const value = numberValue(xMaxInput, (candidate) => candidate > state.rendering.graphStyle.xMin);
    if (value !== null) commit(updateXMax(state, value));
  });
  requiredElement<HTMLButtonElement>(root, "x-range-auto").addEventListener("click", () => commit(useAutomaticXRange(state)));
  bindNumber("y-min", (value) => value < state.rendering.graphStyle.yMax, (style, yMin) => ({ ...style, yMin }));
  bindNumber("y-max", (value) => value > state.rendering.graphStyle.yMin, (style, yMax) => ({ ...style, yMax }));

  bindCheck("horizontal-grid", (style, visible) => ({ ...style, horizontalGrid: { ...style.horizontalGrid, visible, line: { ...style.horizontalGrid.line, visible } } }));
  bindCheck("vertical-grid", (style, visible) => ({ ...style, verticalGrid: { ...style.verticalGrid, visible, line: { ...style.verticalGrid.line, visible } } }));

  bindCheck("equivalence-guides", (style, visible) => ({
    ...style,
    equivalenceGuides: {
      ...style.equivalenceGuides,
      showAll: visible || style.equivalenceGuides.marker.visible,
      line: { ...style.equivalenceGuides.line, visible },
    },
  }));
  bindCheck("equivalence-markers", (style, visible) => ({
    ...style,
    equivalenceGuides: {
      ...style.equivalenceGuides,
      showAll: visible || style.equivalenceGuides.line.visible,
      marker: { ...style.equivalenceGuides.marker, visible },
    },
  }));
  bindNumber("equivalence-width", (value) => value >= 0.5 && value <= 8, (style, width) => ({ ...style, equivalenceGuides: { ...style.equivalenceGuides, line: { ...style.equivalenceGuides.line, width } } }));
  bindSelect("equivalence-pattern", (style, pattern) => ({ ...style, equivalenceGuides: { ...style.equivalenceGuides, line: { ...style.equivalenceGuides.line, pattern: pattern as LinePattern } } }));
  bindSelect("equivalence-color", (style, color) => ({ ...style, equivalenceGuides: { ...style.equivalenceGuides, line: { ...style.equivalenceGuides.line, color } } }));

  bindCheck("characteristic-guides", (style, visible) => ({
    ...style,
    characteristicPoints: {
      ...style.characteristicPoints,
      showAll: visible || style.characteristicPoints.marker.visible,
      line: { ...style.characteristicPoints.line, visible },
    },
  }));
  bindCheck("characteristic-markers", (style, visible) => ({
    ...style,
    characteristicPoints: {
      ...style.characteristicPoints,
      showAll: visible || style.characteristicPoints.line.visible,
      marker: { ...style.characteristicPoints.marker, visible },
    },
  }));
  bindNumber("characteristic-width", (value) => value >= 0.5 && value <= 8, (style, width) => ({ ...style, characteristicPoints: { ...style.characteristicPoints, line: { ...style.characteristicPoints.line, width } } }));
  bindSelect("characteristic-pattern", (style, pattern) => ({ ...style, characteristicPoints: { ...style.characteristicPoints, line: { ...style.characteristicPoints.line, pattern: pattern as LinePattern } } }));
  bindSelect("characteristic-color", (style, color) => ({ ...style, characteristicPoints: { ...style.characteristicPoints, line: { ...style.characteristicPoints.line, color } } }));

  bindNumber("figure-width", (value) => value >= 320 && value <= 2400, (style, width) => ({ ...style, width }));
  bindNumber("figure-height", (value) => value >= 240 && value <= 1800, (style, height) => ({ ...style, height }));
  bindSelect("background", (style, background) => ({ ...style, background: background as GraphStyle["background"] }));
  bindCheck("title-visible", (style, visible) => ({ ...style, title: { ...style.title, visible } }));
  bindText("title-text", (style, text) => ({ ...style, title: { ...style.title, text } }));

  const handleExport = (): void => {
    if (!canExportSvg(state) || state.rendering.svgString === null) return;
    const filename = requiredElement<HTMLInputElement>(root, "export-filename").value;
    downloadSvg(state.rendering.svgString, filename);
  };
  for (const button of exportButtons) button.addEventListener("click", handleExport);

  syncControls();
}
