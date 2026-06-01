'use client'
import { GeoJSON } from 'react-leaflet'
import { useEffect, useState } from 'react'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import type { TransitTier } from '@/lib/cross-stats'
import {
  TIER_COLORS,
  TIER_LABELS,
  tierFillOpacity,
} from '@/lib/transit-tiers-style'

/**
 * Heat-map style transit-access layer. Renders the four pre-dissolved
 * tier polygons from /transit-tiers.geojson as the base fill in transit
 * mode — drawn *under* TransitCorridors + StationMarkers so the lines and
 * stops still read on top.
 *
 * Color encodes the access level (rail / rapid-bus / local-bus / poor);
 * opacity encodes access quality (strongest darkest). Selecting a tier
 * brightens it and dims the rest (see tierFillOpacity).
 */

interface TierProps {
  tier: TransitTier
}

type TierGeo = FeatureCollection<Polygon | MultiPolygon, TierProps>

interface Props {
  selectedTier?: TransitTier | null
  onSelect?: (tier: TransitTier) => void
}

export function TransitTierOverlay({ selectedTier = null, onSelect }: Props = {}) {
  const [geo, setGeo] = useState<TierGeo | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/transit-tiers.geojson', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TierGeo | null) => {
        if (data && data.type === 'FeatureCollection' && data.features?.length) {
          setGeo(data)
        }
      })
      .catch(() => {
        // Non-essential overlay — degrade silently if the fetch fails.
      })
    return () => ctrl.abort()
  }, [])

  if (!geo) return null

  return (
    <GeoJSON
      // Re-mount when the selection changes so the style() callback re-runs
      // and the highlight/dim re-applies across all four polygons.
      key={`transit-tiers-${selectedTier ?? 'none'}`}
      data={geo}
      style={(feature) => {
        const tier = (feature?.properties as TierProps | undefined)?.tier ?? 'poor'
        const color = TIER_COLORS[tier]
        const isSel = selectedTier != null && tier === selectedTier
        return {
          fillColor: color,
          fillOpacity: tierFillOpacity(tier, selectedTier),
          color,
          weight: isSel ? 1.6 : 0.5,
          opacity: isSel ? 1 : selectedTier != null ? 0.2 : 0.5,
          interactive: true,
        }
      }}
      onEachFeature={(feature, layer) => {
        const tier = (feature.properties as TierProps)?.tier
        if (!tier) return
        layer.bindTooltip(TIER_LABELS[tier], {
          sticky: true,
          direction: 'top',
          className: 'nhood-tooltip',
          opacity: 1,
        })
        if (onSelect) {
          layer.on({ click: () => onSelect(tier) })
        }
      }}
    />
  )
}
