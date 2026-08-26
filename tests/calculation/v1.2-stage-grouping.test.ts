import { describe, expect, it } from "vitest";

import {
  createCharacteristicPointsFromEquivalencePoints,
  createEquivalencePointsFromBoundaryPlan,
  createSolutionLevelBoundaryPlan,
  planSolutionTitrationBoundaries,
  StoichiometricPlanningError,
} from "../../src/calculation/stoichiometric-boundaries";
import { normalizeSolutionTitrationInput } from "../../src/chemistry";
import type { SolutionTitrationInput } from "../../src/domain/titration";
import type { ComponentLocalStoichiometricPath } from "../../src/domain/stoichiometry";
import { V12_CONTRACT_FIXTURES } from "../fixtures/titration-fixtures";

function plannedFixtureK(
  input: SolutionTitrationInput = V12_CONTRACT_FIXTURES.K.input,
) {
  const normalized = normalizeSolutionTitrationInput(input);
  const planned = planSolutionTitrationBoundaries(normalized);
  const equivalencePoints = createEquivalencePointsFromBoundaryPlan(
    planned,
    normalized.titrant.concentrationMolL,
  );
  return { planned, equivalencePoints };
}

function fixtureKWithHydroxideConcentration(
  concentrationMolL: number,
): SolutionTitrationInput {
  const fixture = V12_CONTRACT_FIXTURES.K.input;
  return {
    ...fixture,
    analyteSolution: {
      ...fixture.analyteSolution,
      components: fixture.analyteSolution.components.map((component, index) =>
        index === 1 ? { ...component, concentrationMolL } : component
      ),
    },
  };
}

describe("v1.2 Fixture K solution-level stage grouping", () => {
  it("groups strong hydroxide and the first family process into stage 1", () => {
    const { planned } = plannedFixtureK();

    expect(planned.boundaryPlan.direction).toBe("protonation");
    expect(planned.boundaryPlan.stages).toHaveLength(2);
    expect(planned.boundaryPlan.stages[0]).toEqual({
      order: 1,
      contributions: [
        {
          sourceComponentId: "analyte-hydroxide",
          processId: "analyte-hydroxide.strong-hydroxide",
          kind: "strong-hydroxide",
          equivalentMoles: 0.0005,
        },
        {
          sourceComponentId: "analyte-carbonate",
          processId: "h2co3.step2",
          kind: "family-step",
          equivalentMoles: 0.001,
        },
      ],
      incrementalEquivalentMoles: 0.0015,
      cumulativeEquivalentMoles: 0.0015,
      participatingStepIds: ["h2co3.step2"],
    });
  });

  it("keeps the second family process as stage 2 and accumulates capacity", () => {
    const { planned } = plannedFixtureK();

    expect(planned.boundaryPlan.stages[1]).toEqual({
      order: 2,
      contributions: [
        {
          sourceComponentId: "analyte-carbonate",
          processId: "h2co3.step1",
          kind: "family-step",
          equivalentMoles: 0.001,
        },
      ],
      incrementalEquivalentMoles: 0.001,
      cumulativeEquivalentMoles: 0.0025,
      participatingStepIds: ["h2co3.step2", "h2co3.step1"],
    });
  });

  it("projects 15/25 mL equivalences without a mixed stoichiometric equivalent", () => {
    const { equivalencePoints } = plannedFixtureK();

    expect(equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual([15, 25]);
    expect(
      equivalencePoints.map(
        ({ cumulativeEquivalentMoles }) => cumulativeEquivalentMoles,
      ),
    ).toEqual([0.0015, 0.0025]);
    expect(
      equivalencePoints.map(({ stoichiometricEquivalent }) =>
        stoichiometricEquivalent
      ),
    ).toEqual([undefined, undefined]);
    expect(equivalencePoints[0]?.participatingProcessIds).toEqual([
      "analyte-hydroxide.strong-hydroxide",
      "h2co3.step2",
    ]);
  });

  it("creates 7.5/20 mL characteristic volumes without evaluating pH", () => {
    const { equivalencePoints } = plannedFixtureK();
    const characteristicPoints =
      createCharacteristicPointsFromEquivalencePoints(equivalencePoints);

    expect(characteristicPoints.map(({ volumeMl }) => volumeMl)).toEqual([
      7.5,
      20,
    ]);
    expect(characteristicPoints.map(({ pH }) => pH)).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe("v1.2 stage grouping policy", () => {
  it("rejects different family process paths instead of aligning local step 1", () => {
    const paths: ComponentLocalStoichiometricPath[] = [
      {
        sourceComponentId: "family-source-a",
        direction: "protonation",
        contributions: [
          {
            sourceComponentId: "family-source-a",
            processId: "family-a.step1",
            kind: "family-step",
            equivalentMoles: 0.001,
          },
        ],
      },
      {
        sourceComponentId: "family-source-b",
        direction: "protonation",
        contributions: [
          {
            sourceComponentId: "family-source-b",
            processId: "family-b.step1",
            kind: "family-step",
            equivalentMoles: 0.001,
          },
        ],
      },
    ];

    expect(() => createSolutionLevelBoundaryPlan(paths)).toThrowError(
      expect.objectContaining<Partial<StoichiometricPlanningError>>({
        code: "unsupported-stage-grouping",
      }),
    );
  });

  it.each([
    ["low", 0.005, [11, 21]],
    ["high", 0.075, [25, 35]],
  ] as const)(
    "derives %s strong-hydroxide boundaries from amount metadata",
    (_label, concentrationMolL, expectedVolumesMl) => {
      const { equivalencePoints } = plannedFixtureK(
        fixtureKWithHydroxideConcentration(concentrationMolL),
      );

      expect(equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual(
        expectedVolumesMl,
      );
    },
  );
});
