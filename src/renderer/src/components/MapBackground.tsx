import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

const CesiumMap = lazy(() =>
  import('./map/CesiumMap').then((m) => ({ default: m.CesiumMap }))
)

const createDroneIcon = (heading: number) =>
  L.divIcon({
    html: `
      <div style="width:96px;height:112px;transform:rotate(${heading}deg);transform-origin:48px 64px;">
        <svg width="96" height="112" viewBox="0 -16 96 112" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Heading line (orange, extends from nose upward) -->
          <line x1="48" y1="-14" x2="48" y2="20" stroke="#E87020" stroke-width="2.5" stroke-linecap="round"/>

          <!-- Dark outline for contrast on bright backgrounds -->
          <ellipse cx="48" cy="52" rx="6" ry="24" fill="#111" fill-opacity="0.5"/>
          <path d="M48 42 L4 60 L5 66 L48 53 L91 66 L92 60 Z" fill="#111" fill-opacity="0.4"/>

          <!-- Fuselage -->
          <ellipse cx="48" cy="52" rx="4.5" ry="22" fill="#FFFFFF"/>

          <!-- Main swept wings -->
          <path d="M48 42 L4 60 L5 65 L48 53 L91 65 L92 60 Z" fill="#FFFFFF" fill-opacity="0.92"/>
          <!-- Wing leading edge (subtle accent) -->
          <path d="M48 42 L4 60 L5 62 L48 44 Z" fill="#00CFFF" fill-opacity="0.5"/>
          <path d="M48 42 L92 60 L91 62 L48 44 Z" fill="#00CFFF" fill-opacity="0.5"/>

          <!-- Canards (front mini-wings) -->
          <path d="M48 31 L32 37 L32 40 L48 34 L64 40 L64 37 Z" fill="#FFFFFF" fill-opacity="0.75"/>

          <!-- Twin tail fins -->
          <path d="M43 71 L35 84 L38 85 L46 73 Z" fill="#FFFFFF" fill-opacity="0.65"/>
          <path d="M53 71 L61 84 L58 85 L50 73 Z" fill="#FFFFFF" fill-opacity="0.65"/>

          <!-- Wing rotor pods -->
          <circle cx="7" cy="61" r="5.5" fill="#1a1a2a" stroke="#FFFFFF" stroke-width="1.5"/>
          <circle cx="89" cy="61" r="5.5" fill="#1a1a2a" stroke="#FFFFFF" stroke-width="1.5"/>

          <!-- Center engine ring -->
          <circle cx="48" cy="52" r="7" fill="#1a1a2a" stroke="#FFFFFF" stroke-width="1.8"/>
          <circle cx="48" cy="52" r="3" fill="#00CFFF"/>

          <!-- Nose -->
          <ellipse cx="48" cy="29" rx="3" ry="3.5" fill="#00CFFF"/>
        </svg>
      </div>
    `,
    iconSize: [96, 112],
    iconAnchor: [48, 64],
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
type MapMode = '2d' | '3d'

export function MapBackground() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const [tileMode, setTileMode] = useState<TileMode>('satellite')
  const [mapMode, setMapMode] = useState<MapMode>('2d')
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

  // Restore Leaflet size when switching back to 2D
  useEffect(() => {
    if (mapMode === '2d' && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100)
    }
  }, [mapMode])

  // Update marker position + heading rotation
  useEffect(() => {
    if (!telemetry || !markerRef.current) return
    const { lat, lon } = telemetry.position
    if (lat === 0 && lon === 0) return
    markerRef.current.setLatLng([lat, lon])
    markerRef.current.setIcon(createDroneIcon(telemetry.heading ?? 0))
  }, [telemetry?.position?.lat, telemetry?.position?.lon, telemetry?.heading])

  const btnStyle = (active: boolean) => ({
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '9px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    padding: '5px 10px',
    border: `1px solid ${active ? 'rgba(236,223,204,0.5)' : 'rgba(236,223,204,0.15)'}`,
    borderRadius: '3px',
    background: 'rgba(24, 28, 20, 0.85)',
    color: active ? '#ECDFCC' : 'rgba(236,223,204,0.35)',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    transition: 'all 0.15s ease'
  })

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      {/* 2D Leaflet map */}
      <div
        ref={mapRef}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          background: '#181C14',
          display: mapMode === '2d' ? 'block' : 'none'
        }}
      />

      {/* 3D Cesium map */}
      {mapMode === '3d' && (
        <Suspense
          fallback={
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#181C14',
              color: 'rgba(236,223,204,0.4)',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '11px',
              letterSpacing: '0.1em'
            }}>
              LOADING 3D...
            </div>
          }
        >
          <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <CesiumMap />
          </div>
        </Suspense>
      )}

      {/* Map controls */}
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
        <button
          onClick={() => { setMapMode('2d'); setTileMode('satellite') }}
          style={btnStyle(mapMode === '2d' && tileMode === 'satellite')}
        >
          SAT
        </button>
        <button
          onClick={() => { setMapMode('2d'); setTileMode('dark') }}
          style={btnStyle(mapMode === '2d' && tileMode === 'dark')}
        >
          2D
        </button>
        <button
          onClick={() => setMapMode('3d')}
          style={btnStyle(mapMode === '3d')}
        >
          3D
        </button>
      </div>
    </div>
  )
}
