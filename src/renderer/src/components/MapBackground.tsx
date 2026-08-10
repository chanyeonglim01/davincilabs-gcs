import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import { useLivePose } from '@renderer/hooks/useTelemetry'
import { useMissionStore } from '@renderer/store/missionStore'
import type { ActionKey } from '@renderer/store/missionStore'
import droneIconSvg from '@renderer/assets/drone_icon.svg'

const CesiumMap = lazy(() => import('./map/CesiumMap').then((m) => ({ default: m.CesiumMap })))

/** The trail is redrawn on a timer rather than per telemetry frame (30 Hz). */
const TRAIL_REFRESH_MS = 200

/**
 * Flown-path colour. Orange reads clearly over both satellite imagery and the
 * dark basemap, and stays distinct from the white mission line. Swap for
 * '#4FC3F7' (sky blue) if the terrain in use is orange-heavy.
 */
const TRAIL_COLOR = '#FF6B1A'
const TRAIL_WEIGHT = 3

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

// ArcGIS World_Imagery's actual cached resolution varies by region — many areas
// (especially non-major-city flight-test sites) have no tiles past z17, so
// requesting z18/19 there 404s and leaves a blank gap. maxNativeZoom caps the
// real tile request and lets Leaflet upscale the last available tile instead,
// so zooming in never breaks into a blank/white view.
const TILES: Record<
  string,
  { url: string; maxZoom: number; maxNativeZoom?: number; subdomains?: string }
> = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 22,
    maxNativeZoom: 17
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 22,
    maxNativeZoom: 19,
    subdomains: 'abcd'
  }
}

