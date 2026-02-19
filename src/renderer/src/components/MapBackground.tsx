import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import droneIconSvg from '@renderer/assets/drone_icon.svg'

const CesiumMap = lazy(() =>
  import('./map/CesiumMap').then((m) => ({ default: m.CesiumMap }))
)

// 128×128 icon: drone body center at (64,64) = anchor point
// Matches CesiumMap's billboard center → 2D/3D positions align
const createDroneIcon = (heading: number) =>
  L.divIcon({
    html: `
      <div style="width:128px;height:184px;transform:rotate(${heading}deg);transform-origin:64px 92px;position:relative;">
        <!-- Heading line: y=2→48 (46px), 기체 앞쪽으로 뻗음 -->
        <div style="position:absolute;left:63px;top:2px;width:2px;height:46px;background:linear-gradient(to bottom,#FFB060,#E87020);border-radius:1px;box-shadow:0 0 5px rgba(255,176,96,0.5);"></div>
        <!-- Drone SVG: y=50→133 (83px tall), body center y=91.5≈92 -->
        <img src="${droneIconSvg}" style="position:absolute;left:0;top:50px;width:128px;height:83px;display:block;" draggable="false"/>
      </div>
    `,
    iconSize: [128, 184],
    iconAnchor: [64, 92],
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
  const [cesiumCenter, setCesiumCenter] = useState<{ lon: number; lat: number; zoom: number } | null>(null)
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
            <CesiumMap initialCenter={cesiumCenter} />
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
          onClick={() => {
            const map = mapInstanceRef.current
            if (map) {
              const c = map.getCenter()
              setCesiumCenter({ lon: c.lng, lat: c.lat, zoom: map.getZoom() })
            }
            setMapMode('3d')
          }}
          style={btnStyle(mapMode === '3d')}
        >
          3D
        </button>
      </div>
    </div>
  )
}
