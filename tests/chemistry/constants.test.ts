import { describe, expect, it } from "vitest";

import { KW_25C } from "../../src/chemistry/constants";

describe("chemistry constants", () => {
  it("fixes Kw at 1.0e-14 for 25 degrees Celsius", () => {
    expect(KW_25C).toBe(1.0e-14);
  });
});
