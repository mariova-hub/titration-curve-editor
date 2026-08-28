import { APP_TEMPLATE } from "../../src/ui/app";
import {
  parseTcurveFile,
  projectFileErrorMessage,
  restoreProjectState,
  serializeProject,
  TCURVE_FILE_ACCEPT,
} from "../../src/project";
import {
  createAppState,
  hasSecondAnalyteComponent,
  type TitrationDraft,
} from "../../src/ui";
import { describe, expect, it } from "vitest";

const fixtureKDraft: TitrationDraft = {
  analyteSubstanceId: "na2co3",
  analyteConcentrationMolL: "0.0500",
  analyteVolumeMl: "20.0",
  analyteComponent2SubstanceId: "naoh",
  analyteComponent2ConcentrationMolL: "0.0250",
  titrantSubstanceId: "hcl",
  titrantConcentrationMolL: "0.100",
};

function roundTrip(draft?: TitrationDraft) {
  const project = serializeProject(createAppState(draft));
  return restoreProjectState(parseTcurveFile(JSON.stringify(project)));
}

describe(".tcurve UI contract", () => {
  it("provides Save, Open, and a broadly compatible .tcurve file input", () => {
    expect(APP_TEMPLATE).toContain('id="save-project"');
    expect(APP_TEMPLATE).toContain(">プロジェクトを保存</button>");
    expect(APP_TEMPLATE).toContain('id="open-project"');
    expect(APP_TEMPLATE).toContain(">プロジェクトを開く</button>");
    expect(APP_TEMPLATE).toContain('id="project-file-input"');
    expect(APP_TEMPLATE).toContain(`accept="${TCURVE_FILE_ACCEPT}"`);
    expect(APP_TEMPLATE).toContain('id="project-file-status"');
  });

  it("restores progressive disclosure for mixed and single projects", () => {
    expect(hasSecondAnalyteComponent(roundTrip(fixtureKDraft).chemical.draft)).toBe(true);
    expect(hasSecondAnalyteComponent(roundTrip().chemical.draft)).toBe(false);
  });

  it("maps invalid files to a safe user message without raw parse details", () => {
    let error: unknown;
    try {
      parseTcurveFile("not json");
    } catch (caught) {
      error = caught;
    }
    expect(projectFileErrorMessage(error)).toBe(
      "このプロジェクトファイルを読み込めませんでした。内容を確認してください。",
    );
    expect(projectFileErrorMessage(error)).not.toContain("JSON");
  });

  it("shows a distinct message for unsupported future schemas", () => {
    let error: unknown;
    try {
      parseTcurveFile(JSON.stringify({ schemaVersion: 2 }));
    } catch (caught) {
      error = caught;
    }
    expect(projectFileErrorMessage(error)).toBe(
      "このプロジェクトファイルは新しい形式のため、このバージョンでは開けません。",
    );
  });
});
