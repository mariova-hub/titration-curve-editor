import packageMetadata from "../../package.json";

import { calculateTitrationCurve } from "../../src/calculation";
import {
  APP_VERSION,
  createTcurveFile,
  parseTcurveFile,
  ProjectFileError,
  restoreProjectState,
  serializeProject,
  TCURVE_MIME_TYPE,
  TCURVE_SCHEMA_VERSION,
  validateTcurveProject,
} from "../../src/project";
import { renderTitrationSvg } from "../../src/rendering";
import {
  applyPresetToState,
  createAppState,
  hasSecondAnalyteComponent,
  updateGraphStyle,
  updatePngExportOptions,
  updateXMax,
  type AppDependencies,
  type AppState,
  type TitrationDraft,
} from "../../src/ui";
import { describe, expect, it, vi } from "vitest";

const FIXED_SAVED_AT = "2026-08-29T00:00:00.000Z";

const fixtureKDraft: TitrationDraft = {
  analyteSubstanceId: "na2co3",
  analyteConcentrationMolL: "0.0500",
  analyteVolumeMl: "20.0",
  analyteComponent2SubstanceId: "naoh",
  analyteComponent2ConcentrationMolL: "0.0250",
  titrantSubstanceId: "hcl",
  titrantConcentrationMolL: "0.100",
};

function customizedSingleState(): AppState {
  let state = applyPresetToState(createAppState(), "teaching");
  state = updateXMax(state, 42);
  state = updateGraphStyle(state, (style) => ({
    ...style,
    title: { visible: true, text: "保存対象の滴定曲線" },
    xAxis: { ...style.xAxis, showLabel: false },
    curve: { ...style.curve, color: "#2255aa", width: 3 },
  }));
  return updatePngExportOptions(state, { scale: 4, background: "transparent" });
}

function projectJson(state: AppState): string {
  return JSON.stringify(serializeProject(state, APP_VERSION, FIXED_SAVED_AT));
}

function mutateProject(
  state: AppState,
  update: (project: Record<string, unknown>) => void,
): string {
  const project = JSON.parse(projectJson(state)) as Record<string, unknown>;
  update(project);
  return JSON.stringify(project);
}

