import { calculateSpeciesFractions } from "../chemistry/species-distribution";
import type { ChemicalSpecies, Substance } from "../domain/chemistry";
import type { TitrationResult } from "../domain/titration";
import { formatChemicalFormulaForDisplay } from "./chemical-formula";

function speciesText(species: ChemicalSpecies): string {
  const charge = species.charge > 0 ? `+${species.charge}` : String(species.charge).replace("-", "−");
  const zwitterion = species.charge === 0 ? "・双性イオン" : "";
  return `${formatChemicalFormulaForDisplay(species.formula)}（正味電荷 ${charge}${zwitterion}）`;
}

function pointText(point: { volumeMl: number; pH?: number }): string {
  const volume = new Intl.NumberFormat("ja", { maximumSignificantDigits: 4 }).format(point.volumeMl);
  return `${volume} mL、pH ${point.pH?.toFixed(2) ?? "—"}`;
}

export function renderAminoAcidDetails(
  target: HTMLElement,
  substance: Substance,
  result: TitrationResult,
  aminoAcidTitrant: boolean,
): void {
  target.replaceChildren();
  const { aminoAcid, acidBaseModel } = substance;
  if (aminoAcid === undefined || acidBaseModel.kind !== "protonation-family") return;

  const { species, dissociationSteps } = acidBaseModel.family;
  const kaValues = dissociationSteps.map((step) => {
    if (step.mode !== "equilibrium" || step.ka.status !== "confirmed") {
      throw new Error(`Amino acid step ${step.id} has no confirmed Ka.`);
    }
    return step.ka.value;
  });
  const pKa = kaValues.map((ka) => -Math.log10(ka));
  const neutralIndex = species.findIndex(({ charge }) => charge === 0);
  const pI = (pKa[neutralIndex - 1]! + pKa[neutralIndex]!) / 2;
  const initialPH = result.points[0]!.pH;

  const summary = document.createElement("p");
  summary.textContent = `等電点 pI ≈ ${pI.toFixed(2)}（双性イオンを挟む pKa ${neutralIndex} と ${neutralIndex + 1} の平均）`;
  const initial = document.createElement("p");
  if (aminoAcidTitrant) {
    initial.textContent = `添加前の pH ${initialPH.toFixed(2)}（水酸化ナトリウム水溶液）。`;
  } else {
    const fractions = calculateSpeciesFractions({ species, kaValues }, 10 ** -initialPH);
    const dominant = fractions.reduce((maximum, entry) => entry.fraction > maximum.fraction ? entry : maximum);
    initial.textContent = `添加前の pH ${initialPH.toFixed(2)}。最も多い種は ${speciesText(dominant.species)}。`;
  }

  const speciesList = document.createElement("ul");
  speciesList.setAttribute("aria-label", "酸性側からのイオン形");
  for (const form of species) {
    const item = document.createElement("li");
    item.textContent = speciesText(form);
    speciesList.append(item);
  }

  const stages = document.createElement("ol");
  stages.setAttribute("aria-label", aminoAcidTitrant ? "プロトン化段階と滴定量" : "解離段階と滴定量");
  result.equivalencePoints.forEach((equivalent, index) => {
    const stepIndex = aminoAcidTitrant ? pKa.length - 1 - index : index;
    const value = pKa[stepIndex]!;
    const half = pointText(result.characteristicPoints[index]!);
    const end = pointText(equivalent);
    const item = document.createElement("li");
    const titrationPoints = aminoAcidTitrant ? `当量 ${end}、中間点 ${half}。` : `半当量 ${half}、当量 ${end}。`;
    item.textContent = `${aminoAcid.dissociationSites[stepIndex]}（pKa ${value.toFixed(2)}）。` +
      `緩衝域の目安 pH ${(value - 1).toFixed(2)}–${(value + 1).toFixed(2)}。` +
      titrationPoints;
    stages.append(item);
  });

  const note = document.createElement("p");
  note.textContent = aminoAcidTitrant
    ? "当量点と中間点の体積は、滴下したアミノ酸と最初の NaOH の物質量の比から計算します。表示する pH は平衡計算値です。"
    : "緩衝域は pKa ± 1 の目安です。半当量・当量で示す pH は平衡計算値です。当量点の体積は化学量論で決まり、変曲点は曲線の形で決まります。";
  target.append(summary, initial, speciesList, stages, note);
}
