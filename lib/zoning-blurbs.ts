/** Per-gen editorial blurbs surfaced at the top of each district panel.
 *  Hand-curated; short and concrete. */
const BLURBS: Record<string, string> = {
  Residential:
    "Single-family and small-multi-unit zoning. About 38% of SF's land. State family-zoning laws (SB-9, ADU) most directly apply here.",
  'Mixed Use':
    "Commercial corridors that allow housing above ground-floor uses. Where most new infill happens in modern SF.",
  Commercial:
    "Office and retail districts. C-3 covers downtown; lower-density C-2 covers neighborhood spines.",
  Industrial:
    "Production / distribution / repair zones. Housing not permitted by right. Often the target of state by-right conversion bills.",
  Public:
    "Public uses — parks, schools, civic buildings. Controls per §211.",
  Other:
    "Special districts not in the standard zoning families. See district section.",
}

export function getZoningBlurb(gen: string): string {
  return BLURBS[gen] ?? ''
}
