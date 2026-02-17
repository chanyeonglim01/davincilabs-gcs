import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

const createDroneIcon = (heading: number) =>
  L.divIcon({
    html: `
      <div style="width:40px;height:40px;transform:rotate(${heading}deg);transform-origin:center;">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Fuselage -->
          <ellipse cx="20" cy="20" rx="2.5" ry="10" fill="#ECDFCC"/>
          <!-- Main swept wings -->
          <path d="M20 17 L3 24 L3.5 26 L20 21 L36.5 26 L37 24 Z" fill="#ECDFCC" fill-opacity="0.85"/>
          <!-- Canard (front wings) -->
          <path d="M20 12 L12 15 L12 16.5 L20 14 L28 16.5 L28 15 Z" fill="#ECDFCC" fill-opacity="0.65"/>
          <!-- Tail fin -->
          <path d="M20 28 L15 35 L16.5 35.5 L20 30 L23.5 35.5 L25 35 Z" fill="#ECDFCC" fill-opacity="0.6"/>
          <!-- Nose tip -->
          <circle cx="20" cy="10" r="1.8" fill="#ECDFCC"/>
          <!-- Engine center ring -->
          <circle cx="20" cy="20" r="3.5" fill="#181C14" stroke="#ECDFCC" stroke-width="1" stroke-opacity="0.7"/>
          <circle cx="20" cy="20" r="1.2" fill="#ECDFCC"/>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    className: ''
  })

const TILES: Record<string, { url: string; maxZoom: number; tms?: boolean }> = {
  satellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    maxZoom: 20
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 19
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
      maxZoom: TILES.satellite.maxZoom,
      subdomains: ['0', '1', '2', '3'],
      crossOrigin: true
    }).addTo(map)
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
    if (!tileLayerRef.current) return
    const { url, maxZoom } = TILES[tileMode]
    tileLayerRef.current.setUrl(url)
    tileLayerRef.current.options.maxZoom = maxZoom
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
          zIndex: 10,
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
            {mode === 'satellite' ? 'SAT' : 'DARK'}
          </button>
        ))}
      </div>
    </div>
  )
}
