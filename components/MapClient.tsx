'use client'
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('./Map'), { ssr: false })

interface Props {
  initialCenter: [number, number]
}

export default function MapClient({ initialCenter }: Props) {
  return <Map initialCenter={initialCenter} />
}
