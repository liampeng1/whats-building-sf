// Zoom thresholds for the pin / cluster opacity crossfade.
// Below PIN_FADE_MIN the choropleth is the primary visualization; above
// PIN_FADE_MAX individual pins dominate. Between the two, both layers render
// with a smooth ramp so there's no abrupt swap.
export const PIN_FADE_MIN = 13.5
export const PIN_FADE_MAX = 14.5

/** Pins fade in across the zoom band (0 → 1). */
export function pinOpacity(zoom: number): number {
  if (zoom <= PIN_FADE_MIN) return 0
  if (zoom >= PIN_FADE_MAX) return 1
  return (zoom - PIN_FADE_MIN) / (PIN_FADE_MAX - PIN_FADE_MIN)
}

/** Mirror of pinOpacity — clusters fade out as pins fade in (1 → 0). */
export function clusterOpacity(zoom: number): number {
  if (zoom <= PIN_FADE_MIN) return 1
  if (zoom >= PIN_FADE_MAX) return 0
  return 1 - (zoom - PIN_FADE_MIN) / (PIN_FADE_MAX - PIN_FADE_MIN)
}
