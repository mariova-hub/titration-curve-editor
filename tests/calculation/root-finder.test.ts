import { describe, expect, it } from "vitest";

import { CalculationError } from "../../src/calculation/errors";
import {
  DEFAULT_ROOT_SOLVER_OPTIONS,
  solveLogHydrogenByBisection,
  type RootSolverOptions,
} from "../../src/calculation/root-finder";

function solverOptions(
  override: Partial<RootSolverOptions>,
): RootSolverOptions {
  return { ...DEFAULT_ROOT_SOLVER_OPTIONS, ...override };
}

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

  it("does not return when only the residual tolerance is satisfied", () => {
    const result = solveLogHydrogenByBisection(
      (x) => ({ residual: x, scale: 1 }),
      solverOptions({
        initialLogHMin: -1,
        initialLogHMax: 1,
        hardLogHMin: -1,
        hardLogHMax: 1,
        logHTolerance: 1e-10,
        absoluteResidualTolerance: 1e-12,
        relativeResidualTolerance: 0,
      }),
    );

    expect(result.iterations).toBeGreaterThan(1);
    expect(Math.abs(result.residual)).toBeLessThanOrEqual(1e-12);
  });

  it("does not return when only the bracket-width tolerance is satisfied", () => {
    expect(() => solveLogHydrogenByBisection(
      (x) => ({ residual: x < 0 ? -1 : 1, scale: 1 }),
      solverOptions({
        initialLogHMin: -1,
        initialLogHMax: 1,
        hardLogHMin: -1,
        hardLogHMax: 1,
        logHTolerance: 2,
        absoluteResidualTolerance: 0.1,
        relativeResidualTolerance: 0,
        maxIterations: 3,
      }),
    )).toThrowError(
      expect.objectContaining<Partial<CalculationError>>({ code: "convergence-failure" }),
    );
  });

  it("returns when bracket width and residual tolerances are both satisfied", () => {
    const result = solveLogHydrogenByBisection(
      (x) => ({ residual: x, scale: 1 }),
      solverOptions({
        initialLogHMin: -1,
        initialLogHMax: 1,
        hardLogHMin: -1,
        hardLogHMax: 1,
        logHTolerance: 2,
        absoluteResidualTolerance: 1e-12,
        relativeResidualTolerance: 0,
      }),
    );

    expect(result).toEqual({ logH: 0, iterations: 1, residual: 0 });
  });

  it("reports convergence failure at the iteration limit", () => {
    expect(() => solveLogHydrogenByBisection(
      (x) => ({ residual: x < 0 ? -1 : 1, scale: 1 }),
      solverOptions({
        initialLogHMin: -1,
        initialLogHMax: 1,
        hardLogHMin: -1,
        hardLogHMax: 1,
        absoluteResidualTolerance: 0.1,
        relativeResidualTolerance: 0,
        maxIterations: 2,
      }),
    )).toThrowError(
      expect.objectContaining<Partial<CalculationError>>({ code: "convergence-failure" }),
    );
  });

  it("rejects a non-finite residual", () => {
    expect(() => solveLogHydrogenByBisection(() => ({
      residual: Number.NaN,
      scale: 1,
    }))).toThrowError(
      expect.objectContaining<Partial<CalculationError>>({ code: "non-finite-residual" }),
    );
  });
});
