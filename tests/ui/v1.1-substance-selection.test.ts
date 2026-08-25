import { describe, expect, it } from "vitest";

import { SUBSTANCES } from "../../src/chemistry";
import type { ValidationError } from "../../src/domain/validation";
import {
  createAppState,
  createSubstanceSelectionGroups,
  getPresentationSelectionCategory,
  toUiValidationErrors,
  type TitrationDraft,
} from "../../src/ui";
import { V11_CONTRACT_FIXTURES } from "../fixtures/titration-fixtures";

function draftFor(
  fixture: (typeof V11_CONTRACT_FIXTURES)[keyof typeof V11_CONTRACT_FIXTURES],
): TitrationDraft {
  return {
    analyteSubstanceId: fixture.input.analyteSubstanceId,
    analyteConcentrationMolL: String(
      fixture.input.analyteConcentrationMolL,
    ),
    analyteVolumeMl: String(fixture.input.analyteVolumeMl),
    titrantSubstanceId: fixture.input.titrantSubstanceId,
    titrantConcentrationMolL: String(
      fixture.input.titrantConcentrationMolL,
    ),
  };
}

describe("v1.1 substance selection presentation", () => {
  it("provides 14 unique options to both analyte and titrant selects", () => {
    const analyteGroups = createSubstanceSelectionGroups();
    const titrantGroups = createSubstanceSelectionGroups();

    for (const groups of [analyteGroups, titrantGroups]) {
      const ids = groups.flatMap(({ options }) => options.map(({ id }) => id));
      expect(ids).toHaveLength(14);
      expect(new Set(ids).size).toBe(14);
      expect(ids).toEqual(SUBSTANCES.map(({ id }) => id));
    }
  });

  it("places both salts once in the salt/amphiprotic group", () => {
    const groups = createSubstanceSelectionGroups();
    expect(groups.map(({ label }) => label)).toEqual([
      "酸",
      "塩基",
      "塩・両性種",
    ]);
    const saltGroup = groups.find(({ id }) => id === "salt-or-amphiprotic");

    expect(saltGroup?.options).toEqual([
      { id: "na2co3", label: "炭酸ナトリウム (Na₂CO₃)" },
      { id: "nahco3", label: "炭酸水素ナトリウム (NaHCO₃)" },
    ]);
    for (const id of ["na2co3", "nahco3"]) {
      expect(
        groups.flatMap(({ options }) => options).filter((option) => option.id === id),
      ).toHaveLength(1);
    }
    expect(
      groups
        .filter(({ id }) => id === "acid" || id === "base")
        .flatMap(({ options }) => options)
        .some(({ id }) => id === "nahco3"),
    ).toBe(false);
  });

  it("uses legacy roles only as a presentation fallback for the existing 12 substances", () => {
    const existing = SUBSTANCES.filter(
      ({ id }) => id !== "na2co3" && id !== "nahco3",
    );
    expect(existing).toHaveLength(12);
    expect(existing.every(({ selectionCategory }) => selectionCategory === undefined)).toBe(true);
    expect(
      existing.map((substance) => getPresentationSelectionCategory(substance)),
    ).toEqual([
      "acid",
      "acid",
      "acid",
      "acid",
      "acid",
      "acid",
      "acid",
      "base",
      "base",
      "base",
      "base",
      "base",
    ]);
  });
});

describe("v1.1 UI validation", () => {
  it.each(Object.values(V11_CONTRACT_FIXTURES))(
    "accepts Fixture $id through the production derived-capability path",
    (fixture) => {
      const state = createAppState(draftFor(fixture));

      expect(state.chemical.status).toBe("success");
      expect(state.chemical.errors).toEqual([]);
      expect(state.chemical.result).not.toBeNull();
    },
  );

  it("passes ambiguous and incompatible codes through existing UI error presentation", () => {
    const validationErrors: ValidationError[] = [
      {
        code: "ambiguous-proton-transfer-direction",
        field: "substancePair",
        message: "プロトン移動方向を一意に決定できません。",
      },
      {
        code: "incompatible-acid-base-pair",
        field: "substancePair",
        message: "酸塩基滴定として扱えません。",
      },
    ];

    expect(toUiValidationErrors(validationErrors)).toEqual(validationErrors);
  });
});