function expectProjectError(
  callback: () => unknown,
  code: ProjectFileError["code"] = "invalid-project",
): void {
  try {
    callback();
    throw new Error("Expected project parsing to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectFileError);
    expect((error as ProjectFileError).code).toBe(code);
  }
}

describe(".tcurve schema 1 serialization", () => {
  it("serializes a single-analyte project and all editable rendering state", () => {
    const state = customizedSingleState();
    const project = serializeProject(state, APP_VERSION, FIXED_SAVED_AT);

    expect(project).toMatchObject({
      schemaVersion: 1,
      appVersion: packageMetadata.version,
      savedAt: FIXED_SAVED_AT,
      state: {
        input: {
          analyte: {
            mode: "single",
            substanceId: "hcl",
            concentrationMolL: 0.1,
            volumeMl: 20,
          },
          titrant: { substanceId: "naoh", concentrationMolL: 0.1 },
        },
        rendering: {
          xRangeMode: "manual",
          pngExportOptions: { scale: 4, background: "transparent" },
          graphStyle: {
            presetOrigin: "custom",
            xMax: 42,
            title: { visible: true, text: "保存対象の滴定曲線" },
            curve: { color: "#2255aa", width: 3 },
            xAxis: { showLabel: false },
          },
        },
      },
    });
  });

  it("serializes Fixture K as an ordered two-component mixed project", () => {
    const project = serializeProject(createAppState(fixtureKDraft), APP_VERSION, FIXED_SAVED_AT);

    expect(project.state.input).toEqual({
      analyte: {
        mode: "mixed",
        volumeMl: 20,
        components: [
          { substanceId: "na2co3", concentrationMolL: 0.05 },
          { substanceId: "naoh", concentrationMolL: 0.025 },
        ],
      },
      titrant: { substanceId: "hcl", concentrationMolL: 0.1 },
    });
  });

  it("does not serialize calculated curves, sampling points, SVG, diagnostics, or transient errors", () => {
    const json = projectJson(createAppState(fixtureKDraft));

    for (const forbidden of [
      '"points"',
      '"result"',
      '"svgString"',
      '"validatedInput"',
      '"errors"',
      '"previewIsStale"',
      '"diagnostics"',
    ]) {
      expect(json).not.toContain(forbidden);
    }
    expect(json.length).toBeLessThan(10_000);
  });

  it("takes appVersion from the package version source without changing it", () => {
    const project = serializeProject(createAppState(), undefined, FIXED_SAVED_AT);

    expect(APP_VERSION).toBe(packageMetadata.version);
    expect(project.appVersion).toBe(packageMetadata.version);
    expect(parseTcurveFile(JSON.stringify(project)).appVersion).toBe(packageMetadata.version);
    expect(TCURVE_SCHEMA_VERSION).toBe(1);
  });

  it("creates a small JSON Blob and normalizes the .tcurve extension without mutating state", async () => {
    const state = customizedSingleState();
    const before = structuredClone(state);
    const artifact = createTcurveFile(state, "lesson-project");

    expect(artifact.filename).toBe("lesson-project.tcurve");
    expect(artifact.blob.type).toBe(TCURVE_MIME_TYPE);
    expect(JSON.parse(await artifact.blob.text())).toEqual(artifact.project);
    expect(state).toEqual(before);
  });

  it("is deterministic for the same state, appVersion, and savedAt", () => {
    const state = customizedSingleState();

    expect(serializeProject(state, APP_VERSION, FIXED_SAVED_AT)).toEqual(
      serializeProject(state, APP_VERSION, FIXED_SAVED_AT),
    );
  });
});

describe(".tcurve parse, migration boundary, and validation", () => {
  const validState = createAppState(fixtureKDraft);

  it("accepts schema 1 and ignores unknown fields", () => {
    const text = mutateProject(validState, (project) => {
      project.futureMetadata = { ignored: true };
    });
    const parsed = parseTcurveFile(text);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed).not.toHaveProperty("futureMetadata");
  });

  it("rejects malformed JSON", () => {
    expectProjectError(() => parseTcurveFile("{not-json"), "malformed-json");
  });

  it("rejects a missing schema version", () => {
    const text = mutateProject(validState, (project) => {
      delete project.schemaVersion;
    });
    expectProjectError(() => parseTcurveFile(text));
  });

  it("rejects an unsupported future schema explicitly", () => {
    const text = mutateProject(validState, (project) => {
      project.schemaVersion = 2;
    });
    expectProjectError(() => parseTcurveFile(text), "unsupported-schema-version");
  });

  it("does not use appVersion as the compatibility gate", () => {
    const text = mutateProject(validState, (project) => {
      project.appVersion = "99.0.0";
    });
    expect(parseTcurveFile(text).appVersion).toBe("99.0.0");
  });

  it("rejects a missing state", () => {
    const text = mutateProject(validState, (project) => {
      delete project.state;
    });
    expectProjectError(() => parseTcurveFile(text));
  });

  it("rejects an unknown substance ID", () => {
    const text = mutateProject(validState, (project) => {
      const state = project.state as Record<string, unknown>;
      const input = state.input as Record<string, unknown>;
      const analyte = input.analyte as Record<string, unknown>;
      const components = analyte.components as Array<Record<string, unknown>>;
      components[0]!.substanceId = "unknown-substance";
    });
    expectProjectError(() => parseTcurveFile(text));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 0])(
    "rejects invalid concentration %s",
    (invalidConcentration) => {
      const project = serializeProject(validState, APP_VERSION, FIXED_SAVED_AT) as unknown as Record<string, unknown>;
      const state = project.state as Record<string, unknown>;
      const input = state.input as Record<string, unknown>;
      const titrant = input.titrant as Record<string, unknown>;
      titrant.concentrationMolL = invalidConcentration;
      expectProjectError(() => validateTcurveProject(project));
    },
  );

  it("rejects malformed mixed components", () => {
    const text = mutateProject(validState, (project) => {
      const state = project.state as Record<string, unknown>;
      const input = state.input as Record<string, unknown>;
      const analyte = input.analyte as Record<string, unknown>;
      analyte.components = [{ substanceId: "na2co3", concentrationMolL: 0.05 }];
    });
    expectProjectError(() => parseTcurveFile(text));
  });

  it("rejects unknown rendering enums", () => {
    const text = mutateProject(validState, (project) => {
      const state = project.state as Record<string, unknown>;
      const rendering = state.rendering as Record<string, unknown>;
      rendering.xRangeMode = "sometimes";
    });
    expectProjectError(() => parseTcurveFile(text));
  });
});

