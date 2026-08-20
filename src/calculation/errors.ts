export type CalculationErrorCode =
  | "invalid-input"
  | "non-finite-residual"
  | "bracket-failure"
  | "convergence-failure";

export class CalculationError extends Error {
  constructor(
    public readonly code: CalculationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CalculationError";
  }
}
