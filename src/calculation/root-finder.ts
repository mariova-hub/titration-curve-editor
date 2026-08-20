import { CalculationError } from "./errors";

export interface RootSolverOptions {
  initialLogHMin: number;
  initialLogHMax: number;
  hardLogHMin: number;
  hardLogHMax: number;
  expansionStep: number;
  logHTolerance: number;
  absoluteResidualTolerance: number;
  relativeResidualTolerance: number;
  maxIterations: number;
}

export const DEFAULT_ROOT_SOLVER_OPTIONS: Readonly<RootSolverOptions> = {
  initialLogHMin: -16,
  initialLogHMax: 2,
  hardLogHMin: -30,
  hardLogHMax: 6,
  expansionStep: 2,
  logHTolerance: 1e-10,
  absoluteResidualTolerance: 1e-12,
  relativeResidualTolerance: 1e-10,
  maxIterations: 256,
};

export interface ResidualEvaluation {
  residual: number;
  scale: number;
}

export interface RootResult {
  logH: number;
  iterations: number;
  residual: number;
}

function evaluateFinite(
  residualFunction: (logH: number) => ResidualEvaluation,
  logH: number,
): ResidualEvaluation {
  const evaluation = residualFunction(logH);
  if (!Number.isFinite(evaluation.residual) || !Number.isFinite(evaluation.scale)) {
    throw new CalculationError("non-finite-residual", `Non-finite residual at log10([H+]) = ${logH}.`);
  }
  return evaluation;
}

function hasOppositeSigns(left: number, right: number): boolean {
  return left === 0 || right === 0 || Math.sign(left) !== Math.sign(right);
}

export function solveLogHydrogenByBisection(
  residualFunction: (logH: number) => ResidualEvaluation,
  options: Readonly<RootSolverOptions> = DEFAULT_ROOT_SOLVER_OPTIONS,
): RootResult {
  let left = options.initialLogHMin;
  let right = options.initialLogHMax;
  let leftEvaluation = evaluateFinite(residualFunction, left);
  let rightEvaluation = evaluateFinite(residualFunction, right);

  while (!hasOppositeSigns(leftEvaluation.residual, rightEvaluation.residual)) {
    const nextLeft = Math.max(options.hardLogHMin, left - options.expansionStep);
    const nextRight = Math.min(options.hardLogHMax, right + options.expansionStep);
    if (nextLeft === left && nextRight === right) {
      throw new CalculationError(
        "bracket-failure",
        `Charge-balance root is not bracketed in log10([H+]) [${left}, ${right}].`,
      );
    }
    left = nextLeft;
    right = nextRight;
    leftEvaluation = evaluateFinite(residualFunction, left);
    rightEvaluation = evaluateFinite(residualFunction, right);
  }

  if (leftEvaluation.residual === 0) return { logH: left, iterations: 0, residual: 0 };
  if (rightEvaluation.residual === 0) return { logH: right, iterations: 0, residual: 0 };

  for (let iteration = 1; iteration <= options.maxIterations; iteration += 1) {
    const midpoint = (left + right) / 2;
    const midpointEvaluation = evaluateFinite(residualFunction, midpoint);
    const bestCandidate = [
      { logH: left, evaluation: leftEvaluation },
      { logH: midpoint, evaluation: midpointEvaluation },
      { logH: right, evaluation: rightEvaluation },
    ].reduce((best, candidate) =>
      Math.abs(candidate.evaluation.residual) < Math.abs(best.evaluation.residual)
        ? candidate
        : best,
    );
    const tolerance = Math.max(
      options.absoluteResidualTolerance,
      options.relativeResidualTolerance * bestCandidate.evaluation.scale,
    );

    if (
      Math.abs(bestCandidate.evaluation.residual) <= tolerance &&
      (right - left) / 2 <= options.logHTolerance
    ) {
      return {
        logH: bestCandidate.logH,
        iterations: iteration,
        residual: bestCandidate.evaluation.residual,
      };
    }

    if (hasOppositeSigns(leftEvaluation.residual, midpointEvaluation.residual)) {
      right = midpoint;
      rightEvaluation = midpointEvaluation;
    } else {
      left = midpoint;
      leftEvaluation = midpointEvaluation;
    }
  }

  throw new CalculationError(
    "convergence-failure",
    `Bisection did not converge within ${options.maxIterations} iterations.`,
  );
}