describe(".tcurve restore and production recalculation", () => {
  it("round-trips single input and rendering controls", () => {
    const before = customizedSingleState();
    const restored = restoreProjectState(parseTcurveFile(projectJson(before)));

    expect(restored.chemical.validatedInput).toEqual(before.chemical.validatedInput);
    expect(restored.rendering.xRangeMode).toBe("manual");
    expect(restored.rendering.graphStyle).toEqual(before.rendering.graphStyle);
    expect(restored.rendering.aspectRatio).toEqual(before.rendering.aspectRatio);
    expect(restored.rendering.graphStyle).toMatchObject({
      xMax: 42,
      title: { visible: true, text: "保存対象の滴定曲線" },
      curve: { color: "#2255aa", width: 3 },
      xAxis: { showLabel: false },
    });
    expect(restored.rendering.pngExportOptions).toEqual({
      scale: 4,
      background: "transparent",
    });
    expect(restored.chemical.result?.points).toEqual(before.chemical.result?.points);
    expect(restored.rendering.svgString).toContain('stroke="#2255aa"');
    expect(hasSecondAnalyteComponent(restored.chemical.draft)).toBe(false);
  });

  it("round-trips Fixture K mode, order, component values, common volume, and titrant", () => {
    const restored = restoreProjectState(
      parseTcurveFile(projectJson(createAppState(fixtureKDraft))),
    );

    expect(restored.chemical.draft).toEqual({
      analyteSubstanceId: "na2co3",
      analyteConcentrationMolL: "0.05",
      analyteVolumeMl: "20",
      analyteComponent2SubstanceId: "naoh",
      analyteComponent2ConcentrationMolL: "0.025",
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: "0.1",
    });
    expect(hasSecondAnalyteComponent(restored.chemical.draft)).toBe(true);
    expect(restored.chemical.result?.equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual([
      15,
      25,
    ]);
  });

  it("recalculates Fixture K through the production pipeline and preserves golden anchors", () => {
    const calculateCurve = vi.fn(calculateTitrationCurve);
    const dependencies: AppDependencies = { calculateCurve, renderSvg: renderTitrationSvg };
    const rawProject = JSON.parse(projectJson(createAppState(fixtureKDraft))) as Record<string, unknown>;
    const rawState = rawProject.state as Record<string, unknown>;
    rawState.curvePoints = [{ addedVolumeMl: 999, pH: -999 }];
    const project = parseTcurveFile(JSON.stringify(rawProject));
    const restored = restoreProjectState(project, dependencies);

    expect(calculateCurve).toHaveBeenCalledTimes(1);
    expect(calculateCurve).toHaveBeenCalledWith(
      expect.objectContaining({ titrantSubstanceId: "hcl" }),
      undefined,
    );
    expect(restored.chemical.result?.equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual([
      15,
      25,
    ]);
    expect(restored.chemical.result?.points.at(-1)?.addedVolumeMl).toBe(31.25);
    const points = restored.chemical.result?.points ?? [];
    for (const [volumeMl, golden] of [
      [0, 12.4051254613],
      [7.5, 10.7703912981],
      [15, 8.3383516242],
      [20, 6.3498931144],
      [25, 4.0025793867],
    ] as const) {
      expect(points.find((point) => point.addedVolumeMl === volumeMl)?.pH).toBeCloseTo(golden, 3);
    }
    expect(restored.rendering.svgString).toContain('data-role="titration-curve"');
  });

  it("rebuilds an automatic X range from the current solver instead of trusting the saved xMax", () => {
    const project = serializeProject(createAppState(fixtureKDraft), APP_VERSION, FIXED_SAVED_AT);
    project.state.rendering.graphStyle.xMax = 999;

    const restored = restoreProjectState(project);

    expect(restored.rendering.xRangeMode).toBe("auto");
    expect(restored.rendering.graphStyle.xMax).toBe(31.25);
    expect(restored.chemical.result?.points.at(-1)?.addedVolumeMl).toBe(31.25);
  });
});
