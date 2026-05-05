/**
 * Shared brand mark for OG / share images. The "rising bars" silhouette is
 * the visual story of the site (buildings going up across SF) — we use the
 * same shape as the construction stage glyph but in ink navy instead of
 * terracotta so it reads as a brand element, not a stage indicator.
 */
const BRAND_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1c2438"/><rect x="6" y="12" width="2.6" height="5.5" fill="#fbf6ec"/><rect x="10.7" y="9.5" width="2.6" height="8" fill="#fbf6ec"/><rect x="15.4" y="7" width="2.6" height="10.5" fill="#fbf6ec"/></svg>`

export const BRAND_LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(BRAND_LOGO_SVG)}`
