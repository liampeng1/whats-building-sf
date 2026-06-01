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

import { type CodeCitation, sourced } from './zoning-sources'

export interface DensityRule {
  units_per_lot?: number
  sqft_per_unit?: number
  du_per_acre?: number        // retained for legacy NCT records
  max_units?: number
  cu_pathway?: string
  model?: 'form-based' | 'unit-based'  // Mixed-Use: form-based = envelope-governed, no DU/lot cap
  note?: string
}

export interface ZoningRecord {
  code: string
  name?: string                              // NEW
  classification?: CodeCitation              // NEW (§209.x / §834)
  verified?: boolean                         // NEW — true once transcribed from source

  density: DensityRule
  far?: { max: number; note?: string }                 // deprecated (non-resi only)
  far_non_residential?: { max?: number; banded?: string; basis?: string; note?: string } // NEW (banded = height-keyed FAR ramp; basis = e.g. "per §124, by height district")
  min_lot?: { width_ft: number; area_sqft: number }    // NEW
  open_space_per_unit?: { private_sqft: number; note?: string } // NEW
  principal_uses: string[]
  conditional_uses?: string[]                // NEW
  front_setback_text?: string                // NEW (verbatim)
  rear_yard_text?: string                    // NEW (verbatim)
  dwelling_unit_mix_text?: string            // NEW
  parking_text?: string                      // NEW
  controls_note?: string                     // use-only districts (e.g. P) with no FAR/density/open-space scalars

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
  // ── Verified residential records (transcribed verbatim from the SF Planning
  //    "Summary of Planning Code Standards for Residential Districts", rev.
  //    09/2008). Citation sections use the CURRENT code (§209.x / §834), not the
  //    stale 2008 §206.x / §813 numbers. ────────────────────────────────────────

