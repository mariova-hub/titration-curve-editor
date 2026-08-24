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
