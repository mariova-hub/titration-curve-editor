import type { ChemicalSpecies } from "../domain/chemistry";
import type { FixedIonId } from "../domain/solution-composition";

export interface FixedIon {
  id: FixedIonId;
  formula: string;
  charge: number;
  boundProtonCount: 0;
}

export const SODIUM_FIXED_ION_ID = "ion.na" as const satisfies FixedIonId;

const sodiumIon = {
  id: SODIUM_FIXED_ION_ID,
  formula: "Na+",
  charge: 1,
  boundProtonCount: 0,
} as const satisfies FixedIon;

export const FIXED_IONS: readonly FixedIon[] = [sodiumIon];

const fixedIonById = new Map<string, FixedIon>(
  FIXED_IONS.map((fixedIon) => [fixedIon.id, fixedIon]),
);

export function getFixedIonById(id: string): FixedIon | undefined {
  return fixedIonById.get(id);
}

/**
 * Resolves legacy complete-ion metadata to the canonical fixed-ion registry.
 * Identity is chemical metadata, not a legacy substance or species id.
 */
export function findCanonicalFixedIonBySpecies(
  species: Pick<ChemicalSpecies, "formula" | "charge" | "boundProtonCount">,
): FixedIon | undefined {
  return FIXED_IONS.find(
    (fixedIon) =>
      fixedIon.formula === species.formula &&
      fixedIon.charge === species.charge &&
      fixedIon.boundProtonCount === species.boundProtonCount,
  );
}
