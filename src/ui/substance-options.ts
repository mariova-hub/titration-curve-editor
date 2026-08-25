import { SUBSTANCES } from "../chemistry/substances";
import type {
  Substance,
  SubstanceSelectionCategory,
} from "../domain/chemistry";
import { formatChemicalFormulaForDisplay } from "./chemical-formula";

export interface SubstanceSelectionOption {
  id: string;
  label: string;
}

export interface SubstanceSelectionGroup {
  id: SubstanceSelectionCategory;
  label: string;
  options: readonly SubstanceSelectionOption[];
}

const GROUPS: ReadonlyArray<{
  id: SubstanceSelectionCategory;
  label: string;
}> = [
  { id: "acid", label: "酸" },
  { id: "base", label: "塩基" },
  { id: "salt-or-amphiprotic", label: "塩・両性種" },
];

export function getPresentationSelectionCategory(
  substance: Substance,
): SubstanceSelectionCategory {
  if (substance.selectionCategory !== undefined) {
    return substance.selectionCategory;
  }
  return substance.roles.includes("acid") ? "acid" : "base";
}

export function createSubstanceSelectionGroups(
  substances: readonly Substance[] = SUBSTANCES,
): SubstanceSelectionGroup[] {
  return GROUPS.map(({ id, label }) => ({
    id,
    label,
    options: substances
      .filter((substance) => getPresentationSelectionCategory(substance) === id)
      .map((substance) => ({
        id: substance.id,
        label: `${substance.displayNameJa} (${formatChemicalFormulaForDisplay(substance.formula)})`,
      })),
  }));
}
