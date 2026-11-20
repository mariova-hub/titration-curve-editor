import { describe, expect, it } from "vitest";
import { calculatePHDetailsAtVolume, calculateTitrationCurve, CalculationError } from "../../src/calculation";
import { getSubstanceById } from "../../src/chemistry";
import type { TitrationInput } from "../../src/domain/titration";
import { parseTcurveFile, restoreProjectState, serializeProject } from "../../src/project";
import { canExportSvg, createAppState, DEFAULT_TITRATION_DRAFT, updateGraphStyle, updateTitrationDraft } from "../../src/ui";

// University of Calgary, Organic Chemistry, Ch. 27, pKa and pI values.
// https://www.chem.ucalgary.ca/courses/350/Carey5th/Ch27/ch27-1-4-2.html
// pH references from a separate decimal calculation using the polynomial species
// distribution and solving the charge balance for V_NaOH as a function of pH.
const aminoAcids = [
  {
    id: "glycine", pKa: [2.34, 9.60], pI: 5.97, charges: [1, 0, -1],
    standardPH: [1.71633728, 2.43589567, 5.98883111, 9.59827797, 11.05393537, 12.15729593],
    dilutedPH: [1.94202968, 2.51157935, 6.00474300, 9.59691002, 10.93354737, 11.93701438],
  },
  {
    id: "glutamic-acid", pKa: [2.19, 4.25, 9.67], pI: 3.22, charges: [1, 0, -1, -2],
    standardPH: [1.64894379, 2.30414946, 3.25096995, 4.26321481, 6.96006914, 9.66717952, 11.02457824, 12.04935376],
    dilutedPH: [1.87879650, 2.39484072, 3.27598061, 4.26503217, 6.96011362, 9.66531604, 10.91657171, 11.84932544],
  },
  {
    id: "lysine", pKa: [2.18, 8.95, 10.53], pI: 9.74, charges: [2, 1, 0, -1],
    standardPH: [1.64566289, 2.30888922, 5.59192700, 8.91886666, 9.73709615, 10.54150886, 11.44010419, 12.06950760],
    dilutedPH: [1.87662557, 2.40249036, 5.61397849, 8.91860342, 9.73502275, 10.52956627, 11.32815678, 11.87941255],
  },
];

