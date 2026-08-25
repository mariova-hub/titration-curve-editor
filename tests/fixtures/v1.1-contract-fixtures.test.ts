import { describe, expect, it } from "vitest";

import {
  calculateCompositionEquivalencePoints,
  calculateHalfEquivalencePoints,
  calculatePHAtVolume,
  calculateTitrationCurve,
} from "../../src/calculation";
import { resolveSubstanceProtonTransferPairing } from "../../src/chemistry/proton-transfer";
import { getSubstanceById } from "../../src/chemistry/substances";
import {
  V11_CONTRACT_FIXTURES,
  V11_PH_TOLERANCE_DIGITS,
} from "./titration-fixtures";

describe("v1.1 Phase 1 contract fixtures H-J", () => {
  it("contains exactly the three v1.1 acceptance fixtures", () => {
    expect(Object.keys(V11_CONTRACT_FIXTURES)).toEqual(["H", "I", "J"]);
  });

  it.each([
    ["H", "na2co3", 0.05, 20, "hcl", 0.1],
    ["I", "nahco3", 0.05, 20, "hcl", 0.1],
    ["J", "nahco3", 0.05, 20, "naoh", 0.1],
  ] as const)(
    "fixes Fixture %s identity and concentrations",
    (id, analyteId, analyteConcentration, analyteVolume, titrantId, titrantConcentration) => {
      const fixture = V11_CONTRACT_FIXTURES[id];

      expect(fixture.id).toBe(id);
      expect(fixture.input).toEqual({
        analyteSubstanceId: analyteId,
        analyteConcentrationMolL: analyteConcentration,
        analyteVolumeMl: analyteVolume,
        titrantSubstanceId: titrantId,
        titrantConcentrationMolL: titrantConcentration,
      });
    },
  );

  it.each([
    [
      "H",
      [
        { volumeMl: 0, pH: 11.5002912257 },
        { volumeMl: 5, pH: 10.3210443569 },
        { volumeMl: 10, pH: 8.3385863386 },
        { volumeMl: 15, pH: 6.3498894298 },
        { volumeMl: 20, pH: 3.9769474833 },
      ],
    ],
    [
      "I",
      [
        { volumeMl: 0, pH: 8.339056533 },
        { volumeMl: 5, pH: 6.3498820604 },
        { volumeMl: 10, pH: 3.914355218 },
      ],
    ],
    [
      "J",
      [
        { volumeMl: 0, pH: 8.339056533 },
        { volumeMl: 5, pH: 10.3210443569 },
        { volumeMl: 10, pH: 11.4090571928 },
      ],
    ],
  ] as const)("fixes Fixture %s independent golden pH anchors", (id, expectedPH) => {
    expect(V11_CONTRACT_FIXTURES[id].expectedPH).toEqual(expectedPH);
    expect(expectedPH.every(({ pH }) => Number.isFinite(pH))).toBe(true);
  });

  it.each([
    ["H", [10, 20], [5, 15], "descending", 2],
    ["I", [10], [5], "descending", 1],
    ["J", [10], [5], "ascending", 1],
  ] as const)(
    "fixes Fixture %s equivalence, characteristic, direction, and guide contracts",
    (id, equivalenceVolumes, characteristicVolumes, direction, guideCount) => {
      const fixture = V11_CONTRACT_FIXTURES[id];

      expect(fixture.equivalenceVolumesMl).toEqual(equivalenceVolumes);
      expect(fixture.characteristicVolumesMl).toEqual(characteristicVolumes);
      expect(fixture.expectedDirection).toBe(direction);
      expect(fixture.expectedEquivalenceGuideCount).toBe(guideCount);
      expect(fixture.expectedEquivalenceGuideCount).toBe(fixture.equivalenceVolumesMl.length);
    },
  );

  it("keeps Fixture H's two-stage adaptive-sampling anchors and targets", () => {
    const fixture = V11_CONTRACT_FIXTURES.H;

    expect(fixture.exactAnchorVolumesMl).toEqual([5, 10, 15, 20]);
    expect(fixture.refinementTargetVolumesMl).toEqual([10, 20]);
    expect(new Set(fixture.exactAnchorVolumesMl).size).toBe(
      fixture.exactAnchorVolumesMl.length,
    );
  });

  it.each(Object.values(V11_CONTRACT_FIXTURES))(
    "keeps Fixture $id anchors complete, unique, and directionally consistent",
    (fixture) => {
      const expectedAnchors = [
        ...new Set([
          ...fixture.characteristicVolumesMl,
          ...fixture.equivalenceVolumesMl,
        ]),
      ].sort((left, right) => left - right);
      const goldenVolumes = new Set(fixture.expectedPH.map(({ volumeMl }) => volumeMl));
      const equivalenceVolumes = new Set<number>(fixture.equivalenceVolumesMl);
      const pHValues = fixture.expectedPH.map(({ pH }) => pH);
      const pHDifferences = pHValues.slice(1).map((pH, index) => pH - pHValues[index]!);

      expect(fixture.exactAnchorVolumesMl).toEqual(expectedAnchors);
      expect(fixture.exactAnchorVolumesMl.every((volumeMl) => goldenVolumes.has(volumeMl))).toBe(
        true,
      );
      expect(
        fixture.refinementTargetVolumesMl.every((volumeMl) => equivalenceVolumes.has(volumeMl)),
      ).toBe(true);
      expect(
        pHDifferences.every((difference) =>
          fixture.expectedDirection === "ascending" ? difference > 0 : difference < 0
        ),
      ).toBe(true);
    },
  );

  it.each([
    ["H", "protonation"],
    ["I", "protonation"],
    ["J", "deprotonation"],
  ] as const)("derives Fixture %s pairing from chemical capability", (id, direction) => {
    const pairing = V11_CONTRACT_FIXTURES[id].pairing;

    expect(pairing).toEqual({
      status: "supported",
      basis: "derived-capability",
      protonTransferDirection: direction,
    });
    expect(pairing).not.toHaveProperty("roles");
  });

  it("retains the A-G pH assertion precision for H-J", () => {
    expect(V11_PH_TOLERANCE_DIGITS).toBe(3);
  });
});