// Any tile that still fails to load (network blip, edge of coverage) falls back
// to a transparent 1x1 pixel instead of Leaflet's default broken-image glyph —
// the dark .leaflet-container background (see gcs.css) shows through cleanly.
const TRANSPARENT_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const ACTION_COLORS: Record<ActionKey, string> = {
  VTOL_TAKEOFF: '#8B9D6B',
  VTOL_TRANSITION_FW: '#C2A15E',
  VTOL_TRANSITION_MC: '#C2A15E',
  VTOL_LAND: '#B06F5C',
  WAYPOINT: '#B6AC97',
  LOITER: '#B6AC97',
  RTL: '#B6AC97'
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
  const accHeadingRef = useRef(0)
  const [tileMode, setTileMode] = useState<TileMode>('satellite')
  const [mapMode, setMapMode] = useState<MapMode>('2d')
  const [cesiumCenter, setCesiumCenter] = useState<{
    lon: number
    lat: number
    zoom: number
  } | null>(null)
  // Live telemetry is consumed imperatively below (Leaflet marker + trail), so it
  // is read through a subscription instead of a hook — this component does not
  // need to re-render thirty times a second to move a marker.
  const mapCenterRequestId = useTelemetryStore((s) => s.mapCenterRequestId)
  const { waypoints } = useMissionStore()

  // Mission overlay refs
  const missionPolylineRef = useRef<L.Polyline | null>(null)
  const missionMarkersRef = useRef<L.Marker[]>([])

  // Drone trail ref
  const droneTrailRef = useRef<L.Polyline | null>(null)

  // Auto-center: one-shot when first valid GPS arrives
  const autoCenteredRef = useRef(false)

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
      maxNativeZoom: TILES.satellite.maxNativeZoom,
      errorTileUrl: TRANSPARENT_TILE
    }).addTo(map)

    // Force Leaflet to recalculate container size. The handle is cleared on
    // teardown: a pending invalidateSize() firing after map.remove() throws on
    // the freed map pane, which is how an unrelated render error in this subtree
    // used to turn into a second, misleading Leaflet exception.
    const sizeTimer = setTimeout(() => map.invalidateSize(), 100)
    const marker = L.marker([37.5665, 126.978], { icon: createDroneIcon(0) }).addTo(map)

    mapInstanceRef.current = map
    markerRef.current = marker
    tileLayerRef.current = tileLayer

    return () => {
      clearTimeout(sizeTimer)
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      tileLayerRef.current = null
    }
  }, [])

  // Switch tile layer
  useEffect(() => {
    if (!tileLayerRef.current || !mapInstanceRef.current) return
    const { url, maxZoom, maxNativeZoom, subdomains } = TILES[tileMode]
    tileLayerRef.current.setUrl(url)
    tileLayerRef.current.options.maxZoom = maxZoom
    tileLayerRef.current.options.maxNativeZoom = maxNativeZoom
    if (subdomains) tileLayerRef.current.options.subdomains = subdomains
    mapInstanceRef.current.invalidateSize()
  }, [tileMode])

  // Restore Leaflet size when switching back to 2D
  useEffect(() => {
    if (mapMode === '2d' && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100)
    }
  }, [mapMode])

  // Update marker position + heading (즉시 반영, 애니메이션 없음).
  // Also auto-centers on the first valid GPS fix (Mission Planner style).
  useLivePose(({ lat, lon, heading }) => {
    const marker = markerRef.current
    if (!marker) return
    if (lat === 0 && lon === 0) return
    marker.setLatLng([lat, lon])

    const el = marker.getElement()
    const rotDiv = el?.firstElementChild as HTMLElement | null

    // 첫 텔레메트리
    if (prevHeadingRef.current === null) {
      prevHeadingRef.current = heading
      accHeadingRef.current = heading
      if (rotDiv) {
        rotDiv.style.transition = 'none' // HMR에서 잔여 transition 제거
        rotDiv.style.transform = `rotate(${heading}deg)`
      }
    } else {
      // 최단 경로 delta
      let delta = heading - prevHeadingRef.current
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360

      prevHeadingRef.current = heading
      accHeadingRef.current += delta

      if (rotDiv) {
        rotDiv.style.transition = 'none'
        rotDiv.style.transform = `rotate(${accHeadingRef.current}deg)`
      }
    }

    const map = mapInstanceRef.current
    if (map && !autoCenteredRef.current) {
      map.setView([lat, lon], 18, { animate: false })
      autoCenteredRef.current = true
    }
  })

  // Manual recenter request (TAKEOFF button or explicit user action)
  useEffect(() => {
    if (mapCenterRequestId === 0) return
    const map = mapInstanceRef.current
    const position = useTelemetryStore.getState().telemetry?.position
    if (!map || !position) return
    const { lat, lon } = position
    if (lat === 0 && lon === 0) return
    map.setView([lat, lon], 18, { animate: true })
  }, [mapCenterRequestId])

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
        color: '#FFFFFF',
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

  // Drone trail — the whole flight path, from the store's decimated buffer.
  // The polyline is updated in place on a timer; the previous version destroyed
  // and rebuilt the layer on every one of the 30 telemetry frames a second,
  // which was the single most expensive thing this component did.
  useEffect(() => {
    // Number of points currently rendered, so a stationary vehicle does not make
    // Leaflet re-project the whole path five times a second.
    let drawnCount = -1

    // The map handle is read inside draw(), not captured here: bailing out once
    // because the map was not ready yet would leave the trail dead forever.
    const draw = (): void => {
      const map = mapInstanceRef.current
      if (!map) return

      const path = useTelemetryStore.getState().flightPath
      const trail = droneTrailRef.current

      if (path.length < 2) {
        trail?.setLatLngs([])
        drawnCount = path.length
        return
      }

      // A trail from a previous map instance is no longer attached — re-create it.
      const attached = trail !== null && map.hasLayer(trail)
      if (attached && path.length === drawnCount) return
      drawnCount = path.length

      const coords: L.LatLngExpression[] = path.map((p) => [p.lat, p.lon])

      if (attached && trail) {
        trail.setLatLngs(coords)
        return
      }

      droneTrailRef.current = L.polyline(coords, {
        color: TRAIL_COLOR,
        weight: TRAIL_WEIGHT,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false
      }).addTo(map)
    }

    draw()
    const timer = setInterval(draw, TRAIL_REFRESH_MS)

    return () => {
      clearInterval(timer)
      if (droneTrailRef.current) {
        droneTrailRef.current.remove()
        droneTrailRef.current = null
      }
    }
  }, [])

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
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: '#181C14',
          display: mapMode === '2d' ? 'block' : 'none'
        }}
      />

      {/* 3D Cesium map */}
      {mapMode === '3d' && (
        <Suspense
          fallback={
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#181C14',
                color: 'rgba(236,223,204,0.4)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '11px',
                letterSpacing: '0.1em'
              }}
            >
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
          onClick={() => {
            setMapMode('2d')
            setTileMode('satellite')
          }}
          style={btnStyle(mapMode === '2d' && tileMode === 'satellite')}
        >
          SAT
        </button>
        <button
          onClick={() => {
            setMapMode('2d')
            setTileMode('dark')
          }}
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
