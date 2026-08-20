export class RenderingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderingError";
  }
}
