import { describe, expect, it } from "vitest";

import type { TitrationResult } from "../../src/domain/titration";

describe("titration result model", () => {
  it("holds multiple equivalence and characteristic points", () => {
    const result: TitrationResult = {
      equivalencePoints: [
        { id: "eq-1", order: 1, volumeMl: 10, pH: 4.2 },
        { id: "eq-2", order: 2, volumeMl: 20 },
      ],
      characteristicPoints: [
        {
          id: "half-eq-1",
          type: "half-equivalence",
          order: 1,
          volumeMl: 5,
          pH: 1.2,
        },
        {
          id: "half-eq-2",
          type: "half-equivalence",
          order: 2,
          volumeMl: 15,
        },
      ],
      points: [
        { addedVolumeMl: 0, pH: 1 },
        { addedVolumeMl: 10, pH: 4.2 },
      ],
    };

    expect(result.equivalencePoints).toHaveLength(2);
    expect(result.equivalencePoints[1]?.pH).toBeUndefined();
    expect(result.characteristicPoints).toHaveLength(2);
    expect(result.characteristicPoints[1]?.pH).toBeUndefined();
  });
});
