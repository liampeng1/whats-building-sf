/**
 * Per-code intensity within its `gen` family (0 = lowest density, 1 = highest).
 * Used to ramp fillOpacity on the zoning overlay so RH-1 reads pale and RM-4
 * reads strong inside the same sage-green Residential hue. Codes not listed
 * fall back to the gen midpoint via getZoningIntensity.
 *
 * Rankings are hand-derived from SF Planning Code allowed density / FAR / use
 * intensity — not an exact normalization. Authoritative ordering reference:
 * https://sfplanning.org/sites/default/files/documents/zoning/Zoning-Districts-Reference-Guide.pdf
 */
const INTENSITY: Record<string, number> = {
  // ── Residential ── ordered by units/lot then DU/acre
  'RH-1': 0.10,
  'RH-1(D)': 0.10,
  'RH-1(S)': 0.15,
  'RH-2': 0.30,
  'RH-3': 0.45,
  RED: 0.35,
  'RTO-1': 0.55,
  'RTO-M': 0.55,
  'RM-1': 0.55,
  'RM-2': 0.70,
  'RM-3': 0.85,
  'RM-4': 1.00,
  'RH DTR': 0.95,
  'SB-DTR': 0.95,
  'TB DTR': 0.95,
  'PM-R': 0.55,
  'TI-R': 0.55,
  'YBI-R': 0.55,

  // ── Mixed Use ── neighborhood-commercial / transit / downtown-adjacent
  'NC-1': 0.30,
  'NCT-1': 0.30,
  'NC-S': 0.40,
  NCD: 0.45,
  'NC-2': 0.50,
  'NCT-2': 0.50,
  NCT: 0.60,
  'NC-3': 0.70,
  'NCT-3': 0.75,
  MUG: 0.65,
  MUR: 0.70,
  MUO: 0.75,
  UMU: 0.75,
  WMUG: 0.55,
  WMUO: 0.55,
  CRNC: 0.55,
  'RC-3': 0.55,
  'RC-4': 0.85,
  'RED-MX': 0.45,
  CMUO: 0.95,
  'BR-MU': 0.60,
  'MR-MU': 0.60,
  'TI-MU': 0.55,
  'YBI-MU': 0.55,
  'HP-RA': 0.55,
  'MB-RA': 0.55,
  'PM-MU1': 0.65,
  'PM-MU2': 0.70,
  'S-MU': 0.55,
  SPD: 0.55,

  // ── Commercial ── neighborhood → downtown core
  RCD: 0.30,
  'C-2': 0.35,
  CCB: 0.50,
  CVR: 0.55,
  'RTO-C': 0.55,
  'C-3-S': 0.55,
  'C-3-R': 0.65,
  'C-3-G': 0.80,
  'C-3-O': 0.90,
  'C-3-O(SD)': 1.00,
  'MB-O': 0.85,

  // ── Industrial ── PDR (production / distribution / repair) → heavy
  'PDR-1-B': 0.30,
  'PDR-1-G': 0.40,
  'PDR-1-D': 0.45,
  'PDR-2': 0.55,
  SALI: 0.45,
  'M-1': 0.75,
  'M-2': 1.00,
}

const GEN_FALLBACK = 0.5

export function getZoningIntensity(zoningSim: string | undefined | null): number {
  if (!zoningSim) return GEN_FALLBACK
  return INTENSITY[zoningSim] ?? GEN_FALLBACK
}
