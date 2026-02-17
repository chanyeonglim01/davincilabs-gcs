import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

const DRONE_ICON = L.divIcon({
  html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="4" fill="#ECDFCC"/>
    <circle cx="12" cy="12" r="8" stroke="#ECDFCC" stroke-width="1.5" stroke-opacity="0.5" fill="none"/>
    <line x1="12" y1="0" x2="12" y2="6" stroke="#ECDFCC" stroke-width="1.5"/>
    <line x1="12" y1="18" x2="12" y2="24" stroke="#ECDFCC" stroke-width="1.5"/>
    <line x1="0" y1="12" x2="6" y2="12" stroke="#ECDFCC" stroke-width="1.5"/>
    <line x1="18" y1="12" x2="24" y2="12" stroke="#ECDFCC" stroke-width="1.5"/>
  </svg>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: ''
})

export function MapBackground() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const { telemetry } = useTelemetryStore()

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      center: [37.5665, 126.978],
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map)

    const marker = L.marker([37.5665, 126.978], { icon: DRONE_ICON }).addTo(map)

    mapInstanceRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  // Update marker when position changes
  useEffect(() => {
    if (!telemetry || !markerRef.current) return
    const { lat, lon } = telemetry.position
    if (lat === 0 && lon === 0) return
    markerRef.current.setLatLng([lat, lon])
  }, [telemetry?.position?.lat, telemetry?.position?.lon])

  return (
    <div
      ref={mapRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        background: '#181C14'
      }}
    />
  )
}
