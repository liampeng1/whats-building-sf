/**
 * Transcribed zoning-rule values per SF zoning_sim code. Source-of-truth
 * is the SF Planning Code; every field carries a per-record citation.
 *
 * Transcription is a one-time job. When the Planning Code is amended,
 * re-transcribe the affected sections and bump retrieved_at.
 *
 * Build-time validation in scripts/build-cross-stats.ts verifies that
 * every zoning_sim from DataSF has a matching record here.
 *
 * Schema reference: docs/superpowers/specs/2026-05-10-improvements-design.md §1a
 */

import { type CodeCitation } from './zoning-sources'

export interface DensityRule {
  units_per_lot?: number
  sqft_per_unit?: number
  du_per_acre?: number        // retained for legacy NCT records
  max_units?: number
  cu_pathway?: string
  note?: string
}

export interface ZoningRecord {
  code: string
  name?: string                              // NEW
  classification?: CodeCitation              // NEW (§209.x / §834)
  verified?: boolean                         // NEW — true once transcribed from source

  density: DensityRule
  far?: { max: number; note?: string }                 // deprecated (non-resi only)
  far_non_residential?: { max: number; note?: string } // NEW
  min_lot?: { width_ft: number; area_sqft: number }    // NEW
  open_space_per_unit?: { private_sqft: number; note?: string } // NEW
  principal_uses: string[]
  conditional_uses?: string[]                // NEW
  front_setback_text?: string                // NEW (verbatim)
  rear_yard_text?: string                    // NEW (verbatim)
  dwelling_unit_mix_text?: string            // NEW
  parking_text?: string                      // NEW

  // legacy (deprecated — Phase 2 removes; kept so old records compile)
  parking_min?: { residential?: string; commercial?: string }
  setbacks?: { front_ft?: number; rear_ft?: number; side_ft?: number }
  lot_coverage_max_pct?: number

  source: {
    density: CodeCitation
    far?: CodeCitation
    far_non_residential?: CodeCitation
    min_lot?: CodeCitation
    open_space?: CodeCitation
    principal_uses: CodeCitation
    conditional_uses?: CodeCitation
    front_setback?: CodeCitation
    rear_yard?: CodeCitation
    dwelling_unit_mix?: CodeCitation
    parking?: CodeCitation
    parking_min?: CodeCitation              // legacy alias used by old records
    setbacks?: CodeCitation
    lot_coverage_max_pct?: CodeCitation
    retrieved_at: string
    document?: string
    document_url?: string
  }
}

const AMLEGAL = 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning'

function cite(article: string, section: string): CodeCitation {
  // The amlegal URL fragment for each section is unstable; we link to the
  // article-level page so readers can search by section. Acceptable trade-
  // off: stable links over deep-section anchors that the publisher rewrites.
  const sectionSlug = section.replace(/[§\s]/g, '')
  return {
    article,
    section,
    url: `${AMLEGAL}/0-0-0-${sectionSlug}`,
    quote: '',
  }
}

const RETRIEVED = '2026-05-10'

