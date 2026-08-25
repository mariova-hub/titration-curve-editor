import { describe, expect, it } from "vitest";

import {
  deriveSubstanceProtonTransferProfile,
  getProfileEquivalentCapacity,
  resolveProtonTransferPairing,
  resolveSubstanceProtonTransferPairing,
} from "../../src/chemistry/proton-transfer";
import { getSubstanceById } from "../../src/chemistry/substances";
import type { Substance } from "../../src/domain/chemistry";
import {
  AMBIGUOUS_PROTON_TRANSFER_DIRECTION,
  type ProtonTransferProcess,
  type ProtonTransferProfile,
} from "../../src/domain/stoichiometry";

function requireSubstance(id: string): Substance {
  const substance = getSubstanceById(id);
  if (substance === undefined) throw new Error(`Missing test substance: ${id}`);
  return substance;
}

function capabilityCounts(substance: Substance): { accept: number; donate: number } {
  const profile = deriveSubstanceProtonTransferProfile(substance);
  return {
    accept: getProfileEquivalentCapacity(profile, "accept"),
    donate: getProfileEquivalentCapacity(profile, "donate"),
  };
}

function process(id: string): ProtonTransferProcess {
  return {
    kind: "family-step",
    processId: id,
    stepId: id,
    fromSpeciesId: `${id}.from`,
    toSpeciesId: `${id}.to`,
    equivalentPerSourceMole: 1,
  };
}

function localProfile(
  donateProcesses: readonly ProtonTransferProcess[],
  acceptProcesses: readonly ProtonTransferProcess[],
): ProtonTransferProfile {
  return {
    sources: [
      {
        sourceComponentId: "local-source",
        amountMol: 1,
        donateProcesses,
        acceptProcesses,
      },
    ],
  };
}

describe("derived proton-transfer capability", () => {
  it("derives Na2CO3 accept 2 / donate 0 from h2co3.co3 topology", () => {
    const substance = requireSubstance("na2co3");
    const profile = deriveSubstanceProtonTransferProfile({
      ...substance,
      roles: ["acid"],
    });
    const source = profile.sources[0]!;

    expect(capabilityCounts({ ...substance, roles: ["acid"] })).toEqual({
      accept: 2,
      donate: 0,
    });
    expect(source.acceptProcesses.map(({ processId }) => processId)).toEqual([
      "h2co3.step2",
      "h2co3.step1",
    ]);
    expect(source.donateProcesses).toEqual([]);
  });

  it("derives amphiprotic NaHCO3 accept 1 / donate 1 without reading roles", () => {
    const substance = requireSubstance("nahco3");
    const profile = deriveSubstanceProtonTransferProfile({
      ...substance,
      roles: [],
    });
    const source = profile.sources[0]!;

    expect(capabilityCounts({ ...substance, roles: [] })).toEqual({
      accept: 1,
      donate: 1,
    });
    expect(source.acceptProcesses.map(({ processId }) => processId)).toEqual([
      "h2co3.step1",
    ]);
    expect(source.donateProcesses.map(({ processId }) => processId)).toEqual([
      "h2co3.step2",
    ]);
  });

  it("bridges legacy HCl as donor and NaOH as acceptor from chemistry metadata", () => {
    expect(capabilityCounts(requireSubstance("hcl"))).toEqual({
      accept: 0,
      donate: 1,
    });
    expect(capabilityCounts(requireSubstance("naoh"))).toEqual({
      accept: 1,
      donate: 0,
    });
  });
});

describe("proton-transfer pairing", () => {
  it.each([
    ["na2co3", "hcl", "protonation", 2],
    ["nahco3", "hcl", "protonation", 1],
    ["nahco3", "naoh", "deprotonation", 1],
  ] as const)(
    "supports %s + %s with a unique %s direction",
    (analyteId, titrantId, direction, analyteSteps) => {
      const analyte = requireSubstance(analyteId);
      const titrant = requireSubstance(titrantId);
      const result = resolveSubstanceProtonTransferPairing(analyte, titrant);

      expect(result.status).toBe("supported");
      if (result.status !== "supported") return;
      expect(result.candidateCount).toBe(1);
      expect(result.direction).toBe(direction);
      expect(result.titrantEquivalentCapacityPerMol).toBe(1);
      expect(
        getProfileEquivalentCapacity(
          deriveSubstanceProtonTransferProfile(analyte),
          result.analyteMode,
        ),
      ).toBe(analyteSteps);
    },
  );

  it("uses the existing incompatible runtime code for zero candidates", () => {
    const result = resolveSubstanceProtonTransferPairing(
      requireSubstance("hcl"),
      requireSubstance("hno3"),
    );

    expect(result).toEqual({
      status: "incompatible",
      candidateCount: 0,
      code: "incompatible-acid-base-pair",
    });
  });

  it("uses the canonical ambiguous runtime code when two directions remain", () => {
    const amphiprotic = localProfile(
      [process("donate")],
      [process("accept")],
    );
    const result = resolveProtonTransferPairing(amphiprotic, amphiprotic);

    expect(AMBIGUOUS_PROTON_TRANSFER_DIRECTION).toBe(
      "ambiguous-proton-transfer-direction",
    );
    expect(result).toEqual({
      status: "ambiguous",
      candidateCount: 2,
      code: "ambiguous-proton-transfer-direction",
    });
  });
});
