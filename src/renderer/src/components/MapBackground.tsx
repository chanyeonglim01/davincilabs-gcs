import { useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import { useMissionStore } from '@renderer/store/missionStore'
import type { ActionKey } from '@renderer/store/missionStore'
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

const ACTION_COLORS: Record<ActionKey, string> = {
  VTOL_TAKEOFF: '#A5D6A7',
  VTOL_TRANSITION_FW: '#FFB74D',
  VTOL_TRANSITION_MC: '#FFB74D',
  VTOL_LAND: '#E87020',
  MC_TAKEOFF: '#80CBC4',
  MC_LAND: '#80CBC4',
  FW_TAKEOFF: '#CE93D8',
  FW_LAND: '#CE93D8',
  WAYPOINT: '#4FC3F7',
  LOITER: '#B39DDB',
  RTL: '#FF8A80'
}

type TileMode = 'dark' | 'satellite'
type MapMode = '2d' | '3d'

export function MapBackground() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)

  // Heading unwrap — delta 누적, 애니메이션 없음 (즉시 반영)
  const prevHeadingRef = useRef<number | null>(null)
  const accHeadingRef  = useRef(0)
  const [tileMode, setTileMode] = useState<TileMode>('satellite')
  const [mapMode, setMapMode] = useState<MapMode>('2d')
  const [cesiumCenter, setCesiumCenter] = useState<{ lon: number; lat: number; zoom: number } | null>(null)
  const { telemetry, history } = useTelemetryStore()
  const { waypoints } = useMissionStore()

  // Mission overlay refs
  const missionPolylineRef = useRef<L.Polyline | null>(null)
  const missionMarkersRef = useRef<L.Marker[]>([])

  // Drone trail ref
  const droneTrailRef = useRef<L.Polyline | null>(null)

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

  // Update marker position + heading (즉시 반영, 애니메이션 없음)
  useLayoutEffect(() => {
    if (!telemetry || !markerRef.current) return
    const { lat, lon } = telemetry.position
    if (lat === 0 && lon === 0) return
    markerRef.current.setLatLng([lat, lon])

    const raw = telemetry.heading ?? 0
    const el = markerRef.current.getElement()
    const rotDiv = el?.firstElementChild as HTMLElement | null

    // 첫 텔레메트리
    if (prevHeadingRef.current === null) {
      prevHeadingRef.current = raw
      accHeadingRef.current = raw
      if (rotDiv) {
        rotDiv.style.transition = 'none'  // HMR에서 잔여 transition 제거
        rotDiv.style.transform = `rotate(${raw}deg)`
      }
      return
    }

    // 최단 경로 delta
    const prev = prevHeadingRef.current
    let delta = raw - prev
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360

    prevHeadingRef.current = raw
    accHeadingRef.current += delta

    if (rotDiv) {
      rotDiv.style.transition = 'none'
      rotDiv.style.transform = `rotate(${accHeadingRef.current}deg)`
    }
  }, [telemetry?.position?.lat, telemetry?.position?.lon, telemetry?.heading])

  // Mission waypoint overlay
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clean up existing overlay
    if (missionPolylineRef.current) {
      missionPolylineRef.current.remove()
      missionPolylineRef.current = null
    }
    missionMarkersRef.current.forEach((m) => m.remove())
    missionMarkersRef.current = []

    if (waypoints.length === 0) return

    // Filter waypoints with valid coordinates for polyline
    const navPoints = waypoints.filter((w) => !(w.lat === 0 && w.lon === 0))

    // Draw polyline if 2+ navigable points
    if (navPoints.length >= 2) {
      const coords: L.LatLngExpression[] = navPoints.map((w) => [w.lat, w.lon])
      missionPolylineRef.current = L.polyline(coords, {
        color: 'rgba(79,195,247,0.75)',
        weight: 3,
        dashArray: '8 5',
        interactive: false
      }).addTo(map)
    }

    // Create markers for all waypoints
    const markers: L.Marker[] = waypoints.map((wp, seq) => {
      const color = ACTION_COLORS[wp.action]
      const icon = L.divIcon({
        html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid rgba(24,28,20,0.8);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;color:#181C14;">${seq + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: ''
      })
      return L.marker([wp.lat, wp.lon], { icon, interactive: false }).addTo(map)
    })
    missionMarkersRef.current = markers

    return () => {
      if (missionPolylineRef.current) {
        missionPolylineRef.current.remove()
        missionPolylineRef.current = null
      }
      missionMarkersRef.current.forEach((m) => m.remove())
      missionMarkersRef.current = []
    }
  }, [waypoints])

  // Drone trail (recent flight path)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clean up existing trail
    if (droneTrailRef.current) {
      droneTrailRef.current.remove()
      droneTrailRef.current = null
    }

    // Use last 150 points
    const recent = history.slice(-150)
    const validPoints = recent.filter(
      (p) => p.position.lat !== 0 || p.position.lon !== 0
    )

    if (validPoints.length < 2) return

    const coords: L.LatLngExpression[] = validPoints.map((p) => [
      p.position.lat,
      p.position.lon
    ])

    droneTrailRef.current = L.polyline(coords, {
      color: 'rgba(236,223,204,0.35)',
      weight: 2,
      interactive: false
    }).addTo(map)

    return () => {
      if (droneTrailRef.current) {
        droneTrailRef.current.remove()
        droneTrailRef.current = null
      }
    }
  }, [history])

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