export const ZONING_RULES: Record<string, ZoningRecord> = {
  'RH-1': {
    code: 'RH-1',
    density: { units_per_lot: 1 },
    far: { max: 1.8, note: 'See §123 for FAR controls' },
    principal_uses: ['Single-family dwelling', 'ADU (state law)'],
    parking_min: {
      residential: '1 space per dwelling (no min near transit per AB-2097)',
    },
    setbacks: { front_ft: 15, rear_ft: 25, side_ft: 0 },
    lot_coverage_max_pct: 45,

    source: {
      density: cite('Article 2', '§209'),
      far: cite('Article 1.2', '§123'),
      principal_uses: cite('Article 2', '§209'),
      parking_min: cite('Article 1.5', '§151.1'),
      setbacks: cite('Article 2', '§132'),
      lot_coverage_max_pct: cite('Article 2', '§209'),
      retrieved_at: RETRIEVED,
    },
  },
  'RH-2': {
    code: 'RH-2',
    density: { units_per_lot: 2 },
    principal_uses: ['Two-family dwelling', 'ADU (state law)'],
    parking_min: {
      residential: '1 space per dwelling (no min near transit per AB-2097)',
    },
    setbacks: { front_ft: 15, rear_ft: 25, side_ft: 0 },
    lot_coverage_max_pct: 45,

    source: {
      density: cite('Article 2', '§209'),
      principal_uses: cite('Article 2', '§209'),
      parking_min: cite('Article 1.5', '§151.1'),
      setbacks: cite('Article 2', '§132'),
      lot_coverage_max_pct: cite('Article 2', '§209'),
      retrieved_at: RETRIEVED,
    },
  },
  'RH-3': {
    code: 'RH-3',
    density: { units_per_lot: 3 },
    principal_uses: ['Three-family dwelling', 'ADU (state law)'],
    parking_min: {
      residential: '1 space per dwelling (no min near transit per AB-2097)',
    },
    setbacks: { front_ft: 15, rear_ft: 25, side_ft: 0 },
    lot_coverage_max_pct: 45,

    source: {
      density: cite('Article 2', '§209'),
      principal_uses: cite('Article 2', '§209'),
      parking_min: cite('Article 1.5', '§151.1'),
      setbacks: cite('Article 2', '§132'),
      lot_coverage_max_pct: cite('Article 2', '§209'),
      retrieved_at: RETRIEVED,
    },
  },
  'NCT-3': {
    code: 'NCT-3',
    density: {
      du_per_acre: 174,
      note: 'Moderate-Scale Neighborhood Commercial Transit District',
    },
    far: { max: 3.6 },
    principal_uses: [
      'Residential',
      'Ground-floor retail / restaurant',
      'Personal service uses',
    ],
    parking_min: {
      residential: '0 (transit-oriented)',
      commercial: '0',
    },
    setbacks: { front_ft: 0, rear_ft: 25 },
    lot_coverage_max_pct: 75,

    source: {
      density: cite('Article 7', '§754'),
      far: cite('Article 1.2', '§124'),
      principal_uses: cite('Article 7', '§754'),
      parking_min: cite('Article 1.5', '§151.1'),
      setbacks: cite('Article 7', '§754'),
      lot_coverage_max_pct: cite('Article 7', '§754'),
      retrieved_at: RETRIEVED,
    },
  },
  'C-3-O': {
    code: 'C-3-O',
    density: { note: 'No specific density cap; controlled by height + FAR' },
    far: { max: 9.0 },
    principal_uses: [
      'Office',
      'Retail',
      'Residential (conditional above 24th floor)',
    ],
    parking_min: {
      commercial: 'Maximum (not minimum) — §151.1',
    },

    source: {
      density: cite('Article 8', '§210.2'),
      far: cite('Article 1.2', '§124'),
      principal_uses: cite('Article 8', '§210.2'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  // ── Mainstream Residential ───────────────────────────────────────────────

  'RM-1': {
    code: 'RM-1',
    density: {
      note: 'One unit per 800 sf of lot area (low-density multi-family)',
    },
    principal_uses: ['Multi-family residential', 'ADU (state law)'],
    parking_min: {
      residential: '1 space per dwelling (no min near transit per AB-2097)',
    },
    setbacks: { front_ft: 15, rear_ft: 25, side_ft: 0 },

    source: {
      density: cite('Article 2', '§209.2'),
      principal_uses: cite('Article 2', '§209.2'),
      parking_min: cite('Article 1.5', '§151.1'),
      setbacks: cite('Article 2', '§132'),
      retrieved_at: RETRIEVED,
    },
  },

  'RC-3': {
    code: 'RC-3',
    density: {
      note: 'One unit per 200 sf of lot area (residential-commercial, high density)',
    },
    principal_uses: [
      'Multi-family residential',
      'Ground-floor retail (permitted)',
      'ADU (state law)',
    ],
    parking_min: {
      residential: '0 (near transit; §151.1)',
      commercial: '0',
    },
    setbacks: { front_ft: 0, rear_ft: 25, side_ft: 0 },

    source: {
      density: cite('Article 2', '§209.3'),
      principal_uses: cite('Article 2', '§209.3'),
      parking_min: cite('Article 1.5', '§151.1'),
      setbacks: cite('Article 2', '§132'),
      retrieved_at: RETRIEVED,
    },
  },

  'RC-4': {
    code: 'RC-4',
    density: {
      note: 'One unit per 125 sf of lot area (residential-commercial, very high density)',
    },
    principal_uses: [
      'Multi-family residential',
      'Ground-floor retail (permitted)',
      'ADU (state law)',
    ],
    parking_min: {
      residential: '0 (near transit; §151.1)',
      commercial: '0',
    },
    setbacks: { front_ft: 0, rear_ft: 25, side_ft: 0 },

    source: {
      density: cite('Article 2', '§209.3'),
      principal_uses: cite('Article 2', '§209.3'),
      parking_min: cite('Article 1.5', '§151.1'),
      setbacks: cite('Article 2', '§132'),
      retrieved_at: RETRIEVED,
    },
  },

  // ── Neighborhood Commercial (NC) family ─────────────────────────────────

  'NC-1': {
    code: 'NC-1',
    density: {
      note: 'Neighborhood Commercial Cluster; density per §710.1 (no numeric cap — height-controlled)',
    },
    principal_uses: [
      'Small-scale retail and personal services',
      'Residential above ground floor',
    ],
    parking_min: {
      residential: '1 space per unit (near transit: 0 per AB-2097)',
      commercial: '0',
    },

    source: {
      density: cite('Article 7', '§710.1'),
      principal_uses: cite('Article 7', '§710.1'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'NC-2': {
    code: 'NC-2',
    density: {
      note: 'Small-Scale Neighborhood Commercial; density per §711.1 (height-controlled)',
    },
    principal_uses: [
      'Small-scale retail and personal services',
      'Residential above ground floor',
    ],
    parking_min: {
      residential: '1 space per unit (near transit: 0 per AB-2097)',
      commercial: '0',
    },

    source: {
      density: cite('Article 7', '§711.1'),
      principal_uses: cite('Article 7', '§711.1'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'NC-3': {
    code: 'NC-3',
    density: {
      note: 'Moderate-Scale Neighborhood Commercial; density per §712.1 (height-controlled)',
    },
    principal_uses: [
      'Retail and personal services',
      'Residential above ground floor',
      'Entertainment (conditional)',
    ],
    parking_min: {
      residential: '1 space per unit (near transit: 0 per AB-2097)',
      commercial: '0',
    },

    source: {
      density: cite('Article 7', '§712.1'),
      principal_uses: cite('Article 7', '§712.1'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'NC-S': {
    code: 'NC-S',
    density: {
      note: 'Neighborhood Commercial Shopping Center; density per §713.1 (height-controlled)',
    },
    principal_uses: [
      'Retail and personal services (shopping-center format)',
      'Residential above ground floor',
    ],
    parking_min: {
      residential: '1 space per unit (near transit: 0 per AB-2097)',
      commercial: 'Per §151.1',
    },

    source: {
      density: cite('Article 7', '§713.1'),
      principal_uses: cite('Article 7', '§713.1'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'NCD': {
    code: 'NCD',
    density: {
      note: 'Neighborhood Commercial District (named district variant); density per §729.1',
    },
    principal_uses: [
      'Retail and personal services',
      'Residential above ground floor',
    ],
    parking_min: {
      residential: '1 space per unit (near transit: 0 per AB-2097)',
      commercial: '0',
    },

    source: {
      density: cite('Article 7', '§729.1'),
      principal_uses: cite('Article 7', '§729.1'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'NCT': {
    code: 'NCT',
    density: {
      note: 'Neighborhood Commercial Transit District (generic); density per §726.1 (height-controlled)',
    },
    principal_uses: [
      'Retail and personal services',
      'Residential above ground floor',
      'Transit-oriented uses',
    ],
    parking_min: {
      residential: '0 (transit-oriented)',
      commercial: '0',
    },

    source: {
      density: cite('Article 7', '§726.1'),
      principal_uses: cite('Article 7', '§726.1'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'NCT-1': {
    code: 'NCT-1',
    density: {
      note: 'Small-Scale Neighborhood Commercial Transit; density per §750 (height-controlled)',
    },
    principal_uses: [
      'Small-scale retail and personal services',
      'Residential above ground floor',
    ],
    parking_min: {
      residential: '0 (transit-oriented)',
      commercial: '0',
    },

    source: {
      density: cite('Article 7', '§750'),
      principal_uses: cite('Article 7', '§750'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'NCT-2': {
    code: 'NCT-2',
    density: {
      note: 'Small-to-Moderate-Scale Neighborhood Commercial Transit; density per §751 (height-controlled)',
    },
    principal_uses: [
      'Retail and personal services',
      'Residential above ground floor',
    ],
    parking_min: {
      residential: '0 (transit-oriented)',
      commercial: '0',
    },

    source: {
      density: cite('Article 7', '§751'),
      principal_uses: cite('Article 7', '§751'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  // ── Commercial C-family ──────────────────────────────────────────────────

  'C-2': {
    code: 'C-2',
    density: { note: 'No specific density cap; FAR-controlled (§124). Residential conditional.' },
    far: { max: 4.8, note: 'Typical C-2 FAR; confirm per §124 for specific district' },
    principal_uses: [
      'Retail',
      'Service commercial',
      'Residential (conditional)',
    ],
    parking_min: {
      commercial: 'Maximum (not minimum) per §151.1',
    },

    source: {
      density: cite('Article 2', '§210.1'),
      far: cite('Article 1.2', '§124'),
      principal_uses: cite('Article 2', '§210.1'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'C-3-G': {
    code: 'C-3-G',
    density: { note: 'No specific density cap; controlled by FAR' },
    far: { max: 9.0, note: 'Downtown C-3 FAR range per §124' },
    principal_uses: [
      'Office',
      'Retail',
      'Entertainment',
      'Residential (conditional)',
    ],
    parking_min: {
      commercial: 'Maximum (not minimum) — §151.1',
    },

    source: {
      density: cite('Article 2', '§210.2'),
      far: cite('Article 1.2', '§124'),
      principal_uses: cite('Article 2', '§210.2'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'C-3-O(SD)': {
    code: 'C-3-O(SD)',
    density: { note: 'No specific density cap; controlled by FAR. Special Downtown subdistrict.' },
    far: { max: 9.0, note: 'Downtown C-3 FAR range per §124' },
    principal_uses: [
      'Office',
      'Retail',
      'Residential (conditional)',
    ],
    parking_min: {
      commercial: 'Maximum (not minimum) — §151.1',
    },

    source: {
      density: cite('Article 2', '§210.2'),
      far: cite('Article 1.2', '§124'),
      principal_uses: cite('Article 2', '§210.2'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'C-3-R': {
    code: 'C-3-R',
    density: { note: 'No specific density cap; controlled by FAR. Downtown Retail subdistrict.' },
    far: { max: 6.0, note: 'C-3-R FAR per §124' },
    principal_uses: [
      'Retail',
      'Entertainment',
      'Office (limited)',
      'Residential (conditional)',
    ],
    parking_min: {
      commercial: 'Maximum (not minimum) — §151.1',
    },

    source: {
      density: cite('Article 2', '§210.2'),
      far: cite('Article 1.2', '§124'),
      principal_uses: cite('Article 2', '§210.2'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'C-3-S': {
    code: 'C-3-S',
    density: { note: 'No specific density cap; controlled by FAR. Downtown Support subdistrict.' },
    far: { max: 4.5, note: 'C-3-S FAR per §124' },
    principal_uses: [
      'Service commercial',
      'Retail',
      'Residential (conditional)',
    ],
    parking_min: {
      commercial: 'Maximum (not minimum) — §151.1',
    },

    source: {
      density: cite('Article 2', '§210.2'),
      far: cite('Article 1.2', '§124'),
      principal_uses: cite('Article 2', '§210.2'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  // ── Industrial / PDR ─────────────────────────────────────────────────────

  'M-1': {
    code: 'M-1',
    density: { note: 'Industrial district — residential uses not permitted (§210.4)' },
    principal_uses: [
      'Light manufacturing',
      'Industrial arts',
      'Warehousing',
      'Service commercial',
    ],
    parking_min: {
      commercial: 'Per §151.1 (vehicle and loading requirements)',
    },

    source: {
      density: cite('Article 2', '§210.4'),
      principal_uses: cite('Article 2', '§210.4'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'M-2': {
    code: 'M-2',
    density: { note: 'Heavy Industrial district — residential uses not permitted (§210.4)' },
    principal_uses: [
      'Heavy manufacturing',
      'Industrial operations',
      'Warehousing',
    ],
    parking_min: {
      commercial: 'Per §151.1 (vehicle and loading requirements)',
    },

    source: {
      density: cite('Article 2', '§210.4'),
      principal_uses: cite('Article 2', '§210.4'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'PDR-1-B': {
    code: 'PDR-1-B',
    density: { note: 'Production, Distribution, and Repair district — residential not permitted (§210.3)' },
    principal_uses: [
      'Production, Distribution, and Repair (PDR)',
      'Light industrial and arts',
    ],
    parking_min: {
      commercial: 'Per §151.1',
    },

    source: {
      density: cite('Article 2', '§210.3'),
      principal_uses: cite('Article 2', '§210.3'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'PDR-1-D': {
    code: 'PDR-1-D',
    density: { note: 'PDR district — residential not permitted (§210.3)' },
    principal_uses: [
      'Production, Distribution, and Repair (PDR)',
      'Design professional and arts',
    ],
    parking_min: {
      commercial: 'Per §151.1',
    },

    source: {
      density: cite('Article 2', '§210.3'),
      principal_uses: cite('Article 2', '§210.3'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'PDR-1-G': {
    code: 'PDR-1-G',
    density: { note: 'PDR district — residential not permitted (§210.3)' },
    principal_uses: [
      'Production, Distribution, and Repair (PDR)',
      'General industrial',
    ],
    parking_min: {
      commercial: 'Per §151.1',
    },

    source: {
      density: cite('Article 2', '§210.3'),
      principal_uses: cite('Article 2', '§210.3'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'PDR-2': {
    code: 'PDR-2',
    density: { note: 'Core PDR district — residential not permitted (§210.3)' },
    principal_uses: [
      'Production, Distribution, and Repair (PDR)',
      'Industrial and manufacturing',
    ],
    parking_min: {
      commercial: 'Per §151.1',
    },

    source: {
      density: cite('Article 2', '§210.3'),
      principal_uses: cite('Article 2', '§210.3'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  // ── Public ───────────────────────────────────────────────────────────────

  'P': {
    code: 'P',
    density: { note: 'Public uses; no residential density controls per §211' },
    principal_uses: [
      'Public and quasi-public facilities',
      'Parks and open space',
      'Civic and institutional uses',
    ],
    parking_min: {
      commercial: 'Per §211 and use-specific controls',
    },

    source: {
      density: cite('Article 2', '§211'),
      principal_uses: cite('Article 2', '§211'),
      parking_min: cite('Article 2', '§211'),
      retrieved_at: RETRIEVED,
    },
  },

  // ── Special / Redevelopment Districts (STUB) ─────────────────────────────

  'BR-MU': {
    code: 'BR-MU',
    density: { note: 'Bayview/Hunters Point Redevelopment SUD; see codesection' },
    principal_uses: ['Mixed-use (per Special Use District controls)'],
    parking_min: { residential: 'See SUD controls' },

    source: {
      density: cite('Special Use District', '§263.35'),
      principal_uses: cite('Special Use District', '§263.35'),
      parking_min: cite('Special Use District', '§263.35'),
      retrieved_at: RETRIEVED,
    },
  },

  'CCB': {
    code: 'CCB',
    density: { note: 'Castro/Upper Market Commercial district; see §810.1 for full controls' },
    principal_uses: ['Mixed commercial and residential (per §810.1)'],
    parking_min: { residential: 'See §810.1' },

    source: {
      density: cite('Article 8', '§810.1'),
      principal_uses: cite('Article 8', '§810.1'),
      parking_min: cite('Article 8', '§810.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'CMUO': {
    code: 'CMUO',
    density: { note: 'Chinatown Mixed Use district; see Article 8 mixed-use controls' },
    principal_uses: ['Mixed commercial and residential (per Chinatown controls)'],
    parking_min: { residential: 'See codesection for full rules' },

    source: {
      density: cite('Article 8', '§842 et seq.'),
      principal_uses: cite('Article 8', '§842 et seq.'),
      parking_min: cite('Article 8', '§842 et seq.'),
      retrieved_at: RETRIEVED,
    },
  },

  'CRNC': {
    code: 'CRNC',
    density: { note: 'Commercial/Residential Neighborhood Commercial district; see §812.1' },
    principal_uses: ['Mixed commercial and residential (per §812.1)'],
    parking_min: { residential: 'See §812.1' },

    source: {
      density: cite('Article 8', '§812.1'),
      principal_uses: cite('Article 8', '§812.1'),
      parking_min: cite('Article 8', '§812.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'CVR': {
    code: 'CVR',
    density: { note: 'Castro Village Commercial district; see §811.1 for full controls' },
    principal_uses: ['Commercial and residential mixed use (per §811.1)'],
    parking_min: { residential: 'See §811.1' },

    source: {
      density: cite('Article 8', '§811.1'),
      principal_uses: cite('Article 8', '§811.1'),
      parking_min: cite('Article 8', '§811.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'HP-RA': {
    code: 'HP-RA',
    density: { note: 'Hunters Point Redevelopment Area; controls per Redevelopment Plan' },
    principal_uses: ['Mixed-use (per Hunters Point Redevelopment Plan)'],
    parking_min: { residential: 'See Redevelopment Plan controls' },

    source: {
      density: cite('Special Use District', '§249.52'),
      principal_uses: cite('Special Use District', '§249.52'),
      parking_min: cite('Special Use District', '§249.52'),
      retrieved_at: RETRIEVED,
    },
  },

  'Job Corps': {
    code: 'Job Corps',
    density: { note: 'Public/institutional use; Job Corps facility per §249.52' },
    principal_uses: ['Public institutional (Job Corps training facility)'],
    parking_min: { commercial: 'See §249.52' },

    source: {
      density: cite('Article 2', '§249.52'),
      principal_uses: cite('Article 2', '§249.52'),
      parking_min: cite('Article 2', '§249.52'),
      retrieved_at: RETRIEVED,
    },
  },

  'MB-O': {
    code: 'MB-O',
    density: { note: 'Mission Bay Office district; see §912 for full controls' },
    principal_uses: ['Office and commercial (per Mission Bay controls §912)'],
    parking_min: { commercial: 'See §912' },

    source: {
      density: cite('Article 9', '§912'),
      principal_uses: cite('Article 9', '§912'),
      parking_min: cite('Article 9', '§912'),
      retrieved_at: RETRIEVED,
    },
  },

  'MB-RA': {
    code: 'MB-RA',
    density: { note: 'Mission Bay Residential/Affordable district; see §902 for full controls' },
    principal_uses: ['Residential and affordable housing (per Mission Bay controls §902)'],
    parking_min: { residential: 'See §902' },

    source: {
      density: cite('Article 9', '§902'),
      principal_uses: cite('Article 9', '§902'),
      parking_min: cite('Article 9', '§902'),
      retrieved_at: RETRIEVED,
    },
  },

  'MR-MU': {
    code: 'MR-MU',
    density: { note: 'Mixed-use Residential district; see §249.80 for full controls' },
    principal_uses: ['Mixed-use residential (per Special Use District §249.80)'],
    parking_min: { residential: 'See §249.80' },

    source: {
      density: cite('Article 2', '§249.80'),
      principal_uses: cite('Article 2', '§249.80'),
      parking_min: cite('Article 2', '§249.80'),
      retrieved_at: RETRIEVED,
    },
  },

  'MUG': {
    code: 'MUG',
    density: { note: 'Mixed Use General district; see §840 for full controls' },
    principal_uses: ['Mixed use — ground-floor commercial, residential above (per §840)'],
    parking_min: { residential: 'See §840' },

    source: {
      density: cite('Article 8', '§840'),
      principal_uses: cite('Article 8', '§840'),
      parking_min: cite('Article 8', '§840'),
      retrieved_at: RETRIEVED,
    },
  },

  'MUO': {
    code: 'MUO',
    density: { note: 'Mixed Use Office district; see §842 for full controls' },
    principal_uses: ['Mixed use office and residential (per §842)'],
    parking_min: { commercial: 'See §842' },

    source: {
      density: cite('Article 8', '§842'),
      principal_uses: cite('Article 8', '§842'),
      parking_min: cite('Article 8', '§842'),
      retrieved_at: RETRIEVED,
    },
  },

  'MUR': {
    code: 'MUR',
    density: { note: 'Mixed Use Residential district; see §842 for full controls' },
    principal_uses: ['Mixed use residential and commercial (per §842)'],
    parking_min: { residential: 'See §842' },

    source: {
      density: cite('Article 8', '§842'),
      principal_uses: cite('Article 8', '§842'),
      parking_min: cite('Article 8', '§842'),
      retrieved_at: RETRIEVED,
    },
  },

  'P70-MU': {
    code: 'P70-MU',
    density: { note: 'Public 70% Mixed Use district; see §249.79 for full controls' },
    principal_uses: ['Mixed use (per Special Use District §249.79)'],
    parking_min: { residential: 'See §249.79' },

    source: {
      density: cite('Article 2', '§249.79'),
      principal_uses: cite('Article 2', '§249.79'),
      parking_min: cite('Article 2', '§249.79'),
      retrieved_at: RETRIEVED,
    },
  },

  'PM-CF': {
    code: 'PM-CF',
    density: { note: 'Parkmerced Community Facilities subdistrict; see §249.64' },
    principal_uses: ['Community facilities and public uses (per §249.64)'],
    parking_min: { commercial: 'See §249.64' },

    source: {
      density: cite('Article 2', '§249.64'),
      principal_uses: cite('Article 2', '§249.64'),
      parking_min: cite('Article 2', '§249.64'),
      retrieved_at: RETRIEVED,
    },
  },

  'PM-MU1': {
    code: 'PM-MU1',
    density: { note: 'Parkmerced Mixed Use 1 subdistrict; see §249.64' },
    principal_uses: ['Mixed use residential and commercial (per §249.64)'],
    parking_min: { residential: 'See §249.64' },

    source: {
      density: cite('Article 2', '§249.64'),
      principal_uses: cite('Article 2', '§249.64'),
      parking_min: cite('Article 2', '§249.64'),
      retrieved_at: RETRIEVED,
    },
  },

  'PM-MU2': {
    code: 'PM-MU2',
    density: { note: 'Parkmerced Mixed Use 2 subdistrict; see §249.64' },
    principal_uses: ['Mixed use residential and commercial (per §249.64)'],
    parking_min: { residential: 'See §249.64' },

    source: {
      density: cite('Article 2', '§249.64'),
      principal_uses: cite('Article 2', '§249.64'),
      parking_min: cite('Article 2', '§249.64'),
      retrieved_at: RETRIEVED,
    },
  },

  'PM-OS': {
    code: 'PM-OS',
    density: { note: 'Parkmerced Open Space subdistrict; see §249.64' },
    principal_uses: ['Open space and parks (per §249.64)'],
    parking_min: { commercial: 'See §249.64' },

    source: {
      density: cite('Article 2', '§249.64'),
      principal_uses: cite('Article 2', '§249.64'),
      parking_min: cite('Article 2', '§249.64'),
      retrieved_at: RETRIEVED,
    },
  },

  'PM-R': {
    code: 'PM-R',
    density: { note: 'Parkmerced Residential subdistrict; see §249.64' },
    principal_uses: ['Residential (per §249.64)'],
    parking_min: { residential: 'See §249.64' },

    source: {
      density: cite('Article 2', '§249.64'),
      principal_uses: cite('Article 2', '§249.64'),
      parking_min: cite('Article 2', '§249.64'),
      retrieved_at: RETRIEVED,
    },
  },

  'PM-S': {
    code: 'PM-S',
    density: { note: 'Parkmerced Support/Service subdistrict; see §249.64' },
    principal_uses: ['Support services and civic uses (per §249.64)'],
    parking_min: { commercial: 'See §249.64' },

    source: {
      density: cite('Article 2', '§249.64'),
      principal_uses: cite('Article 2', '§249.64'),
      parking_min: cite('Article 2', '§249.64'),
      retrieved_at: RETRIEVED,
    },
  },

  'PPS-MU': {
    code: 'PPS-MU',
    density: { note: 'Potrero/Showplace Square Mixed Use; see §249.87 for full controls' },
    principal_uses: ['Mixed use (per Special Use District §249.87)'],
    parking_min: { residential: 'See §249.87' },

    source: {
      density: cite('Article 2', '§249.87'),
      principal_uses: cite('Article 2', '§249.87'),
      parking_min: cite('Article 2', '§249.87'),
      retrieved_at: RETRIEVED,
    },
  },

  'RCD': {
    code: 'RCD',
    density: { note: 'Residential/Commercial District (named); see §758 for full controls' },
    principal_uses: ['Residential and commercial mixed use (per §758)'],
    parking_min: { residential: 'See §758' },

    source: {
      density: cite('Article 7', '§758'),
      principal_uses: cite('Article 7', '§758'),
      parking_min: cite('Article 7', '§758'),
      retrieved_at: RETRIEVED,
    },
  },

  'RED': {
    code: 'RED',
    density: { note: 'Residential Enclave District; see §813 for full controls' },
    principal_uses: ['Residential uses (per §813)'],
    parking_min: { residential: 'See §813' },

    source: {
      density: cite('Article 8', '§813'),
      principal_uses: cite('Article 8', '§813'),
      parking_min: cite('Article 8', '§813'),
      retrieved_at: RETRIEVED,
    },
  },

  'RED-MX': {
    code: 'RED-MX',
    density: { note: 'Residential Enclave District (Mixed); see §813 for full controls' },
    principal_uses: ['Residential with limited mixed use (per §813)'],
    parking_min: { residential: 'See §813' },

    source: {
      density: cite('Article 8', '§813'),
      principal_uses: cite('Article 8', '§813'),
      parking_min: cite('Article 8', '§813'),
      retrieved_at: RETRIEVED,
    },
  },

  'RTO-C': {
    code: 'RTO-C',
    density: { note: 'Residential Transit-Oriented Commercial district; see Article 8 controls' },
    principal_uses: ['Residential and ground-floor commercial (transit-oriented)'],
    parking_min: { residential: '0 (transit-oriented)' },

    source: {
      density: cite('Article 8', '§842 et seq.'),
      principal_uses: cite('Article 8', '§842 et seq.'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },

  'WMUG': {
    code: 'WMUG',
    density: { note: 'Western SoMa Mixed Use General district; see §844 for full controls' },
    principal_uses: ['Mixed use general (per §844)'],
    parking_min: { residential: 'See §844' },

    source: {
      density: cite('Article 8', '§844'),
      principal_uses: cite('Article 8', '§844'),
      parking_min: cite('Article 8', '§844'),
      retrieved_at: RETRIEVED,
    },
  },
}

export function getZoningRecord(code: string): ZoningRecord | undefined {
  return ZONING_RULES[code]
}
