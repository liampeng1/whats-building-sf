/** lowercased, hyphen-separated slug from human-readable text. Used by all
 *  transit-source fetchers to derive station/stop ids. */
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