describe.each(aminoAcids)("$id hydrochloride / NaOH", (reference) => {
  const input: TitrationInput = {
    analyteSubstanceId: reference.id,
    analyteConcentrationMolL: 0.1,
    analyteVolumeMl: 20,
    titrantSubstanceId: "naoh",
    titrantConcentrationMolL: 0.1,
  };

  it("uses the documented pKa values and derives pI from the zwitterion's adjacent steps", () => {
    const model = getSubstanceById(reference.id)!.acidBaseModel;
    if (model.kind !== "protonation-family") throw new Error("Expected a protonation family");
    const { species, dissociationSteps } = model.family;
    expect(species.map(({ charge }) => charge)).toEqual(reference.charges);
    const pKa = dissociationSteps.map((step) => {
      if (step.mode !== "equilibrium" || step.ka.status !== "confirmed") throw new Error("Missing Ka");
      return -Math.log10(step.ka.value);
    });
    pKa.forEach((value, index) => expect(value).toBeCloseTo(reference.pKa[index]!, 9));
    const zero = species.findIndex(({ charge }) => charge === 0);
    expect((pKa[zero - 1]! + pKa[zero]!) / 2).toBeCloseTo(reference.pI, 9);
  });

  it("matches independent pH references and closes mass and charge balances", () => {
    const conditions = [
      { titration: input, stepMl: 10, pH: reference.standardPH },
      {
        titration: { ...input, analyteConcentrationMolL: 0.04, analyteVolumeMl: 15, titrantConcentrationMolL: 0.075 },
        stepMl: 4,
        pH: reference.dilutedPH,
      },
    ];
    for (const { titration, stepMl, pH } of conditions) {
      pH.forEach((expected, index) => {
        const addedMl = index * stepMl;
        const details = calculatePHDetailsAtVolume(titration, addedMl);
        const { chargeBalance, system } = details;
        const species = chargeBalance.speciesConcentrations.filter(({ speciesId }) => speciesId.startsWith(`${reference.id}.`));
        const totalMl = titration.analyteVolumeMl + addedMl;
        const expectedConcentration = titration.analyteConcentrationMolL * titration.analyteVolumeMl / totalMl;
        expect(details.pH).toBeCloseTo(expected, 7);
        expect(details.iterations).toBeGreaterThan(0);
        expect(Math.abs(chargeBalance.residualMolL)).toBeLessThan(1e-11);
        expect(chargeBalance.hydrogenConcentrationMolL * chargeBalance.hydroxideConcentrationMolL).toBeCloseTo(1e-14, 24);
        expect(species.reduce((sum, entry) => sum + entry.concentrationMolL, 0)).toBeCloseTo(expectedConcentration, 13);
        expect(system.fixedIons.find(({ species }) => species.id === "ion.cl")?.concentrationMolL)
          .toBeCloseTo(reference.charges[0]! * expectedConcentration, 13);
        if (addedMl === 0) {
          expect(species[0]!.concentrationMolL).toBeGreaterThan(expectedConcentration / 2);
        } else {
          expect(system.fixedIons.find(({ species }) => species.charge === 1)?.concentrationMolL)
            .toBeCloseTo(titration.titrantConcentrationMolL * addedMl / totalMl, 13);
        }
      });
    }
  });

  it("draws the increasing curve with sampled theoretical and half-equivalence points", () => {
    const result = calculateTitrationCurve(input);
    expect(result.equivalencePoints).toHaveLength(reference.pKa.length);
    expect(result.characteristicPoints).toHaveLength(reference.pKa.length);
    result.equivalencePoints.forEach((point, index) => {
      const midpoint = result.characteristicPoints[index]!;
      expect(point.classification).toBe("theoretical");
      expect(point.volumeMl).toBeCloseTo((index + 1) * 20, 9);
      expect(midpoint.volumeMl).toBeCloseTo((index + 0.5) * 20, 9);
      expect(point.pH).toBeCloseTo(reference.standardPH[(index + 1) * 2]!, 7);
      expect(midpoint.pH).toBeCloseTo(reference.standardPH[index * 2 + 1]!, 7);
      expect(Math.abs(midpoint.pH! - reference.pKa[index]!)).toBeLessThan(1);
      for (const feature of [point, midpoint]) {
        expect(result.points).toContainEqual({ addedVolumeMl: feature.volumeMl, pH: feature.pH });
      }
    });
    expect(result.points.every(({ pH }, index) => index === 0 || pH >= result.points[index - 1]!.pH)).toBe(true);
  });

  it("round-trips schema v1 settings and an exportable edited curve", () => {
    const original = updateGraphStyle(
      createAppState({ ...DEFAULT_TITRATION_DRAFT, analyteSubstanceId: reference.id }),
      (style) => ({ ...style, curve: { ...style.curve, color: "#2455aa" } }),
    );
    const project = parseTcurveFile(JSON.stringify(serializeProject(original)));
    const restored = restoreProjectState(project);
    expect(project.schemaVersion).toBe(1);
    expect(restored.chemical.validatedInput).toEqual(input);
    expect(restored.chemical.result).toEqual(original.chemical.result);
    expect(restored.rendering.graphStyle).toEqual(original.rendering.graphStyle);
    expect(restored.rendering.svgString).toContain("#2455aa");
    expect(canExportSvg(restored)).toBe(true);
  });
});

it("prevents exporting a stale curve when the amino acid calculation fails", () => {
  const original = createAppState();
  const failed = updateTitrationDraft(original, "analyteSubstanceId", "glycine", {
    calculateCurve: () => { throw new CalculationError("convergence-failure", "test failure"); },
    renderSvg: () => { throw new Error("unexpected render"); },
  });
  expect(failed.chemical.status).toBe("calculation-error");
  expect(failed.chemical.previewIsStale).toBe(true);
  expect(failed.rendering.svgString).toBe(original.rendering.svgString);
  expect(canExportSvg(failed)).toBe(false);
});
