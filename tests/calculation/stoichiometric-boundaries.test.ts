import { describe, expect, it } from "vitest";

import {
  calculateCompositionEquivalencePoints,
  planCompositionTitrationBoundaries,
} from "../../src/calculation/stoichiometric-boundaries";
import type { StoichiometricBoundaryStage } from "../../src/domain/stoichiometry";
import { V11_CONTRACT_FIXTURES } from "../fixtures/titration-fixtures";

describe("v1.1 stoichiometric boundary planning", () => {
  it("builds Fixture H as two cumulative protonation boundaries", () => {
    const planned = planCompositionTitrationBoundaries(
      V11_CONTRACT_FIXTURES.H.input,
    );

    expect(planned.boundaryPlan.direction).toBe("protonation");
    expect(planned.boundaryPlan.stages).toHaveLength(2);
    expect(
      planned.boundaryPlan.stages.map(
        ({ cumulativeEquivalentMoles }) => cumulativeEquivalentMoles,
      ),
    ).toEqual([0.001, 0.002]);
    expect(
      planned.boundaryPlan.stages.map(({ participatingStepIds }) =>
        [...participatingStepIds]
      ),
    ).toEqual([
      ["h2co3.step2"],
      ["h2co3.step2", "h2co3.step1"],
    ]);
    expect(
      planned.boundaryPlan.stages.flatMap(({ contributions }) =>
        contributions.map(({ sourceComponentId, processId, equivalentMoles }) => ({
          sourceComponentId,
          processId,
          equivalentMoles,
        }))
      ),
    ).toEqual([
      {
        sourceComponentId: "analyte",
        processId: "h2co3.step2",
        equivalentMoles: 0.001,
      },
      {
        sourceComponentId: "analyte",
        processId: "h2co3.step1",
        equivalentMoles: 0.001,
      },
    ]);

    const points = calculateCompositionEquivalencePoints(
      V11_CONTRACT_FIXTURES.H.input,
    );
    expect(points.map(({ volumeMl }) => volumeMl)).toEqual([10, 20]);
    expect(points.map(({ order }) => order)).toEqual([1, 2]);
    expect(points.map(({ stoichiometricEquivalent }) => stoichiometricEquivalent)).toEqual([
      1,
      2,
    ]);
    expect(new Set(points.map(({ volumeMl }) => volumeMl)).size).toBe(2);
    expect(points.every(({ pH }) => pH !== undefined && Number.isFinite(pH))).toBe(true);
  });

  it.each([
    ["I", "protonation", ["h2co3.step1"]],
    ["J", "deprotonation", ["h2co3.step2"]],
  ] as const)(
    "builds Fixture %s as one cumulative boundary at 10 mL",
    (fixtureId, direction, stepIds) => {
      const fixture = V11_CONTRACT_FIXTURES[fixtureId];
      const planned = planCompositionTitrationBoundaries(fixture.input);
      const points = calculateCompositionEquivalencePoints(fixture.input);

      expect(planned.boundaryPlan.direction).toBe(direction);
      expect(planned.boundaryPlan.stages).toHaveLength(1);
      expect(planned.boundaryPlan.stages[0]).toMatchObject({
        order: 1,
        incrementalEquivalentMoles: 0.001,
        cumulativeEquivalentMoles: 0.001,
        participatingStepIds: stepIds,
      });
      expect(points).toHaveLength(1);
      expect(points[0]).toMatchObject({
        id: "equivalence-1",
        order: 1,
        volumeMl: 10,
        classification: "theoretical",
        stoichiometricEquivalent: 1,
        participatingStepIds: stepIds,
      });
      expect(points[0]?.pH).toEqual(expect.any(Number));
    },
  );

  it("keeps a boundary stage structurally capable of multiple contributions", () => {
    const stage: StoichiometricBoundaryStage = {
      order: 1,
      contributions: [
        {
          sourceComponentId: "source-a",
          processId: "process-a",
          kind: "family-step",
          equivalentMoles: 0.001,
        },
        {
          sourceComponentId: "source-b",
          processId: "process-b",
          kind: "strong-hydroxide",
          equivalentMoles: 0.002,
        },
      ],
      incrementalEquivalentMoles: 0.003,
      cumulativeEquivalentMoles: 0.003,
      participatingStepIds: ["process-a"],
    };

    expect(stage.contributions).toHaveLength(2);
    expect(stage.contributions.map(({ sourceComponentId }) => sourceComponentId)).toEqual([
      "source-a",
      "source-b",
    ]);
  });
});