  'RH-1(D)': {
    code: 'RH-1(D)',
    name: 'House, One-Family (Detached Dwellings)',
    classification: sourced('§209.1', 'RH (RESIDENTIAL, HOUSE) DISTRICTS'),
    verified: true,
    density: { units_per_lot: 1 },
    far_non_residential: { max: 1.8 },
    min_lot: { width_ft: 33, area_sqft: 4000 },
    open_space_per_unit: { private_sqft: 300 },
    // Shared use columns: principal uses common to RH-1(D) through RM-4.
    principal_uses: [
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
    ],
    conditional_uses: [
      'Medical institution',
      'Residential care facility for 7 or more',
      'Child care facility for 13 or more',
      'Elementary school',
      'Secondary school',
      'Religious institution',
      'Community facility',
      'Open recreation area',
      'Greenhouse or plant nursery',
      'Utility installation or public service facility',
      'Community garage',
      'Access driveway to C or M district',
      'Non-accessory parking for a specific use',
      'Planned Unit Development',
      'C2 use in structure on designated landmark site',
    ],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '25% of lot depth, but no less than 15 feet.',
    source: {
      density: sourced('§207', 'One dwelling unit per lot.'),
      far_non_residential: sourced('§124', '1.8 times lot area'),
      min_lot: sourced('§121', 'Width: 33 ft.; Area: 4000 sq.ft.'),
      open_space: sourced('§135', '300 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Residential care facility for 6 or fewer; child care facility for 12 or fewer; open space for horticulture or passive recreation; public structure or use of non-industrial character; sale or lease sign.'),
      conditional_uses: sourced('§§209–209.9', 'Medical institution; residential care facility for 7 or more; child care facility for 13 or more; elementary school; secondary school; religious institution; community facility; open recreation area; greenhouse or plant nursery; utility installation or public service facility; community garage; access driveway to C or M district; non-accessory parking for a specific use; Planned Unit Development; C2 use in structure on designated landmark site.'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '25% of lot depth, but no less than 15 feet.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RH-1': {
    code: 'RH-1',
    name: 'House, One-Family',
    classification: sourced('§209.1', 'RH (RESIDENTIAL, HOUSE) DISTRICTS'),
    verified: true,
    density: { units_per_lot: 1, sqft_per_unit: 3000, max_units: 3, cu_pathway: 'with conditional use approval' },
    far_non_residential: { max: 1.8 },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 300 },
    principal_uses: [
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
    ],
    conditional_uses: [
      'Medical institution',
      'Residential care facility for 7 or more',
      'Child care facility for 13 or more',
      'Elementary school',
      'Secondary school',
      'Religious institution',
      'Community facility',
      'Open recreation area',
      'Greenhouse or plant nursery',
      'Utility installation or public service facility',
      'Community garage',
      'Access driveway to C or M district',
      'Non-accessory parking for a specific use',
      'Planned Unit Development',
      'C2 use in structure on designated landmark site',
    ],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '25% of lot depth, but no less than 15 feet.',
    source: {
      density: sourced('§207', 'One dwelling unit per lot; up to one unit per 3000 sq.ft. of lot area (maximum of 3 units) with conditional use approval.'),
      far_non_residential: sourced('§124', '1.8 times lot area'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '300 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Residential care facility for 6 or fewer; child care facility for 12 or fewer; open space for horticulture or passive recreation; public structure or use of non-industrial character; sale or lease sign.'),
      conditional_uses: sourced('§§209–209.9', 'Medical institution; residential care facility for 7 or more; child care facility for 13 or more; elementary school; secondary school; religious institution; community facility; open recreation area; greenhouse or plant nursery; utility installation or public service facility; community garage; access driveway to C or M district; non-accessory parking for a specific use; Planned Unit Development; C2 use in structure on designated landmark site.'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '25% of lot depth, but no less than 15 feet.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RH-1(S)': {
    code: 'RH-1(S)',
    name: 'House, One-Family with Minor Second Unit',
    classification: sourced('§209.1', 'RH (RESIDENTIAL, HOUSE) DISTRICTS'),
    verified: true,
    density: { units_per_lot: 1, note: 'Same as RH-1; or 2 dwelling units per lot with second unit limited to 600 sq.ft. of net floor area.' },
    far_non_residential: { max: 1.8 },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 300, note: '300 sq.ft. for first unit and 100 sq.ft. for second minor unit, if all private; common space substituted must be 1/3 greater.' },
    principal_uses: [
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
    ],
    conditional_uses: [
      'Medical institution',
      'Residential care facility for 7 or more',
      'Child care facility for 13 or more',
      'Elementary school',
      'Secondary school',
      'Religious institution',
      'Community facility',
      'Open recreation area',
      'Greenhouse or plant nursery',
      'Utility installation or public service facility',
      'Community garage',
      'Access driveway to C or M district',
      'Non-accessory parking for a specific use',
      'Planned Unit Development',
      'C2 use in structure on designated landmark site',
    ],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '25% of lot depth, but no less than 15 feet.',
    source: {
      density: sourced('§207', 'Same as RH-1; or 2 dwelling units per lot with second unit limited to 600 sq.ft. of net floor area.'),
      far_non_residential: sourced('§124', '1.8 times lot area'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '300 sq.ft. for first unit and 100 sq.ft. for second minor unit, if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Residential care facility for 6 or fewer; child care facility for 12 or fewer; open space for horticulture or passive recreation; public structure or use of non-industrial character; sale or lease sign.'),
      conditional_uses: sourced('§§209–209.9', 'Medical institution; residential care facility for 7 or more; child care facility for 13 or more; elementary school; secondary school; religious institution; community facility; open recreation area; greenhouse or plant nursery; utility installation or public service facility; community garage; access driveway to C or M district; non-accessory parking for a specific use; Planned Unit Development; C2 use in structure on designated landmark site.'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '25% of lot depth, but no less than 15 feet.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RH-2': {
    code: 'RH-2',
    name: 'House, Two-Family',
    classification: sourced('§209.1', 'RH (RESIDENTIAL, HOUSE) DISTRICTS'),
    verified: true,
    density: { units_per_lot: 2, sqft_per_unit: 1500, cu_pathway: 'with conditional use approval' },
    far_non_residential: { max: 1.8 },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 125 },
    principal_uses: [
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
    ],
    // Conditional uses for RH-2 build on the RH-1 set ("Same uses as above, plus: …").
    conditional_uses: [
      'Medical institution',
      'Residential care facility for 7 or more',
      'Child care facility for 13 or more',
      'Elementary school',
      'Secondary school',
      'Religious institution',
      'Community facility',
      'Open recreation area',
      'Greenhouse or plant nursery',
      'Utility installation or public service facility',
      'Community garage',
      'Access driveway to C or M district',
      'Non-accessory parking for a specific use',
      'Planned Unit Development',
      'C2 use in structure on designated landmark site',
      'Group housing, boarding',
      'Group housing, religious orders',
      'Group housing, medical and educational institutions',
      'Hotel up to 5 rooms',
    ],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.',
    source: {
      density: sourced('§207', 'Two dwelling units per lot; up to one unit per 1500 sq.ft. of lot area with conditional use approval.'),
      far_non_residential: sourced('§124', '1.8 times lot area'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '125 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Residential care facility for 6 or fewer; child care facility for 12 or fewer; open space for horticulture or passive recreation; public structure or use of non-industrial character; sale or lease sign.'),
      conditional_uses: sourced('§§209–209.9', 'Same uses as above, plus: Group housing, boarding; group housing, religious orders; group housing, medical and educational institutions; hotel up to 5 rooms.'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RH-3': {
    code: 'RH-3',
    name: 'House, Three-Family',
    classification: sourced('§209.1', 'RH (RESIDENTIAL, HOUSE) DISTRICTS'),
    verified: true,
    density: { units_per_lot: 3, sqft_per_unit: 1000, cu_pathway: 'with conditional use approval' },
    far_non_residential: { max: 1.8 },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 100 },
    principal_uses: [
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
    ],
    // RH-3 shares the RH-2 conditional-use column ("Same uses as above, plus: …").
    conditional_uses: [
      'Medical institution',
      'Residential care facility for 7 or more',
      'Child care facility for 13 or more',
      'Elementary school',
      'Secondary school',
      'Religious institution',
      'Community facility',
      'Open recreation area',
      'Greenhouse or plant nursery',
      'Utility installation or public service facility',
      'Community garage',
      'Access driveway to C or M district',
      'Non-accessory parking for a specific use',
      'Planned Unit Development',
      'C2 use in structure on designated landmark site',
      'Group housing, boarding',
      'Group housing, religious orders',
      'Group housing, medical and educational institutions',
      'Hotel up to 5 rooms',
    ],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.',
    source: {
      density: sourced('§207', 'Three dwelling units per lot; up to one unit per 1000 sq.ft. of lot area with conditional use approval.'),
      far_non_residential: sourced('§124', '1.8 times lot area'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '100 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Residential care facility for 6 or fewer; child care facility for 12 or fewer; open space for horticulture or passive recreation; public structure or use of non-industrial character; sale or lease sign.'),
      conditional_uses: sourced('§§209–209.9', 'Same uses as above, plus: Group housing, boarding; group housing, religious orders; group housing, medical and educational institutions; hotel up to 5 rooms.'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
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
  // ── Mainstream Residential ───────────────────────────────────────────────

  'RM-1': {
    code: 'RM-1',
    name: 'Mixed (Apartments and Houses), Low Density',
    classification: sourced('§209.2', 'RM (RESIDENTIAL, MIXED) DISTRICTS'),
    verified: true,
    density: { units_per_lot: 3, sqft_per_unit: 800 },
    far_non_residential: { max: 1.8 },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 100 },
    // RM principal uses: shared RH set plus group-housing additions.
    principal_uses: [
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
      'Group housing, boarding',
      'Group housing, religious orders',
    ],
    // RM-1 shares the RH-2 conditional-use column ("Same uses as above, plus: …").
    conditional_uses: [
      'Medical institution',
      'Residential care facility for 7 or more',
      'Child care facility for 13 or more',
      'Elementary school',
      'Secondary school',
      'Religious institution',
      'Community facility',
      'Open recreation area',
      'Greenhouse or plant nursery',
      'Utility installation or public service facility',
      'Community garage',
      'Access driveway to C or M district',
      'Non-accessory parking for a specific use',
      'Planned Unit Development',
      'C2 use in structure on designated landmark site',
      'Group housing, boarding',
      'Group housing, religious orders',
      'Group housing, medical and educational institutions',
      'Hotel up to 5 rooms',
    ],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.',
    source: {
      density: sourced('§207', 'Three dwelling units per lot or one dwelling unit per 800 sq.ft. of lot area'),
      far_non_residential: sourced('§124', '1.8 times lot area'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '100 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Same uses as above, plus: Group housing, boarding; group housing, religious orders.'),
      conditional_uses: sourced('§§209–209.9', 'Same uses as above, plus: Group housing, boarding; group housing, religious orders; group housing, medical and educational institutions; hotel up to 5 rooms.'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RM-2': {
    code: 'RM-2',
    name: 'Mixed (Apartments and Houses), Moderate Density',
    classification: sourced('§209.2', 'RM (RESIDENTIAL, MIXED) DISTRICTS'),
    verified: true,
    density: { units_per_lot: 3, sqft_per_unit: 600 },
    far_non_residential: { max: 1.8 },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 80 },
    principal_uses: [
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
      'Group housing, boarding',
      'Group housing, religious orders',
    ],
    // RM-2 shares the RH-2 conditional-use column ("Same uses as above, plus: …").
    conditional_uses: [
      'Medical institution',
      'Residential care facility for 7 or more',
      'Child care facility for 13 or more',
      'Elementary school',
      'Secondary school',
      'Religious institution',
      'Community facility',
      'Open recreation area',
      'Greenhouse or plant nursery',
      'Utility installation or public service facility',
      'Community garage',
      'Access driveway to C or M district',
      'Non-accessory parking for a specific use',
      'Planned Unit Development',
      'C2 use in structure on designated landmark site',
      'Group housing, boarding',
      'Group housing, religious orders',
      'Group housing, medical and educational institutions',
      'Hotel up to 5 rooms',
    ],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.',
    source: {
      density: sourced('§207', 'Three dwelling units per lot or one dwelling unit per 600 sq.ft. of lot area'),
      far_non_residential: sourced('§124', '1.8 times lot area'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '80 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Same uses as above, plus: Group housing, boarding; group housing, religious orders.'),
      conditional_uses: sourced('§§209–209.9', 'Same uses as above, plus: Group housing, boarding; group housing, religious orders; group housing, medical and educational institutions; hotel up to 5 rooms.'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RM-3': {
    code: 'RM-3',
    name: 'Mixed (Apartments and Houses), Medium Density',
    classification: sourced('§209.2', 'RM (RESIDENTIAL, MIXED) DISTRICTS'),
    verified: true,
    density: { units_per_lot: 3, sqft_per_unit: 400 },
    far_non_residential: { max: 3.6 },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 60 },
    principal_uses: [
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
      'Group housing, boarding',
      'Group housing, religious orders',
    ],
    // RM-3 conditional uses: "Same uses as above, excluding those listed in
    // previous column as principal uses" (i.e. the RM-1/RM-2 conditional set
    // minus the group-housing items now permitted as principal uses).
    conditional_uses: [
      'Medical institution',
      'Residential care facility for 7 or more',
      'Child care facility for 13 or more',
      'Elementary school',
      'Secondary school',
      'Religious institution',
      'Community facility',
      'Open recreation area',
      'Greenhouse or plant nursery',
      'Utility installation or public service facility',
      'Community garage',
      'Access driveway to C or M district',
      'Non-accessory parking for a specific use',
      'Planned Unit Development',
      'C2 use in structure on designated landmark site',
      'Group housing, medical and educational institutions',
      'Hotel up to 5 rooms',
    ],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '25% of lot depth, but no less than 15 feet.',
    source: {
      density: sourced('§207', 'Three dwelling units per lot or one dwelling unit per 400 sq.ft. of lot area'),
      far_non_residential: sourced('§124', '3.6 times lot area'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '60 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Same uses as above, plus: Group housing, boarding; group housing, religious orders.'),
      conditional_uses: sourced('§§209–209.9', 'Same uses as above, excluding those listed in previous column as principal uses.'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '25% of lot depth, but no less than 15 feet.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RM-4': {
    code: 'RM-4',
    name: 'Mixed (Apartments and Houses), High Density',
    classification: sourced('§209.2', 'RM (RESIDENTIAL, MIXED) DISTRICTS'),
    verified: true,
    density: { units_per_lot: 3, sqft_per_unit: 200 },
    far_non_residential: { max: 4.8 },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 36 },
    principal_uses: [
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
      'Group housing, boarding',
      'Group housing, religious orders',
    ],
    // RM-4 shares the RM-3 conditional-use column ("Same uses as above, excluding
    // those listed in previous column as principal uses").
    conditional_uses: [
      'Medical institution',
      'Residential care facility for 7 or more',
      'Child care facility for 13 or more',
      'Elementary school',
      'Secondary school',
      'Religious institution',
      'Community facility',
      'Open recreation area',
      'Greenhouse or plant nursery',
      'Utility installation or public service facility',
      'Community garage',
      'Access driveway to C or M district',
      'Non-accessory parking for a specific use',
      'Planned Unit Development',
      'C2 use in structure on designated landmark site',
      'Group housing, medical and educational institutions',
      'Hotel up to 5 rooms',
    ],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '25% of lot depth, but no less than 15 feet.',
    source: {
      density: sourced('§207', 'Three dwelling units per lot or one dwelling unit per 200 sq.ft. of lot area'),
      far_non_residential: sourced('§124', '4.8 times lot area'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '36 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Same uses as above, plus: Group housing, boarding; group housing, religious orders.'),
      conditional_uses: sourced('§§209–209.9', 'Same uses as above, excluding those listed in previous column as principal uses.'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '25% of lot depth, but no less than 15 feet.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RC-3': {
    code: 'RC-3',
    name: 'Residential-Commercial Combined, Medium Density',
    classification: sourced('§209.3', 'RC (RESIDENTIAL-COMMERCIAL) DISTRICTS'),
    verified: true,
    density: { units_per_lot: 3, sqft_per_unit: 400 },
    far_non_residential: { max: 3.6 },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 60 },
    // RC principal uses: RM set plus the additions listed for RC-3/RC-4.
    principal_uses: [
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
      'Group housing, boarding',
      'Group housing, religious orders',
      'Hotel up to 5 rooms',
      'Open recreation area',
      'Access driveway to C or M district',
      'In or below ground story: philanthropic facility',
      'In or below ground story: childcare facility for 13 or more',
      'In or below ground story: elementary school',
      'In or below ground story: secondary school',
      'In or below ground story: religious institution',
      'In or below ground story: community facility',
      'In or below ground story: private recreation facility',
      'In or below ground story: greenhouse or plant nursery',
      'Any C-2-zoned commercial establishment',
    ],
    conditional_uses: [
      'Medical institution',
      'Residential care facility for 7 or more',
      'Child care facility for 13 or more',
      'Elementary school',
      'Secondary school',
      'Religious institution',
      'Community facility',
      'Greenhouse or plant nursery',
      'Utility installation or public service facility',
      'Community garage',
      'Non-accessory parking for a specific use',
      'Planned Unit Development',
      'C2 use in structure on designated landmark site',
      'Group housing, medical and educational institutions',
      'Hotel of 6 or more rooms',
      'Uses restricted in previous column to location in or below ground story, if located above ground story',
      'C-2-zoned commercial establishment above ground story',
    ],
    front_setback_text: 'No requirement.',
    rear_yard_text: '25% of lot depth, but no less than 15 feet. (at dwellings levels only)',
    source: {
      density: sourced('§207', 'Three dwelling units per lot or one dwelling unit per 400 sq.ft. of lot area'),
      far_non_residential: sourced('§124', '3.6 times lot area'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '60 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Same uses as above, plus: Hotel up to 5 rooms, open recreation area; access driveway to C or M district; The following uses in or below the ground story: philanthropic facility; childcare facility for 13 or more; elementary school; secondary school; religious institution; community facility; private recreation facility; greenhouse or plant nursery; plus any C-2-zoned commercial establishment.'),
      conditional_uses: sourced('§§209–209.9', 'Same uses as above, excluding those listed in previous column as principal uses, plus: Hotel or 6 or more rooms; uses restricted in previous column to location in or below ground story, if located above ground story; plus C-2-zoned commercial establishment above ground story.'),
      front_setback: sourced('§132', 'No requirement.'),
      rear_yard: sourced('§134', '25% of lot depth, but no less than 15 feet. (at dwellings levels only)'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RC-4': {
    code: 'RC-4',
    name: 'Residential-Commercial Combined, High Density',
    classification: sourced('§209.3', 'RC (RESIDENTIAL-COMMERCIAL) DISTRICTS'),
    verified: true,
    density: { units_per_lot: 3, sqft_per_unit: 200 },
    far_non_residential: { max: 4.8 },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 36 },
    principal_uses: [
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
      'Group housing, boarding',
      'Group housing, religious orders',
      'Hotel up to 5 rooms',
      'Open recreation area',
      'Access driveway to C or M district',
      'In or below ground story: philanthropic facility',
      'In or below ground story: childcare facility for 13 or more',
      'In or below ground story: elementary school',
      'In or below ground story: secondary school',
      'In or below ground story: religious institution',
      'In or below ground story: community facility',
      'In or below ground story: private recreation facility',
      'In or below ground story: greenhouse or plant nursery',
      'Any C-2-zoned commercial establishment',
    ],
    conditional_uses: [
      'Medical institution',
      'Residential care facility for 7 or more',
      'Child care facility for 13 or more',
      'Elementary school',
      'Secondary school',
      'Religious institution',
      'Community facility',
      'Greenhouse or plant nursery',
      'Utility installation or public service facility',
      'Community garage',
      'Non-accessory parking for a specific use',
      'Planned Unit Development',
      'C2 use in structure on designated landmark site',
      'Group housing, medical and educational institutions',
      'Hotel of 6 or more rooms',
      'Uses restricted in previous column to location in or below ground story, if located above ground story',
      'C-2-zoned commercial establishment above ground story',
    ],
    front_setback_text: 'No requirement.',
    rear_yard_text: '25% of lot depth, but no less than 15 feet. (at dwellings levels only)',
    source: {
      density: sourced('§207', 'Three dwelling units per lot or one dwelling unit per 200 sq.ft. of lot area'),
      far_non_residential: sourced('§124', '4.8 times lot area'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '36 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Same uses as above, plus: Hotel up to 5 rooms, open recreation area; access driveway to C or M district; The following uses in or below the ground story: philanthropic facility; childcare facility for 13 or more; elementary school; secondary school; religious institution; community facility; private recreation facility; greenhouse or plant nursery; plus any C-2-zoned commercial establishment.'),
      conditional_uses: sourced('§§209–209.9', 'Same uses as above, excluding those listed in previous column as principal uses, plus: Hotel or 6 or more rooms; uses restricted in previous column to location in or below ground story, if located above ground story; plus C-2-zoned commercial establishment above ground story.'),
      front_setback: sourced('§132', 'No requirement.'),
      rear_yard: sourced('§134', '25% of lot depth, but no less than 15 feet. (at dwellings levels only)'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
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

  // ── Commercial C-family (verified — transcribed verbatim from Article 2
  //    Zoning Control Tables §210.1 (C-2) / §210.2 (C-3) and Table 124 (FAR),
  //    amlegal "latest", retrieved 2026-05-31). The POC found the prior
  //    AI-generated C-3-G (9.0) and C-3-S (4.5) FARs were WRONG; Table 124 gives
  //    C-3-G = 6.0 and C-3-S = 5.0. ──────────────────────────────────────────

  'C-2': {
    code: 'C-2',
    name: 'Community Business',
    classification: sourced('§210.1', 'C-2 DISTRICTS: COMMUNITY BUSINESS'),
    verified: true,
    density: {
      sqft_per_unit: 800,
      note: 'P at a density ratio not exceeding the number of dwelling units permitted in the nearest R District … provided, that the maximum density ratio shall in no case be less than one unit for each 800 square feet of lot area.',
    },
    far_non_residential: { max: 3.6 },
    principal_uses: [
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service Uses',
      'Institutional Uses',
      'Entertainment and Recreation Uses',
      'Residential / Dwelling Unit Density (per nearest R District)',
    ],
    conditional_uses: [
      'Parking Garage, Private',
      'Parking Garage, Public',
      'Parking Lot, Private',
      'Parking Lot, Public',
      'Residential Conversion, Demolition, or Merger of Dwelling Units',
    ],
    parking_text: 'None required. Maximum permitted per § 151.1.',
    dwelling_unit_mix_text: 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.',
    source: {
      density: sourced('§207', 'P at a density ratio not exceeding the number of dwelling units permitted in the nearest R District, with the distance to such R District measured from the midpoint of the front lot line or from a point directly across the street therefrom, whichever permits the greater density; provided, that the maximum density ratio shall in no case be less than one unit for each 800 square feet of lot area.'),
      far_non_residential: sourced('§124', 'C-2 … 3.6 to 1'),
      principal_uses: sourced('§210.1', 'Retail Sales and Service Uses* … P; Non-Retail Sales and Service* … P; Institutional Uses* … P; Entertainment and Recreation Uses* … P.'),
      conditional_uses: sourced('§210.1', 'Parking Garage, Private … C; Parking Garage, Public … C; Parking Lot, Private … C; Parking Lot, Public … C.'),
      parking: sourced('§151.1', 'None required. Maximum permitted per § 151.1.'),
      dwelling_unit_mix: sourced('§207.7', 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 2 Zoning Control Tables (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20120',
    },
  },

  'C-3-O': {
    code: 'C-3-O',
    name: 'Downtown Office',
    classification: sourced('§210.2', 'C-3 DISTRICTS: DOWNTOWN COMMERCIAL'),
    verified: true,
    density: { note: 'Form-Based Density (§ 207); no fixed unit-per-area cap in the C-3 Districts.' },
    far_non_residential: { max: 9.0 },
    principal_uses: [
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service Uses (incl. Office)',
      'Institutional Uses',
      'Entertainment, Arts and Recreation Uses',
      'Residential Uses',
    ],
    conditional_uses: [
      'Hotel',
      'Parking Garage, Private',
      'Parking Garage, Public',
      'Residential Conversion, Demolition, or Merger of Dwelling Units',
    ],
    parking_text: 'None required. Maximum permitted per § 151.1.',
    dwelling_unit_mix_text: 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.',
    source: {
      density: sourced('§207', 'Dwelling Unit Density, General — Form-Based Density.'),
      far_non_residential: sourced('§124', 'C-3-O … 9.0 to 1'),
      principal_uses: sourced('§210.2', 'Retail Sales and Service Uses* … P; Non-Retail Sales and Service* … P (1); Institutional Uses* … P; Entertainment, Arts and Recreation Uses* … P.'),
      conditional_uses: sourced('§210.2', 'Hotel … C; Parking Garage, Private … C; Parking Garage, Public … C.'),
      parking: sourced('§151.1', 'None Required. Maximums set in Planning Code § 151.1'),
      dwelling_unit_mix: sourced('§207.7', 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 2 Zoning Control Tables (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20120',
    },
  },

  'C-3-O(SD)': {
    code: 'C-3-O(SD)',
    name: 'Downtown Office Special Development',
    classification: sourced('§210.2', 'C-3 DISTRICTS: DOWNTOWN COMMERCIAL'),
    verified: true,
    density: { note: 'Form-Based Density (§ 207); no fixed unit-per-area cap in the C-3 Districts.' },
    far_non_residential: { max: 6.0 },
    principal_uses: [
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service Uses (incl. Office)',
      'Institutional Uses',
      'Entertainment, Arts and Recreation Uses',
      'Residential Uses',
    ],
    conditional_uses: [
      'Hotel',
      'Parking Garage, Private',
      'Parking Garage, Public',
      'Residential Conversion, Demolition, or Merger of Dwelling Units',
    ],
    parking_text: 'None required. Maximum permitted per § 151.1.',
    dwelling_unit_mix_text: 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.',
    source: {
      density: sourced('§207', 'Dwelling Unit Density, General — Form-Based Density.'),
      far_non_residential: sourced('§124', 'C-3-O(SD), C-3-R, C-3-G — 6.0 to 1'),
      principal_uses: sourced('§210.2', 'Retail Sales and Service Uses* … P; Non-Retail Sales and Service* … P (1); Institutional Uses* … P; Entertainment, Arts and Recreation Uses* … P.'),
      conditional_uses: sourced('§210.2', 'Hotel … C; Parking Garage, Private … C; Parking Garage, Public … C.'),
      parking: sourced('§151.1', 'None Required. Maximums set in Planning Code § 151.1'),
      dwelling_unit_mix: sourced('§207.7', 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 2 Zoning Control Tables (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20120',
    },
  },

  'C-3-R': {
    code: 'C-3-R',
    name: 'Downtown Retail',
    classification: sourced('§210.2', 'C-3 DISTRICTS: DOWNTOWN COMMERCIAL'),
    verified: true,
    density: { note: 'Form-Based Density (§ 207); no fixed unit-per-area cap in the C-3 Districts.' },
    far_non_residential: { max: 6.0 },
    principal_uses: [
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service Uses (incl. Office)',
      'Institutional Uses',
      'Entertainment, Arts and Recreation Uses',
      'Residential Uses',
    ],
    conditional_uses: [
      'Hotel',
      'Parking Garage, Private',
      'Parking Garage, Public',
      'Residential Conversion, Demolition, or Merger of Dwelling Units',
    ],
    parking_text: 'None required. Maximum permitted per § 151.1.',
    dwelling_unit_mix_text: 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.',
    source: {
      density: sourced('§207', 'Dwelling Unit Density, General — Form-Based Density.'),
      far_non_residential: sourced('§124', 'C-3-O(SD), C-3-R, C-3-G — 6.0 to 1'),
      principal_uses: sourced('§210.2', 'Retail Sales and Service Uses* … P; Non-Retail Sales and Service* … P (1); Institutional Uses* … P; Entertainment, Arts and Recreation Uses* … P.'),
      conditional_uses: sourced('§210.2', 'Hotel … C (12); Parking Garage, Private … C; Parking Garage, Public … C.'),
      parking: sourced('§151.1', 'None Required. Maximums set in Planning Code § 151.1'),
      dwelling_unit_mix: sourced('§207.7', 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 2 Zoning Control Tables (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20120',
    },
  },

  'C-3-G': {
    code: 'C-3-G',
    name: 'Downtown General',
    classification: sourced('§210.2', 'C-3 DISTRICTS: DOWNTOWN COMMERCIAL'),
    verified: true,
    density: { note: 'Form-Based Density (§ 207); no fixed unit-per-area cap in the C-3 Districts.' },
    far_non_residential: { max: 6.0 },
    principal_uses: [
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service Uses (incl. Office)',
      'Institutional Uses',
      'Entertainment, Arts and Recreation Uses',
      'Residential Uses',
    ],
    conditional_uses: [
      'Hotel',
      'Parking Garage, Private',
      'Parking Garage, Public',
      'Residential Conversion, Demolition, or Merger of Dwelling Units',
    ],
    parking_text: 'None required. Maximum permitted per § 151.1.',
    dwelling_unit_mix_text: 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.',
    source: {
      density: sourced('§207', 'Dwelling Unit Density, General — Form-Based Density.'),
      far_non_residential: sourced('§124', 'C-3-O(SD), C-3-R, C-3-G — 6.0 to 1'),
      principal_uses: sourced('§210.2', 'Retail Sales and Service Uses* … P; Non-Retail Sales and Service* … P (1); Institutional Uses* … P; Entertainment, Arts and Recreation Uses* … P.'),
      conditional_uses: sourced('§210.2', 'Hotel … C; Parking Garage, Private … C; Parking Garage, Public … C.'),
      parking: sourced('§151.1', 'None Required. Maximums set in Planning Code § 151.1'),
      dwelling_unit_mix: sourced('§207.7', 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 2 Zoning Control Tables (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20120',
    },
  },

  'C-3-S': {
    code: 'C-3-S',
    name: 'Downtown Support',
    classification: sourced('§210.2', 'C-3 DISTRICTS: DOWNTOWN COMMERCIAL'),
    verified: true,
    density: { note: 'Form-Based Density (§ 207); no fixed unit-per-area cap in the C-3 Districts.' },
    far_non_residential: { max: 5.0 },
    principal_uses: [
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service Uses (incl. Office)',
      'Institutional Uses',
      'Entertainment, Arts and Recreation Uses',
      'Residential Uses',
    ],
    conditional_uses: [
      'Hotel',
      'Parking Garage, Private',
      'Parking Garage, Public',
      'Residential Conversion, Demolition, or Merger of Dwelling Units',
    ],
    parking_text: 'None required. Maximum permitted per § 151.1.',
    dwelling_unit_mix_text: 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.',
    source: {
      density: sourced('§207', 'Dwelling Unit Density, General — Form-Based Density.'),
      far_non_residential: sourced('§124', 'C-3-S … 5.0 to 1'),
      principal_uses: sourced('§210.2', 'Retail Sales and Service Uses* … P; Non-Retail Sales and Service* … P (1); Institutional Uses* … P; Entertainment, Arts and Recreation Uses* … P.'),
      conditional_uses: sourced('§210.2', 'Hotel … C; Parking Garage, Private … C; Parking Garage, Public … C.'),
      parking: sourced('§151.1', 'None Required. Maximums set in Planning Code § 151.1'),
      dwelling_unit_mix: sourced('§207.7', 'No less than 25% of the total number of proposed Dwelling Units shall contain at least two Bedrooms, and no less than 10% of the total number of proposed Dwelling Units shall contain at least three Bedrooms.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 2 Zoning Control Tables (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20120',
    },
  },

  // ── Industrial / PDR ─────────────────────────────────────────────────────

  'M-1': {
    code: 'M-1',
    name: 'Light Industrial',
    classification: sourced('§210.4', 'M DISTRICTS: INDUSTRIAL'),
    verified: true,
    density: {
      note: 'Primarily non-residential; dwellings only as a conditional use, no fixed unit cap (see Table 210.4)',
    },
    far_non_residential: { max: 5.0 },
    principal_uses: [
      'Manufacturing, Light',
      'Metal Workshop',
      'Storage Yard',
      'Wholesaling (Non-Retail Sales and Service)',
      'Retail Sales and Service Uses',
    ],
    conditional_uses: [
      'Manufacturing 2, Heavy',
      'Truck Terminal',
      'Auto Wrecking',
      'Planned Unit Development',
    ],
    parking_text: 'None Required. Maximums set in Planning Code § 151.1.',
    controls_note: 'Height varies — see Height and Bulk District Maps (map-driven, no scalar limit).',
    source: {
      density: sourced('§210.4', 'C at a density ratio not exceeding the number of dwelling units permitted in the nearest R District, with the distance to such R District measured from the midpoint of the front lot line or from a point directly across the street therefrom, whichever permits the greater density; provided, that the maximum density ratio shall in no case be less than one unit for each 800 feet of lot area. Any remaining fraction of one-half or more of the minimum amount of lot area per dwelling unit shall be adjusted upward to the next higher whole number of dwelling units. NP above.'),
      far_non_residential: sourced('§124', '5 to 1. For Office Uses minimum intensities may apply pursuant to § 207.9.'),
      principal_uses: sourced('§210.4', 'Manufacturing, Light … P; Metal Workshop … P; Storage Yard … P; Retail Sales and Service Uses* … P; Non-Retail Sales and Service* … P.'),
      conditional_uses: sourced('§210.4', 'Manufacturing 2, Heavy … C; Truck Terminal … C; Auto Wrecking … C; Planned Unit Development … C.'),
      parking: sourced('§151.1', 'None Required. Maximums set in Planning Code § 151.1.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Table 210.4 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20132',
    },
  },

  'M-2': {
    code: 'M-2',
    name: 'Heavy Industrial',
    classification: sourced('§210.4', 'M DISTRICTS: INDUSTRIAL'),
    verified: true,
    density: {
      note: 'Primarily non-residential; dwellings only as a conditional use, no fixed unit cap (see Table 210.4)',
    },
    far_non_residential: { max: 5.0 },
    principal_uses: [
      'Manufacturing 1, Heavy',
      'Manufacturing 3, Heavy',
      'Ship Yard',
      'Grain Elevator',
      'Junkyard',
      'Storage Yard',
    ],
    conditional_uses: [
      'Hazardous Waste Facility',
      'Livestock Processing 2',
      'Storage, Volatile Materials',
      'Truck Terminal',
      'Planned Unit Development',
    ],
    parking_text: 'None Required. Maximums set in Planning Code § 151.1.',
    controls_note: 'Height varies — see Height and Bulk District Maps (map-driven, no scalar limit).',
    source: {
      density: sourced('§210.4', 'C at a density ratio not exceeding the number of dwelling units permitted in the nearest R District, with the distance to such R District measured from the midpoint of the front lot line or from a point directly across the street therefrom, whichever permits the greater density; provided, that the maximum density ratio shall in no case be less than one unit for each 800 feet of lot area. Any remaining fraction of one-half or more of the minimum amount of lot area per dwelling unit shall be adjusted upward to the next higher whole number of dwelling units. NP above.'),
      far_non_residential: sourced('§124', '5 to 1. For Office Uses minimum intensities may apply pursuant to § 207.9.'),
      principal_uses: sourced('§210.4', 'Manufacturing 1, Heavy … P; Manufacturing 3, Heavy … P; Ship Yard … P; Grain Elevator … P; Junkyard … P; Storage Yard … P.'),
      conditional_uses: sourced('§210.4', 'Hazardous Waste Facility … C; Livestock Processing 2 … C; Storage, Volatile Materials … C; Truck Terminal … C; Planned Unit Development … C.'),
      parking: sourced('§151.1', 'None Required. Maximums set in Planning Code § 151.1.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Table 210.4 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20132',
    },
  },

  'SALI': {
    code: 'SALI',
    name: 'Service/Arts/Light Industrial',
    classification: sourced('§836', 'SALI - SERVICE/ARTS/LIGHT INDUSTRIAL DISTRICT'),
    verified: true,
    density: {
      note: 'Residential Uses and Offices not permitted; Form-Based Density where dwellings are permitted (see Table 836)',
    },
    principal_uses: [
      'Light Manufacturing',
      'Trade Shop',
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service Uses',
      'Entertainment, Arts and Recreation Uses',
      'Automotive Uses',
    ],
    conditional_uses: [
      'Formula Retail',
      'Massage Establishment',
      'Homeless Shelters',
      'Wireless Telecommunications Services Facility',
    ],
    parking_text: 'No car parking required. Maximum permitted as set forth in § 151.1.',
    controls_note: 'Height varies — see Height and Bulk District Maps; Basic FAR per § 124, based on height (no fixed scalar).',
    source: {
      density: sourced('§836', 'Residential Uses, Offices, Hotels, and Adult Entertainment uses are not permitted, except that certain Affordable Housing Projects are permitted within the district pursuant to Section 803.8 of this Code, and Accessory Dwelling Units are permitted.'),
      principal_uses: sourced('§836', 'Light Manufacturing … P; Trade Shop … P; Retail Sales and Service Uses* … P; Non-Retail Sales and Service* … P; Entertainment, Arts and Recreation Uses* … P; Automotive Uses* … P.'),
      conditional_uses: sourced('§836', 'Formula Retail … C; Massage Establishment … C; Homeless Shelters … C; Wireless Telecommunications Services Facility … C.'),
      parking: sourced('§151.1', 'No car parking required. Maximum permitted as set forth in § 151.1.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Table 836 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-67785',
    },
  },

  // PDR FAR is height-district-banded (no scalar): the Floor Area Ratio row of
  // Table 210.3 spans all four PDR columns with one identical ramp, so each record
  // stores it under far_non_residential.banded (not .max). Residential is Not
  // Permitted (NP) in every PDR District (Dwelling Units row, §102). Verbatim from
  // /api/render-section/san_francisco/latest/sf_planning/0-0-0-20123 (retrieved 2026-05-31).
  // Parking, principal/conditional use mixes differ per column and are transcribed
  // per record from the relevant Table 210.3 cell.

  'PDR-1-B': {
    code: 'PDR-1-B',
    name: 'PDR — Light Industrial Buffer',
    classification: sourced('§210.3', 'PDR DISTRICTS'),
    verified: true,
    density: { model: 'unit-based', note: 'Residential not permitted (PDR)' },
    far_non_residential: {
      banded: '3.0 to 1 in a 40, 45, or 48-foot height district; 4.0 to 1 in a 50, 55, or 58-foot height district; 5.0 to 1 in a 65 or 68-foot height district; 6.0 in an 80 or 85-foot height district; or 7.5 to 1 in a height district over 85 feet.',
      basis: 'per height district (§124)',
    },
    principal_uses: [
      'Manufacturing, Light',
      'Storage Yard',
      'Storage, Wholesale',
      'Wholesale Sales',
      'Trade Shop',
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service',
    ],
    conditional_uses: [
      'Agriculture, Industrial',
      'Parking Garage, Private / Public',
      'Parking Lot, Private / Public',
      'Service, Parcel Delivery',
      'Gym',
      'Planned Unit Development',
    ],
    parking_text: 'Parking required per § 151.1.',
    controls_note: 'Height varies — see Height and Bulk District Maps; FAR is height-district-banded (§124, no scalar).',
    source: {
      density: sourced('§210.3', 'Dwelling Units … § 102 … NP … NP … NP … NP'),
      far_non_residential: sourced('§124', '3.0 to 1 in a 40, 45, or 48-foot height district; 4.0 to 1 in a 50, 55, or 58-foot height district; 5.0 to 1 in a 65 or 68-foot height district; 6.0 in an 80 or 85-foot height district; or 7.5 to 1 in a height district over 85 feet.'),
      principal_uses: sourced('§210.3', 'Manufacturing, Light … P (5); Storage Yard … P (5); Storage, Wholesale (25) … P (5); Wholesale Sales (25) … P (5); Trade Shop (25) … P (11); Retail Sales and Service Uses* … P (1); Non-Retail Sales and Service* … P (2).'),
      conditional_uses: sourced('§210.3', 'Agriculture, Industrial … C; Parking Garage, Private … C; Parking Garage, Public … C; Parking Lot, Private … C; Parking Lot, Public … C; Service, Parcel Delivery (25) … C; Gym … C; Planned Unit Development** … C.'),
      parking: sourced('§151.1', 'Parking required per § 151.1.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Table 210.3 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20123',
    },
  },

  'PDR-1-D': {
    code: 'PDR-1-D',
    name: 'PDR — Design',
    classification: sourced('§210.3', 'PDR DISTRICTS'),
    verified: true,
    density: { model: 'unit-based', note: 'Residential not permitted (PDR)' },
    far_non_residential: {
      banded: '3.0 to 1 in a 40, 45, or 48-foot height district; 4.0 to 1 in a 50, 55, or 58-foot height district; 5.0 to 1 in a 65 or 68-foot height district; 6.0 in an 80 or 85-foot height district; or 7.5 to 1 in a height district over 85 feet.',
      basis: 'per height district (§124)',
    },
    principal_uses: [
      'Manufacturing, Light',
      'Metal Workshop',
      'Storage Yard',
      'Trade Shop',
      'Truck Terminal',
      'Automotive Uses',
      'Arts / Entertainment and Recreation Uses',
      'Retail Sales and Service Uses',
    ],
    conditional_uses: [
      'Manufacturing 1, Heavy',
      'Automobile Assembly',
      'Agricultural and Beverage Processing 2',
      'Sports Stadium',
      'Public Transportation Facility',
      'Planned Unit Development',
    ],
    parking_text: 'None Required. Maximums set in Planning Code § 151.1.',
    controls_note: 'Height varies — see Height and Bulk District Maps; FAR is height-district-banded (§124, no scalar).',
    source: {
      density: sourced('§210.3', 'Dwelling Units … § 102 … NP … NP … NP … NP'),
      far_non_residential: sourced('§124', '3.0 to 1 in a 40, 45, or 48-foot height district; 4.0 to 1 in a 50, 55, or 58-foot height district; 5.0 to 1 in a 65 or 68-foot height district; 6.0 in an 80 or 85-foot height district; or 7.5 to 1 in a height district over 85 feet.'),
      principal_uses: sourced('§210.3', 'Manufacturing, Light … P; Metal Workshop … P; Storage Yard … P; Trade Shop (25) … P; Truck Terminal … P; Automotive Uses* … P; Entertainment and Recreation Uses* … P; Retail Sales and Service Uses* … P (10).'),
      conditional_uses: sourced('§210.3', 'Manufacturing 1, Heavy … C; Automobile Assembly … C; Agricultural and Beverage Processing 2 … C; Sports Stadium … C; Public Transportation Facility … C; Planned Unit Development** … C.'),
      parking: sourced('§151.1', 'None Required. Maximums set in Planning Code § 151.1.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Table 210.3 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20123',
    },
  },

  'PDR-1-G': {
    code: 'PDR-1-G',
    name: 'PDR — General',
    classification: sourced('§210.3', 'PDR DISTRICTS'),
    verified: true,
    density: { model: 'unit-based', note: 'Residential not permitted (PDR)' },
    far_non_residential: {
      banded: '3.0 to 1 in a 40, 45, or 48-foot height district; 4.0 to 1 in a 50, 55, or 58-foot height district; 5.0 to 1 in a 65 or 68-foot height district; 6.0 in an 80 or 85-foot height district; or 7.5 to 1 in a height district over 85 feet.',
      basis: 'per height district (§124)',
    },
    principal_uses: [
      'Manufacturing, Light',
      'Metal Workshop',
      'Storage Yard',
      'Trade Shop',
      'Truck Terminal',
      'Automotive Uses',
      'Community Recycling Center',
      'Retail Sales and Service Uses',
    ],
    conditional_uses: [
      'Manufacturing 1, Heavy',
      'Manufacturing 2, Heavy',
      'Automobile Assembly',
      'Agricultural and Beverage Processing 2',
      'Power Plant',
      'Sports Stadium',
      'Planned Unit Development',
    ],
    parking_text: 'None Required. Maximums set in Planning Code § 151.1.',
    controls_note: 'Height varies — see Height and Bulk District Maps; FAR is height-district-banded (§124, no scalar).',
    source: {
      density: sourced('§210.3', 'Dwelling Units … § 102 … NP … NP … NP … NP'),
      far_non_residential: sourced('§124', '3.0 to 1 in a 40, 45, or 48-foot height district; 4.0 to 1 in a 50, 55, or 58-foot height district; 5.0 to 1 in a 65 or 68-foot height district; 6.0 in an 80 or 85-foot height district; or 7.5 to 1 in a height district over 85 feet.'),
      principal_uses: sourced('§210.3', 'Manufacturing, Light … P; Metal Workshop … P; Storage Yard … P; Trade Shop (25) … P; Truck Terminal … P; Automotive Uses* … P; Community Recycling Center … P; Retail Sales and Service Uses* … P (9).'),
      conditional_uses: sourced('§210.3', 'Manufacturing 1, Heavy … C; Manufacturing 2, Heavy … C; Automobile Assembly … C; Agricultural and Beverage Processing 2 … C; Power Plant … C; Sports Stadium … C; Planned Unit Development** … C.'),
      parking: sourced('§151.1', 'None Required. Maximums set in Planning Code § 151.1.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Table 210.3 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20123',
    },
  },

  'PDR-2': {
    code: 'PDR-2',
    name: 'Core Production, Distribution & Repair',
    classification: sourced('§210.3', 'PDR DISTRICTS'),
    verified: true,
    density: { model: 'unit-based', note: 'Residential not permitted (PDR)' },
    far_non_residential: {
      banded: '3.0 to 1 in a 40, 45, or 48-foot height district; 4.0 to 1 in a 50, 55, or 58-foot height district; 5.0 to 1 in a 65 or 68-foot height district; 6.0 in an 80 or 85-foot height district; or 7.5 to 1 in a height district over 85 feet.',
      basis: 'per height district (§124)',
    },
    principal_uses: [
      'Manufacturing, Light',
      'Automobile Assembly',
      'Grain Elevator',
      'Junkyard',
      'Metal Workshop',
      'Storage Yard',
      'Truck Terminal',
      'Maritime Use',
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service',
    ],
    conditional_uses: [
      'Auto Wrecking',
      'Manufacturing 1, Heavy',
      'Manufacturing 2, Heavy',
      'Manufacturing 3, Heavy',
      'Hazardous Waste Facility',
      'Ship Yard',
      'Storage, Volatile Materials',
      'Power Plant',
      'Planned Unit Development',
    ],
    parking_text: 'Parking required per § 151.1.',
    controls_note: 'Height varies — see Height and Bulk District Maps; FAR is height-district-banded (§124, no scalar).',
    source: {
      density: sourced('§210.3', 'Dwelling Units … § 102 … NP … NP … NP … NP'),
      far_non_residential: sourced('§124', '3.0 to 1 in a 40, 45, or 48-foot height district; 4.0 to 1 in a 50, 55, or 58-foot height district; 5.0 to 1 in a 65 or 68-foot height district; 6.0 in an 80 or 85-foot height district; or 7.5 to 1 in a height district over 85 feet.'),
      principal_uses: sourced('§210.3', 'Manufacturing, Light … P; Automobile Assembly … P; Grain Elevator … P; Junkyard … P; Metal Workshop … P; Storage Yard … P; Truck Terminal … P; Maritime Use … P; Retail Sales and Service Uses* … P (1); Non-Retail Sales and Service* … P (2).'),
      conditional_uses: sourced('§210.3', 'Auto Wrecking … C; Manufacturing 1, Heavy … C; Manufacturing 2, Heavy … C; Manufacturing 3, Heavy … C; Hazardous Waste Facility … C; Ship Yard … C; Storage, Volatile Materials … C; Power Plant … C; Planned Unit Development** … C.'),
      parking: sourced('§151.1', 'Parking required per § 151.1 .'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Table 210.3 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20123',
    },
  },

  // ── Public ───────────────────────────────────────────────────────────────

  'P': {
    code: 'P',
    name: 'Public',
    classification: sourced('§211', 'P (PUBLIC) DISTRICTS'),
    verified: true,
    density: { note: 'Public lands — no dwelling-unit density control' },
    principal_uses: [
      'Public structures and uses of governmental agencies',
      'Neighborhood Agriculture',
      'City Plazas',
      'Accessory nonpublic uses (per § 211.1)',
      'Residential Uses in 100% Affordable Housing and Educator Housing Projects',
    ],
    conditional_uses: [
      'School, Post-Secondary Educational Institution',
      'Religious Institution, Community Facility',
      'Social Service and Philanthropic Facility',
      'Open Recreation Area, Passive Outdoor Recreation',
      'Wireless Telecommunications Services Facility (commercial)',
    ],
    controls_note: 'Public lands — uses governed by §211; no FAR, density, or open-space controls.',
    source: {
      density: sourced('§211', 'Any lot in a P District may be occupied by a principal use listed in Section 211.1, or by a conditional use listed in Section 211.2, subject to applicable regulations of this Code. Principal uses not identified under Sections 211.1 or 211.2 of this Code are not permitted in any P District.'),
      principal_uses: sourced('§211.1', 'Public structures and uses of the City and County of San Francisco, and of other governmental agencies that are subject to regulation by this Code, including Neighborhood Agriculture, as defined in Section 102 of this Code.'),
      conditional_uses: sourced('§211.2', 'For any P District, Social Service and Philanthropic Facility, School, Post-Secondary Educational Institution, Religious Institution, Community Facility, Open Recreation Area, Passive Outdoor Recreation and Neighborhood Agriculture as defined in Section 102 of this Code.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code §211 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-50175',
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
    name: 'Central SoMa Mixed Use — Office',
    classification: sourced('§830', 'CMUO - CENTRAL SOMA MIXED USE-OFFICE DISTRICT'),
    verified: true,
    density: { model: 'form-based', note: 'Form-Based Density.' },
    far_non_residential: {
      basis: 'per §124, by height district',
      note: 'In the Central SoMa SUD, prevailing Height and Density limits are determined by Section 249.78, subject to the requirements of Section 128. For Office Uses minimum intensities may apply pursuant to § 207.9.',
    },
    principal_uses: [
      'Agricultural Uses',
      'Automotive Uses',
      'Entertainment and Recreation Uses',
      'Manufacturing, Light',
      'Institutional Uses',
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service',
      'Utility and Infrastructure Uses',
      'Office (per Central SoMa controls)',
    ],
    conditional_uses: [
      'Hospital',
      'Medical Cannabis Dispensary',
      'Adult Sex Venue',
      'Cannabis Retail',
      'Hotel',
      'Wireless Telecommunications Services Facility',
    ],
    dwelling_unit_mix_text: 'At least 40% of all dwelling units shall contain two or more bedrooms, 30% of all dwelling units shall contain three or more bedrooms, or 35% of all dwelling units shall contain two or more bedrooms with at least 10% containing three or more bedrooms.',
    parking_text: 'Car parking not required. Limits set forth in §151.1. Bicycle Parking required pursuant to §155.2. If car parking is provided, car share spaces are required when a project has 50 units or more pursuant to §166.',
    controls_note: 'Central SoMa Special Use District; height and density determined by §249.78 (see Height and Bulk Map Sheets HT01 and HT07).',
    source: {
      density: sourced('§207', 'Form-Based Density.'),
      far_non_residential: sourced('§124', 'In the Central SoMa SUD, prevailing Height and Density limits are determined by Section 249.78, subject to the requirements of Section 128. For Office Uses minimum intensities may apply pursuant to § 207.9.'),
      principal_uses: sourced('§830', 'Agricultural Uses … P; Automotive Uses* … P; Entertainment and Recreation Uses* … P; Manufacturing, Light … P; Institutional Uses* … P; Retail Sales and Service Uses* … P(1); Non-Retail Sales and Service … P; Utility and Infrastructure* … P.'),
      conditional_uses: sourced('§830', 'Hospital … C; Medical Cannabis Dispensary … C; Adult Sex Venue … C; Cannabis Retail … C; Hotel … C(2); Wireless Telecommunications Services Facility … C(5).'),
      dwelling_unit_mix: sourced('§207.6', 'At least 40% of all dwelling units shall contain two or more bedrooms, 30% of all dwelling units shall contain three or more bedrooms, or 35% of all dwelling units shall contain two or more bedrooms with at least 10% containing three or more bedrooms.'),
      parking: sourced('§151.1', 'Car parking not required. Limits set forth in §151.1. Bicycle Parking required pursuant to §155.2. If car parking is provided, car share spaces are required when a project has 50 units or more pursuant to §166.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 8 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-67565',
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
    name: 'Mixed Use — General',
    classification: sourced('§831', 'MUG - MIXED USE-GENERAL DISTRICT'),
    verified: true,
    density: { model: 'form-based', note: 'Form-Based Density.' },
    far_non_residential: {
      basis: 'per §124, by height district',
      note: 'FAR based on permitted height. See §124 for more information. (4) For Office Uses minimum intensities may apply pursuant to § 207.9.',
    },
    principal_uses: [
      'Agricultural Uses',
      'Automotive Uses',
      'Arts Activities',
      'Open Recreation Area',
      'Movie Theater',
      'Light Manufacturing',
      'Institutional Uses',
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service',
      'Public Transportation Facility',
      'Reproductive Health Clinic',
    ],
    conditional_uses: [
      'Post-Secondary Educational Institution',
      'Bar',
      'Cannabis Retail',
      'Hotel',
      'Liquor Store',
      'Wireless Telecommunications Services Facility',
    ],
    dwelling_unit_mix_text: 'At least 40% of all dwelling units must contain two or more bedrooms or 30% of all dwelling units must contain three or more bedrooms.',
    parking_text: 'No car parking required. Maximum permitted per § 151.1 . Bike parking required per § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more per § 166.',
    source: {
      density: sourced('§207', 'Form-Based Density.'),
      far_non_residential: sourced('§124', 'FAR based on permitted height. See §124 for more information. (4) For Office Uses minimum intensities may apply pursuant to § 207.9.'),
      principal_uses: sourced('§831', 'Agricultural Uses … P; Automotive Uses* … P; Arts Activities … P; Open Recreation Area … P; Movie Theater … P up to three screens; Light Manufacturing … P; Institutional Uses* … P; Retail Sales and Service Uses* … P(5); Non-Retail Sales and Service* … P; Public Transportation Facility … P.'),
      conditional_uses: sourced('§831', 'Post-Secondary Educational Institution … C; Bar … C(5); Cannabis Retail … C(5); Hotel … C; Liquor Store … C(5); Wireless Telecommunications Services Facility … C(3).'),
      dwelling_unit_mix: sourced('§207.6', 'At least 40% of all dwelling units must contain two or more bedrooms or 30% of all dwelling units must contain three or more bedrooms.'),
      parking: sourced('§151.1', 'No car parking required. Maximum permitted per § 151.1 . Bike parking required per § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more per § 166.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 8 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-67718',
    },
  },

  'MUO': {
    code: 'MUO',
    name: 'Mixed Use — Office',
    classification: sourced('§832', 'MUO - MIXED USE-OFFICE DISTRICT'),
    verified: true,
    // NOTE: the live §832 table cites the "Dwelling Unit and Group Housing
    // Density, General" row to § 208 (its § Refs link target is 0-0-0-20056,
    // the current §208). Transcribed verbatim as the table presents it; the
    // separate "Dwelling Units" P row cites §207. See task report for the
    // §207-vs-§208 transcription note.
    density: { model: 'form-based', note: 'Form-Based Density.' },
    far_non_residential: {
      basis: 'per §124, by height district',
      note: 'Varies, depending on height, as set forth in § 124. For Office Uses minimum intensities may apply pursuant to § 207.9.',
    },
    principal_uses: [
      'Agricultural Uses',
      'Automotive Uses',
      'Entertainment, Arts and Recreation Uses',
      'Movie Theater',
      'Light Manufacturing',
      'Institutional Uses',
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service',
      'Public Transportation Facility',
      'Reproductive Health Clinic',
    ],
    conditional_uses: [
      'Entertainment, Nighttime',
      'Adult Sex Venue',
      'Hotel',
      'Wireless Telecommunications Services Facility',
    ],
    dwelling_unit_mix_text: 'At least 40% of all dwelling units must contain two or more bedrooms or 30% of all dwelling units must contain three or more bedrooms.',
    parking_text: 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required per § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more per § 166.',
    source: {
      density: sourced('§208', 'Form-Based Density.'),
      far_non_residential: sourced('§124', 'Varies, depending on height, as set forth in § 124. For Office Uses minimum intensities may apply pursuant to § 207.9.'),
      principal_uses: sourced('§832', 'Agricultural Uses … P; Automotive Uses* … P; Entertainment, Arts and Recreation Uses* … P; Movie Theater … P up to three screens; Light Manufacturing … P; Institutional Uses … P; Retail Sales and Service Uses* … P(4) (6); Non-Retail Sales and Service … P; Public Transportation Facility … P.'),
      conditional_uses: sourced('§832', 'Entertainment, Nighttime … C; Adult Sex Venue … C; Hotel … C(5); Wireless Telecommunications Services Facility … C(2).'),
      dwelling_unit_mix: sourced('§207.6', 'At least 40% of all dwelling units must contain two or more bedrooms or 30% of all dwelling units must contain three or more bedrooms.'),
      parking: sourced('§151.1', 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required per § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more per § 166.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 8 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-67732',
    },
  },

  'MUR': {
    code: 'MUR',
    name: 'Mixed Use — Residential',
    classification: sourced('§833', 'MUR - MIXED USE-RESIDENTIAL DISTRICT'),
    verified: true,
    density: { model: 'form-based', note: 'Form-Based Density.' },
    far_non_residential: {
      basis: 'per §124, by height district',
      note: 'FAR based on permitted height, see Section 124 for more information. (3) For Office Uses minimum intensities may apply pursuant to § 207.9.',
    },
    principal_uses: [
      'Agricultural Uses',
      'Automotive Uses',
      'Arts Activities',
      'Open Recreation Area',
      'Movie Theater',
      'Manufacturing, Light',
      'Institutional Uses',
      'Medical Cannabis Dispensary',
      'Retail Sales and Service Uses',
      'Cannabis Retail',
      'Non-Retail Sales and Service',
      'Public Transportation Facility',
    ],
    conditional_uses: [
      'Post-Secondary Educational Institution',
      'Adult Sex Venue',
      'Wireless Telecommunications Services Facility',
    ],
    dwelling_unit_mix_text: 'At least 40% of all dwelling units must contain two or more bedrooms or 30% of all dwelling units must contain three or more bedrooms.',
    parking_text: 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required per § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more per § 166.',
    source: {
      density: sourced('§207', 'Form-Based Density.'),
      far_non_residential: sourced('§124', 'FAR based on permitted height, see Section 124 for more information. (3) For Office Uses minimum intensities may apply pursuant to § 207.9.'),
      principal_uses: sourced('§833', 'Agricultural Uses* … P; Automotive Uses* … P; Arts Activities … P; Open Recreation Area … P; Movie Theater … P up to three screens; Manufacturing, Light … P; Institutional Uses* … P; Medical Cannabis Dispensary … P(3); Retail Sales and Service Uses* … P; Cannabis Retail … P(3); Non-Retail Sales and Service* … P; Public Transportation Facility … P.'),
      conditional_uses: sourced('§833', 'Post-Secondary Educational Institution … C; Adult Sex Venue … C(6); Wireless Telecommunications Services Facility … C(2).'),
      dwelling_unit_mix: sourced('§207.6', 'At least 40% of all dwelling units must contain two or more bedrooms or 30% of all dwelling units must contain three or more bedrooms.'),
      parking: sourced('§151.1', 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required per § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more per § 166.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 8 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-67745',
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
    name: 'Residential Enclave District',
    classification: sourced('§834', 'RED - RESIDENTIAL ENCLAVE DISTRICT'),
    verified: true,
    density: { sqft_per_unit: 400 },
    far_non_residential: { max: 1.0 },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 60, note: '60 sq.ft. per unit if all private; 80 sq.ft. if common space. 36 sq.ft. per unit for live/work units' },
    principal_uses: [
      'SRO units',
      'Child care facility',
      'Live/work unit where work activity is an arts activity',
      'Automobile parking lots',
      'Open recreation and horticulture',
      'Walk-up facilities except ATMs',
    ],
    conditional_uses: [
      'Residential care facility',
      'Educational services',
      'Religious facility',
      'Assembly or social service',
      'Automobile parking garages',
      'Retail sales and services and office uses when in a landmark building or a contributory building in a historic district',
    ],
    front_setback_text: 'No requirement.',
    rear_yard_text: '25% of lot depth, but no less than 15 feet.',
    source: {
      density: sourced('§207', 'One dwelling unit per 400 sq.ft. of lot area'),
      far_non_residential: sourced('§124', '1.0 times lot area'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '60 sq.ft. per unit if all private; 80 sq.ft. if common space. 36 sq.ft. per unit for live/work units'),
      principal_uses: sourced('§§209–209.9', 'SRO units; child care facility; live/work unit where work activity is an arts activity; automobile parking lots; open recreation and horticulture; walk-up facilities except ATMs'),
      conditional_uses: sourced('§§209–209.9', 'Residential care facility; educational services, religious facility; assembly or social service; automobile parking garages; retail sales and services and office uses when in a landmark building or a contributory building in a historic district.'),
      front_setback: sourced('§132', 'No requirement.'),
      rear_yard: sourced('§134', '25% of lot depth, but no less than 15 feet.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RED-MX': {
    code: 'RED-MX',
    name: 'Residential Enclave — Mixed',
    classification: sourced('§835', 'RED-MX - RESIDENTIAL ENCLAVE-MIXED DISTRICT'),
    verified: true,
    density: { model: 'form-based', note: 'Form-Based Density.' },
    far_non_residential: {
      basis: 'per §124, by height district',
      note: 'Section 124 sets forth the Basic FAR, based on height. Childcare Facilities and Residential Care Facilities are exempt from FAR limits.',
    },
    principal_uses: [
      'Agricultural Uses',
      'Arts Activities',
      'Open Recreation Area',
      'Light Manufacturing',
      'Institutional Uses',
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service',
      'Reproductive Health Clinic',
    ],
    conditional_uses: [
      'Post-Secondary Educational Institution',
      'Public Transportation Facility',
      'Wireless Telecommunications Services Facility',
    ],
    dwelling_unit_mix_text: 'At least 40% of all Dwelling Units must contain two or more bedrooms or 30% of all Dwelling Units must contain three or more bedrooms.',
    parking_text: 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required per § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more per § 166.',
    source: {
      density: sourced('§207', 'Form-Based Density.'),
      far_non_residential: sourced('§124', 'Section 124 sets forth the Basic FAR, based on height. Childcare Facilities and Residential Care Facilities are exempt from FAR limits.'),
      principal_uses: sourced('§835', 'Agricultural Uses … P; Arts Activities … P(3); Open Recreation Area … P; Light Manufacturing … P(3); Institutional Uses* … P; Retail Sales and Service Uses* … P(3); Non-Retail Sales and Service* … P(3); Reproductive Health Clinic … P.'),
      conditional_uses: sourced('§835', 'Post-Secondary Educational Institution … C; Public Transportation Facility … C; Wireless Telecommunications Services Facility … C(1).'),
      dwelling_unit_mix: sourced('§207.6', 'At least 40% of all Dwelling Units must contain two or more bedrooms or 30% of all Dwelling Units must contain three or more bedrooms.'),
      parking: sourced('§151.1', 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required per § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more per § 166.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 8 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-67772',
    },
  },

  // ── RTO family ─────────────────────────────────────────────────────────────
  // The 2008 summary table has a single "RTO" row; the three DataSF variants
  // (RTO-1, RTO-C, RTO-M) share these §-summary controls. Bulk/height differ
  // between variants via the height map, not here. FAR is "Not Applicable" in
  // the source, so far_non_residential is omitted.

  'RTO-1': {
    code: 'RTO-1',
    name: 'Residential Transit Oriented Development',
    classification: sourced('§209.4', 'RTO (RESIDENTIAL TRANSIT ORIENTED) DISTRICTS'),
    verified: true,
    density: { sqft_per_unit: 600, note: 'Permitted 1 dwelling unit per 600 square feet of lot area; may exceed for BMR/affordable/special uses (§209.1(m)); CU may exceed and is then limited by height, bulk and unit mix requirements.' },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 100 },
    principal_uses: [
      'Neighborhood serving commercial uses permitted on corner lots only (limit 1,200 gross sq.ft. total per corner; NC-1 rules generally apply)',
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
    ],
    conditional_uses: ['Community facilities'],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.',
    dwelling_unit_mix_text: 'Minimum dwelling unit mix – 40% 2-bedroom for buildings with 5 or more units.',
    parking_text: 'No residential parking required; Permitted 3 spaces for every 4 units maximum; conditional use for 1 space per unit. Not permitted above.',
    source: {
      density: sourced('§207', 'Permitted 1 dwelling unit per 600 square feet of lot area; may exceed this limit for BMR units, affordable housing, or other special uses (§209.1(m)). With a conditional use permit density may exceed 1 unit per 600 and is then limited by height, bulk and unit mix requirements.'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '100 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Neighborhood serving commercial uses permitted on corner lots only. Limit 1,200 gross sq.ft. total per corner; NC-1 rules generally apply. Residential care facility for 6 or fewer; child care facility for 12 or fewer; open space for horticulture or passive recreation; public structure or use of non-industrial character; sale or lease sign'),
      conditional_uses: sourced('§§209–209.9', 'Community facilities'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.'),
      dwelling_unit_mix: sourced('§207.6', 'Minimum dwelling unit mix – 40% 2-bedroom for buildings with 5 or more units.'),
      parking: sourced('§151.1', 'No residential parking required; Permitted 3 spaces for every 4 units maximum; conditional use for 1 space per unit. Not permitted above.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RTO-C': {
    code: 'RTO-C',
    name: 'Residential Transit Oriented Development',
    classification: sourced('§209.4', 'RTO (RESIDENTIAL TRANSIT ORIENTED) DISTRICTS'),
    verified: true,
    density: { sqft_per_unit: 600, note: 'Permitted 1 dwelling unit per 600 square feet of lot area; may exceed for BMR/affordable/special uses (§209.1(m)); CU may exceed and is then limited by height, bulk and unit mix requirements.' },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 100 },
    principal_uses: [
      'Neighborhood serving commercial uses permitted on corner lots only (limit 1,200 gross sq.ft. total per corner; NC-1 rules generally apply)',
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
    ],
    conditional_uses: ['Community facilities'],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.',
    dwelling_unit_mix_text: 'Minimum dwelling unit mix – 40% 2-bedroom for buildings with 5 or more units.',
    parking_text: 'No residential parking required; Permitted 3 spaces for every 4 units maximum; conditional use for 1 space per unit. Not permitted above.',
    source: {
      density: sourced('§207', 'Permitted 1 dwelling unit per 600 square feet of lot area; may exceed this limit for BMR units, affordable housing, or other special uses (§209.1(m)). With a conditional use permit density may exceed 1 unit per 600 and is then limited by height, bulk and unit mix requirements.'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '100 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Neighborhood serving commercial uses permitted on corner lots only. Limit 1,200 gross sq.ft. total per corner; NC-1 rules generally apply. Residential care facility for 6 or fewer; child care facility for 12 or fewer; open space for horticulture or passive recreation; public structure or use of non-industrial character; sale or lease sign'),
      conditional_uses: sourced('§§209–209.9', 'Community facilities'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.'),
      dwelling_unit_mix: sourced('§207.6', 'Minimum dwelling unit mix – 40% 2-bedroom for buildings with 5 or more units.'),
      parking: sourced('§151.1', 'No residential parking required; Permitted 3 spaces for every 4 units maximum; conditional use for 1 space per unit. Not permitted above.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'RTO-M': {
    code: 'RTO-M',
    name: 'Residential Transit Oriented Development',
    classification: sourced('§209.4', 'RTO (RESIDENTIAL TRANSIT ORIENTED) DISTRICTS'),
    verified: true,
    density: { sqft_per_unit: 600, note: 'Permitted 1 dwelling unit per 600 square feet of lot area; may exceed for BMR/affordable/special uses (§209.1(m)); CU may exceed and is then limited by height, bulk and unit mix requirements.' },
    min_lot: { width_ft: 25, area_sqft: 2500 },
    open_space_per_unit: { private_sqft: 100 },
    principal_uses: [
      'Neighborhood serving commercial uses permitted on corner lots only (limit 1,200 gross sq.ft. total per corner; NC-1 rules generally apply)',
      'Residential care facility for 6 or fewer',
      'Child care facility for 12 or fewer',
      'Open space for horticulture or passive recreation',
      'Public structure or use of non-industrial character',
      'Sale or lease sign',
    ],
    conditional_uses: ['Community facilities'],
    front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
    rear_yard_text: '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.',
    dwelling_unit_mix_text: 'Minimum dwelling unit mix – 40% 2-bedroom for buildings with 5 or more units.',
    parking_text: 'No residential parking required; Permitted 3 spaces for every 4 units maximum; conditional use for 1 space per unit. Not permitted above.',
    source: {
      density: sourced('§207', 'Permitted 1 dwelling unit per 600 square feet of lot area; may exceed this limit for BMR units, affordable housing, or other special uses (§209.1(m)). With a conditional use permit density may exceed 1 unit per 600 and is then limited by height, bulk and unit mix requirements.'),
      min_lot: sourced('§121', 'Width: 25 ft.; Area: 2500 sq.ft.'),
      open_space: sourced('§135', '100 sq.ft. per unit if all private; common space substituted must be 1/3 greater.'),
      principal_uses: sourced('§§209–209.9', 'Neighborhood serving commercial uses permitted on corner lots only. Limit 1,200 gross sq.ft. total per corner; NC-1 rules generally apply. Residential care facility for 6 or fewer; child care facility for 12 or fewer; open space for horticulture or passive recreation; public structure or use of non-industrial character; sale or lease sign'),
      conditional_uses: sourced('§§209–209.9', 'Community facilities'),
      front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
      rear_yard: sourced('§134', '45% of lot depth, except of reductions based upon average of adjacent buildings; if averaged, last 10 ft. is limited to height of 30 ft. and a minimum of 25% of lot depth, but no less than 15 feet.'),
      dwelling_unit_mix: sourced('§207.6', 'Minimum dwelling unit mix – 40% 2-bedroom for buildings with 5 or more units.'),
      parking: sourced('§151.1', 'No residential parking required; Permitted 3 spaces for every 4 units maximum; conditional use for 1 space per unit. Not permitted above.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
      document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
    },
  },

  'WMUG': {
    code: 'WMUG',
    name: 'WSoMa Mixed Use — General',
    classification: sourced('§839', 'WMUG - WSOMA MIXED USE-GENERAL DISTRICT'),
    verified: true,
    density: { model: 'form-based', note: 'Form-Based Density.' },
    far_non_residential: {
      basis: 'per §124, by height district',
      note: 'FAR based on permitted height, see Section 124 for more information. For Office Uses minimum intensities may apply pursuant to § 207.9.',
    },
    principal_uses: [
      'Agricultural Uses',
      'Arts Activities',
      'Open Recreation Area',
      'Light Manufacturing',
      'Institutional Uses',
      'Retail Sales and Service Uses',
      'Adult Sex Venue',
      'Non-Retail Sales and Service',
      'Public Transportation Facility',
      'Reproductive Health Clinic',
    ],
    conditional_uses: [
      'Automotive Uses',
      'Entertainment, Arts and Recreation Uses',
      'Entertainment, General',
      'Post-Secondary Educational Institution',
      'Massage Establishment',
      'Wireless Telecommunications Services Facility',
    ],
    dwelling_unit_mix_text: 'Generally required for creation of five or more Dwelling Units. At least 40% of all Dwelling Units must contain two or more bedrooms or 30% of all Dwelling Units must contain three or more bedrooms.',
    parking_text: 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required per § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more per § 166.',
    source: {
      density: sourced('§207', 'Form-Based Density.'),
      far_non_residential: sourced('§124', 'FAR based on permitted height, see Section 124 for more information. For Office Uses minimum intensities may apply pursuant to § 207.9.'),
      principal_uses: sourced('§839', 'Agricultural Uses* … P; Arts Activities … P; Open Recreation Area … P; Light Manufacturing … P; Institutional Uses … P; Retail Sales and Service Uses* … P(5); Adult Sex Venue … P(7); Non-Retail Sales and Service* … P; Public Transportation Facility … P; Reproductive Health Clinic … P.'),
      conditional_uses: sourced('§839', 'Automotive Uses* … P(4); Entertainment, Arts and Recreation Uses* … C; Entertainment, General … C(8); Post-Secondary Educational Institution … C(1); Massage Establishment … C; Wireless Telecommunications Services Facility … C(2).'),
      dwelling_unit_mix: sourced('§207.6', 'Generally required for creation of five or more Dwelling Units. At least 40% of all Dwelling Units must contain two or more bedrooms or 30% of all Dwelling Units must contain three or more bedrooms.'),
      parking: sourced('§151.1', 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required per § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more per § 166.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 8 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-70715',
    },
  },

  'UMU': {
    code: 'UMU',
    name: 'Urban Mixed Use',
    classification: sourced('§838', 'UMU - URBAN MIXED USE DISTRICT'),
    verified: true,
    density: { model: 'form-based', note: 'Form-Based Density.' },
    far_non_residential: {
      basis: 'per §124, by height district',
      note: 'Section 124 sets forth Basic FAR based on height. For Office Uses minimum intensities may apply pursuant to § 207.9.',
    },
    principal_uses: [
      'Agricultural Uses',
      'Automotive Uses',
      'Entertainment, Arts and Recreation Uses',
      'Movie Theater',
      'Light Manufacturing',
      'Institutional Uses',
      'Retail Sales and Service Uses',
      'Non-Retail Sales and Service',
      'Office Uses',
      'Public Transportation Facility',
      'Reproductive Health Clinic',
    ],
    conditional_uses: [
      'Post-Secondary Educational Institution',
      'Adult Business',
      'Adult Sex Venue',
      'Wireless Telecommunications Services Facility',
    ],
    dwelling_unit_mix_text: 'At least 40% of all Dwelling Units must contain two or more bedrooms or 30% of all Dwelling Units must contain three or more bedrooms.',
    parking_text: 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required by § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more as set forth in § 166.',
    source: {
      density: sourced('§207', 'Form-Based Density.'),
      far_non_residential: sourced('§124', 'Section 124 sets forth Basic FAR based on height. For Office Uses minimum intensities may apply pursuant to § 207.9.'),
      principal_uses: sourced('§838', 'Agricultural Uses … P; Automotive Uses* … P; Entertainment, Arts and Recreation Uses* … P; Movie Theater … P, up to three screens; Light Manufacturing … P; Institutional Uses … P; Retail Sales and Service Uses* … P(2); Non-Retail Sales and Service* … P; Office Uses … P(4); Public Transportation Facility … P.'),
      conditional_uses: sourced('§838', 'Post-Secondary Educational Institution … C; Adult Business … C; Adult Sex Venue … C; Wireless Telecommunications Services Facility … C.'),
      dwelling_unit_mix: sourced('§207.6', 'At least 40% of all Dwelling Units must contain two or more bedrooms or 30% of all Dwelling Units must contain three or more bedrooms.'),
      parking: sourced('§151.1', 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required by § 155.2. If car parking is provided, car share spaces are required when a project has 50 units or more as set forth in § 166.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 8 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-67810',
    },
  },

  'WMUO': {
    code: 'WMUO',
    name: 'WSoMa Mixed Use — Office',
    classification: sourced('§840', 'WMUO - WSOMA MIXED USE-OFFICE DISTRICT'),
    verified: true,
    // Office-only district: the §840 table shows Dwelling Units "NP"
    // (§ 102); residential uses are not permitted, so there is no
    // form-based dwelling-unit density row.
    density: { model: 'form-based', note: 'Residential uses not permitted' },
    far_non_residential: {
      basis: 'per §124, by height district',
      note: 'Section 124 sets forth the Basic FAR based on height. For Office Uses minimum intensities may apply pursuant to § 207.9.',
    },
    principal_uses: [
      'Agricultural Uses',
      'Automotive Uses',
      'Entertainment, Arts and Recreation Uses',
      'Movie Theater',
      'Light Manufacturing',
      'Institutional Uses',
      'Retail Sales and Service Uses',
      'Adult Sex Venue',
      'Hotel',
      'Non-Retail Sales and Service',
      'Public Transportation Facility',
      'Reproductive Health Clinic',
    ],
    conditional_uses: [
      'Post-Secondary Educational Institution',
      'Wireless Telecommunications Services Facility',
    ],
    parking_text: 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required by § 155.2. If car parking is provided, car share spaces are required when a project has 25 parking spaces or more as set forth in § 166.',
    controls_note: 'Office-only WSoMa district — Dwelling Units Not Permitted (§ 102, NP); no residential density or unit-mix controls apply.',
    source: {
      density: sourced('§207', 'Dwelling Units … § 102 … NP'),
      far_non_residential: sourced('§124', 'Section 124 sets forth the Basic FAR based on height. For Office Uses minimum intensities may apply pursuant to § 207.9.'),
      principal_uses: sourced('§840', 'Agricultural Uses … P; Automotive Uses* … P(8); Entertainment, Arts and Recreation Uses* … P; Movie Theater … P, up to three screens; Light Manufacturing … P; Institutional Uses … P; Retail Sales and Service Uses* … P(6)(7); Adult Sex Venue … P; Hotel … P up to 75 rooms; Non-Retail Sales and Service* … P; Public Transportation Facility … P.'),
      conditional_uses: sourced('§840', 'Post-Secondary Educational Institution … C; Wireless Telecommunications Services Facility … C(2).'),
      parking: sourced('§151.1', 'No car parking required. Maximum permitted as set forth in § 151.1 . Bike parking required by § 155.2. If car parking is provided, car share spaces are required when a project has 25 parking spaces or more as set forth in § 166.'),
      retrieved_at: '2026-05-31',
      document: 'SF Planning Code — Article 8 (amlegal, latest)',
      document_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-67836',
    },
  },
}

export function getZoningRecord(code: string): ZoningRecord | undefined {
  return ZONING_RULES[code]
}