describe("v1.1 production integration contracts (Phase 2 and later)", () => {
  it.todo("connect H-J equivalence-guide counts to rendering and export output");

  it("connects Fixture H exact anchors and both refinement targets to adaptive sampling", () => {
    const fixture = V11_CONTRACT_FIXTURES.H;
    const result = calculateTitrationCurve(fixture.input);
    const sampledVolumes = result.points.map(({ addedVolumeMl }) => addedVolumeMl);

    for (const anchor of fixture.exactAnchorVolumesMl) {
      expect(sampledVolumes.filter((volumeMl) => volumeMl === anchor)).toHaveLength(1);
    }
    for (const target of fixture.refinementTargetVolumesMl) {
      expect(
        sampledVolumes.filter(
          (volumeMl) => volumeMl >= target - 0.5 && volumeMl <= target + 0.5,
        ).length,
      ).toBeGreaterThan(30);
    }
  });

  it.each(Object.values(V11_CONTRACT_FIXTURES))(
    "connects Fixture $id golden pH and characteristic volumes to the solver",
    (fixture) => {
      for (const { volumeMl, pH } of fixture.expectedPH) {
        expect(calculatePHAtVolume(fixture.input, volumeMl)).toBeCloseTo(
          pH,
          V11_PH_TOLERANCE_DIGITS,
        );
      }

      const equivalencePoints = calculateCompositionEquivalencePoints(
        fixture.input,
      );
      const characteristicPoints = calculateHalfEquivalencePoints(
        fixture.input,
        equivalencePoints,
      );
      expect(characteristicPoints.map(({ volumeMl }) => volumeMl)).toEqual(
        fixture.characteristicVolumesMl,
      );
    },
  );

  it.each(Object.values(V11_CONTRACT_FIXTURES))(
    "connects Fixture $id equivalence volumes to boundary-based production planning",
    (fixture) => {
      const points = calculateCompositionEquivalencePoints(fixture.input);

      expect(points.map(({ volumeMl }) => volumeMl)).toEqual(
        fixture.equivalenceVolumesMl,
      );
      expect(points).toHaveLength(fixture.equivalenceVolumesMl.length);
    },
  );

  it.each(Object.values(V11_CONTRACT_FIXTURES))(
    "connects Fixture $id to initial-species-derived capability validation",
    (fixture) => {
      const analyte = getSubstanceById(fixture.input.analyteSubstanceId);
      const titrant = getSubstanceById(fixture.input.titrantSubstanceId);
      expect(analyte).toBeDefined();
      expect(titrant).toBeDefined();
      if (analyte === undefined || titrant === undefined) return;

      const result = resolveSubstanceProtonTransferPairing(analyte, titrant);
      expect(result.status).toBe("supported");
      if (result.status !== "supported") return;
      expect(result.direction).toBe(
        fixture.pairing.protonTransferDirection,
      );
    },
  );
});
