/**
 * California state housing-law eligibility for SF zoning districts.
 * Encoded as logic, not transcribed data — citations to CA Government
 * Code in comments below.
 *
 *   SB-9          Gov. Code §§ 65852.21, 66411.7
 *                 Duplex by-right + lot split in single-family zones.
 *
 *   AB-2011       Gov. Code §§ 65912.110-65912.124
 *                 By-right residential on commercial corridors meeting
 *                 affordability + density floors.
 *
 *   SB-35         Gov. Code § 65913.4
 *                 Streamlined ministerial review where the jurisdiction
 *                 is below RHNA targets. SF qualifies for every RHNA
 *                 cycle on record, so we apply uniformly to eligible
 *                 residential / mixed-use districts.
 *
 *   Density Bonus Gov. Code § 65915
 *                 Unit increase + concessions in exchange for affordable
 *                 set-asides. Available in any residential or mixed-use
 *                 district where multi-family is permitted.
 *
 *   ADU           Gov. Code §§ 65852.2, 65852.22
 *                 Up to 2 accessory dwelling units per residential lot.
 */

import type { Permit } from './types'
import { netDelta } from './permit-style'

export type FamilyLaw = 'SB-9' | 'AB-2011' | 'SB-35' | 'density-bonus' | 'ADU'

export interface FamilyLawEligibility {
  law: FamilyLaw
  uplift_summary: string
}

const RESIDENTIAL_OR_MIXED = new Set(['Residential', 'Mixed Use'])
const COMMERCIAL_OR_MIXED = new Set(['Commercial', 'Mixed Use'])

export function eligibleLaws(zoningSim: string, gen: string): FamilyLawEligibility[] {
  const out: FamilyLawEligibility[] = []

  if (gen === 'Residential' && zoningSim === 'RH-1') {
    out.push({
      law: 'SB-9',
      uplift_summary: '1 unit baseline → up to 4 units via lot split + duplex + ADU',
    })
  }

  if (COMMERCIAL_OR_MIXED.has(gen)) {
    out.push({
      law: 'AB-2011',
      uplift_summary: 'By-right residential on eligible commercial corridors',
    })
  }

  if (RESIDENTIAL_OR_MIXED.has(gen)) {
    out.push({
      law: 'SB-35',
      uplift_summary: 'Streamlined ministerial review when affordability targets met',
    })
    out.push({
      law: 'density-bonus',
      uplift_summary: 'Up to 50% unit increase in exchange for affordable units',
    })
  }

  if (gen === 'Residential') {
    out.push({
      law: 'ADU',
      uplift_summary: 'Up to 2 ADUs per lot allowed by state law',
    })
  }

  return out
}

export interface PermitLawFlag {
  law: FamilyLaw
  confidence: 'likely' | 'possible'
  reason: string
}

/** Best-effort permit-level heuristic. Returns one flag per *eligible* law
 *  in the permit's district; the `confidence` differentiates flags that
 *  the permit narrative or unit counts actively suggest vs. eligible-but-
 *  unsignaled. */
export function permitLawHeuristic(permit: Permit, zoningSim: string | null): PermitLawFlag[] {
  if (!zoningSim) return []

  const gen = inferGenFromCode(zoningSim)
  const possible = eligibleLaws(zoningSim, gen)
  if (possible.length === 0) return []

  const delta = netDelta(permit.existing_units, permit.proposed_units)
  const useText = `${permit.proposed_use ?? ''} ${permit.existing_use ?? ''}`.toLowerCase()

  return possible.map(({ law }) => {
    let confidence: 'likely' | 'possible' = 'possible'
    let reason = `${zoningSim} is eligible for ${law}`

    switch (law) {
      case 'SB-9':
        if (zoningSim === 'RH-1' && delta != null && delta >= 1 && delta <= 3) {
          confidence = 'likely'
          reason = `RH-1 lot with +${delta} units fits SB-9 (lot split or duplex)`
        }
        break
      case 'ADU':
        if (/\baccessory dwelling|\badu\b/.test(useText)) {
          confidence = 'likely'
          reason = 'Permit description mentions ADU'
        }
        break
      case 'AB-2011':
        if (COMMERCIAL_OR_MIXED.has(gen) && /residential/.test(useText) && delta != null && delta > 0) {
          confidence = 'likely'
          reason = `Commercial zoning + new residential units suggests AB-2011`
        }
        break
      case 'density-bonus':
        if (/density.bonus|state.density/.test(useText)) {
          confidence = 'likely'
          reason = 'Permit description mentions density bonus'
        }
        break
      case 'SB-35':
        // SB-35 use is rarely explicit on the permit text; stay at possible.
        break
    }

    return { law, confidence, reason }
  })
}

/** Coarse gen mapping from zoning_sim prefix. The runtime authoritative
 *  source for gen is DataSF's `gen` field on each polygon — this is a
 *  pure-text fallback used by the heuristic when only the code is known. */
function inferGenFromCode(code: string): string {
  if (/^RH|^RM|^RTO|^RC/.test(code)) return 'Residential'
  if (/^NC|^MUR|^MUO|^MUG/.test(code)) return 'Mixed Use'
  if (/^C-/.test(code)) return 'Commercial'
  if (/^PDR|^M-/.test(code)) return 'Industrial'
  if (/^P\b/.test(code)) return 'Public'
  return 'Other'
}
