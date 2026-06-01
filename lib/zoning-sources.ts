/** Verified amlegal opaque-ID map for SF Planning Code sections. Each ID was
 *  confirmed by loading the page and matching its title to the section number.
 *  See docs/superpowers/specs/2026-05-31-zoning-rules-verified-data-design.md §D. */
export interface CodeCitation {
  section: string   // e.g. "§207"
  url: string
  quote: string     // verbatim source sentence (may be "" for legacy/unverified)
  article?: string  // forward-compat: old zoning-rules `cite()` records set this;
                    // lets those records adopt this shared type in Task 2.
}

const AMLEGAL = 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning'

// section → amlegal opaque ID (full "0-0-0-<n>" form).
// Every id below was verified by navigating to the page and confirming its
// rendered title contains the section number (Task 1, Step 2).
//
// NOTE — residential district CLASSIFICATION citations must use the §209.x
// series (and §834 for RED), NOT the stale 2008 numbers:
//   RH  → §209.1 (0-0-0-20077)   RM  → §209.2 (0-0-0-56337)
//   RC  → §209.3 (0-0-0-20083)   RTO → §209.4 (0-0-0-20086)
//   RED → §834   (0-0-0-67758)   ("RED - RESIDENTIAL ENCLAVE DISTRICT.")
// The 2008 source table's §206.1–§206.4 / §813 numbers now hold unrelated
// content (affordable-housing programs; §813 is [REDESIGNATED.] → §834).
export const SECTION_URL: Record<string, string> = {
  // Article 1.2 — Dimensions, Areas, and Open Spaces
  '§121': '0-0-0-17998',    // SEC. 121. MINIMUM LOT WIDTH AND AREA.
  '§124': '0-0-0-18102',    // SEC. 124. BASIC FLOOR AREA RATIO.
  '§132': '0-0-0-62918',    // SEC. 132. FRONT SETBACK AREAS IN RTO, RH, AND RM DISTRICTS …
  '§134': '0-0-0-18322',    // SEC. 134. REAR YARDS IN R, RC, RTO, NC, M … DISTRICTS.
  '§135': '0-0-0-18381',    // SEC. 135. USABLE OPEN SPACE FOR DWELLING UNITS AND GROUP HOUSING.
  // Article 1.5 — Transportation, Off-Street Parking, and Loading
  '§151.1': '0-0-0-18850',  // SEC. 151.1. SCHEDULE OF PERMITTED ACCESSORY OFF-STREET PARKING …
  // Article 2 — Use Districts
  '§207': '0-0-0-19952',    // SEC. 207. DWELLING UNIT DENSITY LIMITS.
  '§207.6': '0-0-0-20016',  // SEC. 207.6. REQUIRED MINIMUM DWELLING UNIT MIX …
  // Residential district CLASSIFICATION — current §209.x series + §834 (RED).
  '§209.1': '0-0-0-20077',  // SEC. 209.1. RH (RESIDENTIAL, HOUSE) DISTRICTS.
  '§209.2': '0-0-0-56337',  // SEC. 209.2. RM (RESIDENTIAL, MIXED) DISTRICTS.
  '§209.3': '0-0-0-20083',  // SEC. 209.3. RC (RESIDENTIAL-COMMERCIAL) DISTRICTS.
  '§209.4': '0-0-0-20086',  // SEC. 209.4. RTO (RESIDENTIAL TRANSIT ORIENTED) DISTRICTS.
  '§834': '0-0-0-67758',    // SEC. 834. RED - RESIDENTIAL ENCLAVE DISTRICT. (current home of old §813)
  '§§209–209.9': '0-0-0-20077', // range anchor → §209.1 (per Task 1 Step 2)
  // Article 2.5 — Height and Bulk Districts
  '§261': '0-0-0-21499',    // SEC. 261. ADDITIONAL HEIGHT LIMITS APPLICABLE TO CERTAIN RH …
  // Stale 2008 numbering — do NOT use for district classification; use the §209.x series above.
  '§206.1': '0-0-0-19918',  // SEC. 206.1. PURPOSE AND FINDINGS. (now Affordable Housing program)
  '§206.2': '0-0-0-19926',  // SEC. 206.2. DEFINITIONS. (now Affordable Housing program)
  '§206.3': '0-0-0-19933',  // SEC. 206.3. HOUSING OPPORTUNITIES MEAN EQUITY … (now Affordable Housing program)
  '§206.4': '0-0-0-63354',  // SEC. 206.4. THE 100 PERCENT AFFORDABLE HOUSING BONUS …
  // Article 8 — Mixed Use Districts
  '§813': '0-0-0-26741',    // SEC. 813. [REDESIGNATED.] → RED controls now at §834.
  // Commercial / Industrial / Public (Phase 2) — all titles re-confirmed via the
  // amlegal /api/render-section endpoint (Task 1, Step 2).
  '§210.1': '0-0-0-20117',  // SEC. 210.1. C-2 DISTRICTS: COMMUNITY BUSINESS.
  '§210.2': '0-0-0-20120',  // SEC. 210.2. C-3 DISTRICTS: DOWNTOWN COMMERCIAL.
  '§210.3': '0-0-0-20123',  // SEC. 210.3. PDR DISTRICTS.
  '§210.4': '0-0-0-20132',  // SEC. 210.4. M DISTRICTS: INDUSTRIAL.
  '§123': '0-0-0-18094',    // SEC. 123. MAXIMUM FLOOR AREA RATIO.
  '§211': '0-0-0-50175',    // SEC. 211. P (PUBLIC) DISTRICTS.
  '§211.1': '0-0-0-50178',  // SEC. 211.1. PRINCIPAL USES PERMITTED, P DISTRICTS.
  '§211.2': '0-0-0-50182',  // SEC. 211.2. CONDITIONAL USES, P DISTRICTS.
  '§836': '0-0-0-67785',    // SEC. 836. SALI - SERVICE/ARTS/LIGHT INDUSTRIAL DISTRICT.
  '§202.1': '0-0-0-49715',  // SEC. 202.1. ZONING CONTROL TABLES. (reading key)
  '§207.7': '0-0-0-56190',  // SEC. 207.7. REQUIRED MINIMUM DWELLING UNIT MIX. (commercial 25%/10% rule)
  // §208 — cited by some Mixed-Use density rows for group/form-based density.
  // NOTE: the prior-POC expected title "Density of Dwelling Units in RC, NC, C, M,
  // MU and other districts" is STALE (2008 numbering). The CURRENT §208 page is
  // titled "DENSITY LIMITATIONS FOR GROUP HOUSING OR HOMELESS SHELTERS" — section
  // number matches, but content scope differs; use with care. (Task 1, Step 1.)
  '§208': '0-0-0-20056',    // SEC. 208. DENSITY LIMITATIONS FOR GROUP HOUSING OR HOMELESS SHELTERS.
  // Mixed-Use Art. 8 (Phase 3) — all titles confirmed via /api/render-section.
  '§830': '0-0-0-67565',    // SEC. 830. CMUO - CENTRAL SOMA MIXED USE-OFFICE DISTRICT.
  '§831': '0-0-0-67718',    // SEC. 831. MUG - MIXED USE-GENERAL DISTRICT.
  '§832': '0-0-0-67732',    // SEC. 832. MUO - MIXED USE-OFFICE DISTRICT.
  '§833': '0-0-0-67745',    // SEC. 833. MUR - MIXED USE-RESIDENTIAL DISTRICT.
  '§835': '0-0-0-67772',    // SEC. 835. RED-MX - RESIDENTIAL ENCLAVE-MIXED DISTRICT.
  '§838': '0-0-0-67810',    // SEC. 838. UMU - URBAN MIXED USE DISTRICT.
  '§839': '0-0-0-70715',    // SEC. 839. WMUG - WSOMA MIXED USE-GENERAL DISTRICT.
  '§840': '0-0-0-67836',    // SEC. 840. WMUO - WSOMA MIXED USE-OFFICE DISTRICT.
  // Neighborhood Commercial + Chinatown (Phase 4) — all titles confirmed via
  // /api/render-section (Task 1, Step 2).
  // Named NC districts (Art. 7).
  '§710': '0-0-0-25492',    // SEC. 710. NC-1 - NEIGHBORHOOD COMMERCIAL CLUSTER DISTRICT.
  '§711': '0-0-0-25507',    // SEC. 711. NC-2 - SMALL-SCALE NEIGHBORHOOD COMMERCIAL DISTRICT.
  '§712': '0-0-0-25522',    // SEC. 712. NC-3 - MODERATE-SCALE NEIGHBORHOOD COMMERCIAL DISTRICT.
  '§713': '0-0-0-25536',    // SEC. 713. NC-S - NEIGHBORHOOD COMMERCIAL SHOPPING CENTER DISTRICT.
  // Named NCT districts (Art. 7).
  '§750': '0-0-0-57016',    // SEC. 750. NCT-1 - NEIGHBORHOOD COMMERCIAL TRANSIT CLUSTER DISTRICT.
  '§751': '0-0-0-57028',    // SEC. 751. NCT-2 - SMALL-SCALE NEIGHBORHOOD COMMERCIAL TRANSIT DISTRICT.
  '§752': '0-0-0-57664',    // SEC. 752. NCT-3 - MODERATE-SCALE NEIGHBORHOOD COMMERCIAL TRANSIT DISTRICT.
  // Generic NCD / NCT umbrella — the bare-code districts have NO single dedicated
  // section. They are governed by §702 (classes) + §703 (requirements); cite the
  // closest applicable § when transcribing a bare NCD / NCT record.
  '§702': '0-0-0-25376',    // SEC. 702. CLASSES OF NEIGHBORHOOD COMMERCIAL DISTRICTS. (NCD/NCT umbrella)
  '§703': '0-0-0-25401',    // SEC. 703. NEIGHBORHOOD COMMERCIAL DISTRICT REQUIREMENTS. (generic NC controls)
  // RCD — RESOLVED: RCD = Regional Commercial District (§758, Art. 7), NOT a
  // Chinatown district. DataSF zoning_sim=RCD → districtna "REGIONAL COMMERCIAL";
  // amlegal §758 title "REGIONAL COMMERCIAL DISTRICT" matches. The Chinatown
  // theory was wrong (CRNC lives at §812, see below).
  '§758': '0-0-0-57126',    // SEC. 758. REGIONAL COMMERCIAL DISTRICT. (RCD)
  // Chinatown Mixed Use (Art. 8).
  '§810': '0-0-0-26704',    // SEC. 810. CHINATOWN COMMUNITY BUSINESS DISTRICT. (CCB)
  '§811': '0-0-0-26717',    // SEC. 811. CHINATOWN VISITOR RETAIL DISTRICT. (CVR)
  '§812': '0-0-0-26729',    // SEC. 812. CHINATOWN RESIDENTIAL NEIGHBORHOOD COMMERCIAL DISTRICT. (CRNC)
}

/** Build a verified citation: real amlegal URL + verbatim quote.
 *  IDs are stored with their full `0-0-0-<n>` form, so the URL is a plain join.
 *  Unknown sections degrade to the article-index root rather than a dead link;
 *  this is a soft fallback — the authoritative guard is the "every cited section
 *  resolves in SECTION_URL" invariant test, which fails the build on a real gap.
 *  We still warn in dev so an unmapped section never passes unnoticed. */
export function sourced(section: string, quote: string): CodeCitation {
  const id = SECTION_URL[section]
  if (!id && process.env.NODE_ENV !== 'production') {
    console.warn(`sourced(): no verified amlegal id for ${section} — using article root`)
  }
  return { section, quote, url: id ? `${AMLEGAL}/${id}` : AMLEGAL }
}
