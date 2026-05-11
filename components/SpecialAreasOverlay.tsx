'use client'
import { GeoJSON } from 'react-leaflet'
import { SPECIAL_ZONING_AREAS, type SpecialArea } from '@/lib/special-zoning-areas'
import type { FeatureCollection } from 'geojson'

interface Props {
  onSelect: (area: SpecialArea) => void
}

export function SpecialAreasOverlay({ onSelect }: Props) {
  const collection: FeatureCollection = {
    type: 'FeatureCollection',
    features: SPECIAL_ZONING_AREAS.map((a, i) => ({
      type: 'Feature',
      geometry: a.shape,
      properties: { idx: i, name: a.name },
    })),
  }

  return (
    <GeoJSON
      key="special-zoning-areas"
      data={collection}
      pathOptions={{ className: 'special-area-poly' }}
      style={{
        color: '#67615a',
        weight: 1,
        opacity: 0.7,
        fillColor: '#67615a',
        fillOpacity: 0.10,
      }}
      onEachFeature={(feature, layer) => {
        const idx = (feature.properties as { idx: number }).idx
        const area = SPECIAL_ZONING_AREAS[idx]
        layer.on({ click: () => onSelect(area) })
        layer.bindTooltip(area.name, {
          sticky: true,
          direction: 'top',
          className: 'nhood-tooltip',
        })
      }}
    />
  )
}
