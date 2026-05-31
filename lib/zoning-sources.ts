/** Verified amlegal opaque-ID map for SF Planning Code sections. Each ID was
 *  confirmed by loading the page and matching its title to the section number.
 *  See docs/superpowers/specs/2026-05-31-zoning-rules-verified-data-design.md §D. */
export interface CodeCitation {
  section: string   // e.g. "§207"
  url: string
  quote: string     // verbatim source sentence (may be "" for legacy/unverified)
  article?: string  // legacy field, retained for old records
}

const AMLEGAL = 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning'

// section → amlegal opaque ID (full "0-0-0-<n>" form).
// Every id below was verified by navigating to the page and confirming its
// rendered title contains the section number (Task 1, Step 2).
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
  '§206.1': '0-0-0-19918',  // SEC. 206.1. PURPOSE AND FINDINGS. (see note below)
  '§206.2': '0-0-0-19926',  // SEC. 206.2. DEFINITIONS. (see note below)
  '§206.3': '0-0-0-19933',  // SEC. 206.3. HOUSING OPPORTUNITIES MEAN EQUITY … (see note below)
  '§206.4': '0-0-0-63354',  // SEC. 206.4. THE 100 PERCENT AFFORDABLE HOUSING BONUS … (see note below)
  '§207': '0-0-0-19952',    // SEC. 207. DWELLING UNIT DENSITY LIMITS.
  '§207.6': '0-0-0-20016',  // SEC. 207.6. REQUIRED MINIMUM DWELLING UNIT MIX …
  '§209.1': '0-0-0-20077',  // SEC. 209.1. RH (RESIDENTIAL, HOUSE) DISTRICTS.
  '§209.2': '0-0-0-56337',  // SEC. 209.2. RM (RESIDENTIAL, MIXED) DISTRICTS.
  '§§209–209.9': '0-0-0-20077', // range anchor → §209.1 (per Task 1 Step 2)
  // Article 2.5 — Height and Bulk Districts
  '§261': '0-0-0-21499',    // SEC. 261. ADDITIONAL HEIGHT LIMITS APPLICABLE TO CERTAIN RH …
  // Article 8 — Mixed Use Districts
  '§813': '0-0-0-26741',    // SEC. 813. [REDESIGNATED.] (see note below)
}

// NOTE (semantic mismatch, flagged in Task 1 report):
//   The source table is the SF Planning rev-09/2008 residential summary; the
//   *current* amlegal code has been renumbered. The opaque IDs above resolve to
//   the section NUMBER cited (the page title matches), but a few sections no
//   longer carry the content the 2008 table implies:
//     • §206.1–§206.4 are now Affordable/Educator Housing program sections, not
//       the RH/RM/RC/RTO district definitions (those live at §209.1/§209.2/…).
//     • §813 is "[REDESIGNATED.]" (the RED district controls moved elsewhere).
//   Downstream tasks should prefer §209.x for district definitions where possible.

/** Build a verified citation: real amlegal URL + verbatim quote.
 *  IDs are stored with their full `0-0-0-<n>` form, so the URL is a plain join. */
export function sourced(section: string, quote: string): CodeCitation {
  const id = SECTION_URL[section]
  return { section, quote, url: id ? `${AMLEGAL}/${id}` : AMLEGAL }
}
