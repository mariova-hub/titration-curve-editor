import { describe, expect, it } from "vitest";

import { buildAnalyticalSystem } from "../../src/chemistry/chemical-system";
import { FIXTURES } from "../fixtures/titration-fixtures";

describe("analytical amounts and chemical-system compilation", () => {
  it("converts mL to L and includes dilution in every concentration", () => {
    const system = buildAnalyticalSystem(FIXTURES.A.input, 10);
    expect(system.analyteMoles).toBeCloseTo(0.002, 15);
    expect(system.titrantMoles).toBeCloseTo(0.001, 15);
    expect(system.totalVolumeL).toBeCloseTo(0.03, 15);
    expect(system.fixedIons.find(({ species }) => species.formula === "Cl-")?.concentrationMolL)
      .toBeCloseTo(0.002 / 0.03, 14);
    expect(system.fixedIons.find(({ species }) => species.formula === "Na+")?.concentrationMolL)
      .toBeCloseTo(0.001 / 0.03, 14);
  });

  it("compiles H2SO4 complete step into an HSO4-/SO4^2- equilibrium family", () => {
    const system = buildAnalyticalSystem(FIXTURES.E.input, 0);
    expect(system.families).toHaveLength(1);
    expect(system.families[0]?.species.map(({ formula }) => formula)).toEqual(["HSO4-", "SO4^2-"]);
    expect(system.families[0]?.kaValues).toHaveLength(1);
  });

  it("uses Ca2+ as a fixed ion without adding a fixed OH- concentration", () => {
    const system = buildAnalyticalSystem(FIXTURES.G.input, 0);
    expect(system.fixedIons.map(({ species }) => species.formula)).toEqual(["Ca^2+"]);
    expect(system.fixedIons[0]?.concentrationMolL).toBeCloseTo(0.05, 14);
  });
});
