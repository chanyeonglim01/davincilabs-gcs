import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

const createDroneIcon = (heading: number) =>
  L.divIcon({
    html: `
      <div style="width:72px;height:72px;transform:rotate(${heading}deg);transform-origin:center;filter:drop-shadow(0 0 6px rgba(236,223,204,0.6));">
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Fuselage -->
          <ellipse cx="36" cy="36" rx="4" ry="17" fill="#ECDFCC"/>
          <!-- Main swept wings -->
          <path d="M36 30 L4 42 L5 46 L36 37 L67 46 L68 42 Z" fill="#ECDFCC" fill-opacity="0.9"/>
          <!-- Canard (front wings) -->
          <path d="M36 20 L22 25 L22 28 L36 23 L50 28 L50 25 Z" fill="#ECDFCC" fill-opacity="0.7"/>
          <!-- Tail fin -->
          <path d="M36 50 L27 62 L29 63 L36 53 L43 63 L45 62 Z" fill="#ECDFCC" fill-opacity="0.65"/>
          <!-- Nose tip -->
          <circle cx="36" cy="18" r="3" fill="#ECDFCC"/>
          <!-- Engine center ring -->
          <circle cx="36" cy="36" r="6" fill="#181C14" stroke="#ECDFCC" stroke-width="1.5" stroke-opacity="0.8"/>
          <circle cx="36" cy="36" r="2.5" fill="#ECDFCC"/>
        </svg>
      </div>
    `,
    iconSize: [72, 72],
    iconAnchor: [36, 36],
    className: ''
  })

const TILES: Record<string, { url: string; maxZoom: number; subdomains?: string }> = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 19,
    subdomains: 'abcd'
  }
}

type TileMode = 'dark' | 'satellite'

export function MapBackground() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const [tileMode, setTileMode] = useState<TileMode>('satellite')
  const { telemetry } = useTelemetryStore()

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      center: [37.5665, 126.978],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    })

    const tileLayer = L.tileLayer(TILES.satellite.url, {
      maxZoom: TILES.satellite.maxZoom
    }).addTo(map)

    // Force Leaflet to recalculate container size
    setTimeout(() => map.invalidateSize(), 100)
    const marker = L.marker([37.5665, 126.978], { icon: createDroneIcon(0) }).addTo(map)

    mapInstanceRef.current = map
    markerRef.current = marker
    tileLayerRef.current = tileLayer

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      tileLayerRef.current = null
    }
  }, [])

  // Switch tile layer
  useEffect(() => {
    if (!tileLayerRef.current || !mapInstanceRef.current) return
    const { url, maxZoom, subdomains } = TILES[tileMode]
    tileLayerRef.current.setUrl(url)
    tileLayerRef.current.options.maxZoom = maxZoom
    if (subdomains) tileLayerRef.current.options.subdomains = subdomains
    mapInstanceRef.current.invalidateSize()
  }, [tileMode])

  // Update marker position + heading rotation
  useEffect(() => {
    if (!telemetry || !markerRef.current) return
    const { lat, lon } = telemetry.position
    if (lat === 0 && lon === 0) return
    markerRef.current.setLatLng([lat, lon])
    markerRef.current.setIcon(createDroneIcon(telemetry.heading ?? 0))
  }, [telemetry?.position?.lat, telemetry?.position?.lon, telemetry?.heading])

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <div
        ref={mapRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#181C14' }}
      />

      {/* Tile mode toggle */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 1050,
          display: 'flex',
          gap: '4px'
        }}
      >
        {(['satellite', 'dark'] as TileMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setTileMode(mode)}
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '9px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              padding: '5px 10px',
              border: `1px solid ${tileMode === mode ? 'rgba(236,223,204,0.5)' : 'rgba(236,223,204,0.15)'}`,
              borderRadius: '3px',
              background: 'rgba(24, 28, 20, 0.85)',
              color: tileMode === mode ? '#ECDFCC' : 'rgba(236,223,204,0.35)',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.15s ease'
            }}
          >
            {mode === 'satellite' ? 'SAT' : 'MAPS'}
          </button>
        ))}
      </div>
    </div>
  )
}
