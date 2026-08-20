import { describe, expect, it } from "vitest";

import { CalculationError } from "../../src/calculation/errors";
import { solveLogHydrogenByBisection } from "../../src/calculation/root-finder";

describe("deterministic log-hydrogen bisection", () => {
  it("finds a bracketed root reproducibly", () => {
    const first = solveLogHydrogenByBisection((x) => ({ residual: x + 7, scale: 1 }));
    const second = solveLogHydrogenByBisection((x) => ({ residual: x + 7, scale: 1 }));
    expect(first.logH).toBeCloseTo(-7, 10);
    expect(second).toEqual(first);
  });

  it("reports bracket failure instead of returning a fallback pH", () => {
    expect(() => solveLogHydrogenByBisection(() => ({ residual: 1, scale: 1 }))).toThrowError(
      expect.objectContaining<Partial<CalculationError>>({ code: "bracket-failure" }),
    );
  });
});
