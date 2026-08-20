import type { ChemicalConstantSource, ConfirmedKa } from "../domain/chemistry";

/** Water ion-product constant at 25 °C. */
export const KW_25C = 1.0e-14;

export const CONSTANT_SOURCES = {
  nistAcids: {
    id: "nist-jres-73a-299",
    title: "Ionization Constants of Acids and Bases in H2O and D2O",
    url: "https://nvlpubs.nist.gov/nistpubs/jres/73A/jresv73An3p299_A1b.pdf",
    citation: "J. Res. NBS 73A (1969), Table 7",
  },
  highSchoolHandbookSet: {
    id: "chemical-handbook-basic-6-high-school-set",
    title: "化学便覧 基礎編 改訂6版を基礎とする高校化学教材用定数セット",
    url: "https://www.hanmoto.com/bd/isbn/9784621305218",
    citation:
      "日本化学会編『化学便覧 基礎編 改訂6版』11.2–11.3を基礎とする高校教材採用値（2026-08-20指定）",
  },
  usgsCarbonate: {
    id: "usgs-carbonic-25c",
    title: "Equilibrium Constants for Water, Carbonic Acid, and Bicarbonate",
    url: "https://water.usgs.gov/water-resources/memos/memo.php?id=2098",
    citation: "USGS Water Resources Division Memorandum 81.11 (25 °C values)",
  },
  nistPhosphate: {
    id: "nist-jres-105-193",
    title: "Second and Third Dissociation Constants of Phosphoric Acid",
    url: "https://nvlpubs.nist.gov/nistpubs/jres/105/2/j52car.pdf",
    citation: "J. Res. NIST 105 (2000), 25 °C K2 and K3",
  },
} as const satisfies Record<string, ChemicalConstantSource>;

const REVIEWED_AT = "2026-08-20";

function confirmedKa(
  value: number,
  source: ChemicalConstantSource,
  note?: string,
): ConfirmedKa {
  return {
    status: "confirmed",
    kind: "Ka",
    value,
    temperatureC: 25,
    source,
    reviewedAt: REVIEWED_AT,
    ...(note === undefined ? {} : { note }),
  };
}

export const NH3_KB_25C = 2.3e-5;

export const ACID_DISSOCIATION_CONSTANTS = {
  hso4: confirmedKa(10 ** -1.983, CONSTANT_SOURCES.nistAcids),
  aceticAcid: confirmedKa(
    2.69e-5,
    CONSTANT_SOURCES.highSchoolHandbookSet,
    "High-school educational value selected for this application.",
  ),
  oxalicAcid1: confirmedKa(
    9.12e-2,
    CONSTANT_SOURCES.highSchoolHandbookSet,
    "High-school educational value selected for this application.",
  ),
  oxalicAcid2: confirmedKa(
    1.51e-4,
    CONSTANT_SOURCES.highSchoolHandbookSet,
    "High-school educational value selected for this application.",
  ),
  carbonicAcid1: confirmedKa(
    10 ** -6.35,
    CONSTANT_SOURCES.usgsCarbonate,
    "Conventional H2CO3* value: dissolved CO2(aq) and H2CO3 are combined.",
  ),
  carbonicAcid2: confirmedKa(10 ** -10.33, CONSTANT_SOURCES.usgsCarbonate),
  phosphoricAcid1: confirmedKa(10 ** -2.148, CONSTANT_SOURCES.nistAcids),
  phosphoricAcid2: confirmedKa(6.46e-8, CONSTANT_SOURCES.nistPhosphate),
  phosphoricAcid3: confirmedKa(4.47e-13, CONSTANT_SOURCES.nistPhosphate),
  ammonium: confirmedKa(
    KW_25C / NH3_KB_25C,
    CONSTANT_SOURCES.highSchoolHandbookSet,
    "Derived once as Ka(NH4+) = Kw / Kb(NH3), using the high-school educational Kb = 2.3e-5.",
  ),
} as const;
