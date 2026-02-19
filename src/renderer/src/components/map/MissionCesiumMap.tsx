import { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import type { Waypoint } from '@renderer/store/missionStore'

const DEFAULT_LON = 126.978
const DEFAULT_LAT = 37.5665

// ─── Action metadata (colors + alt flag) ────────────────────────────────────
const WP_COLOR: Record<string, string> = {
  VTOL_TAKEOFF:       '#A5D6A7',
  VTOL_TRANSITION_FW: '#FFB74D',
  VTOL_TRANSITION_MC: '#FFB74D',
  VTOL_LAND:          '#E87020',
  MC_TAKEOFF:         '#80CBC4',
  MC_LAND:            '#80CBC4',
  FW_TAKEOFF:         '#CE93D8',
  FW_LAND:            '#CE93D8',
  WAYPOINT:           '#4FC3F7',
  LOITER:             '#B39DDB',
  RTL:                '#FF8A80',
}

const HAS_ALT: Record<string, boolean> = {
  VTOL_TAKEOFF: true,  VTOL_TRANSITION_FW: false, VTOL_TRANSITION_MC: false,
  VTOL_LAND:    true,  MC_TAKEOFF:         true,  MC_LAND:           false,
  FW_TAKEOFF:   true,  FW_LAND:            false,  WAYPOINT:          true,
  LOITER:       true,  RTL:                false,
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface MissionCesiumMapProps {
  initialCenter?: { lon: number; lat: number; zoom: number } | null
  waypoints: Waypoint[]
}

// ─── Component ───────────────────────────────────────────────────────────────
export function MissionCesiumMap({ initialCenter, waypoints }: MissionCesiumMapProps): React.ReactElement {
  const containerRef    = useRef<HTMLDivElement>(null)
  const viewerRef       = useRef<Cesium.Viewer | null>(null)
  const droneEntityRef  = useRef<Cesium.Entity | null>(null)
  const wpEntityIdsRef  = useRef<string[]>([])
  const hasFlownRef     = useRef(false)

  const telemetry = useTelemetryStore((state) => state.telemetry)

  // ── Init Cesium viewer ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    try {
      Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZjE2MmRhMi0wMzRiLTQ4MGItYTE0Yi01NTk3ZWY2Yjg3MWUiLCJpZCI6MzkxOTkyLCJpYXQiOjE3NzE1MDkwODh9.pf3-Gjw9bfY1-GhlCdCdB_Khnvl094ULGmdhk7109A0'

      const viewer = new Cesium.Viewer(containerRef.current, {
        timeline:              false,
        animation:             false,
        baseLayerPicker:       false,
        geocoder:              false,
        homeButton:            false,
        sceneModePicker:       false,
        navigationHelpButton:  false,
        fullscreenButton:      false,
        infoBox:               false,
        selectionIndicator:    false,
        shadows:               false,
        shouldAnimate:         true,
        terrainProvider:       new Cesium.EllipsoidTerrainProvider(),
        baseLayer: new Cesium.ImageryLayer(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maximumLevel: 19,
            credit: 'Tiles \u00a9 Esri',
          })
        ),
      })

      // Cesium World Terrain (실제 지형 고도)
      Cesium.CesiumTerrainProvider.fromIonAssetId(1, { requestVertexNormals: false }).then((terrain) => {
        if (viewerRef.current) viewerRef.current.terrainProvider = terrain
      }).catch(() => {})

      // OSM Buildings (3D 건물)
      Cesium.Cesium3DTileset.fromIonAssetId(96188).then((tileset) => {
        if (viewerRef.current) viewerRef.current.scene.primitives.add(tileset)
      }).catch(() => {})

      const initLon  = initialCenter?.lon  ?? DEFAULT_LON
      const initLat  = initialCenter?.lat  ?? DEFAULT_LAT
      const initZoom = initialCenter?.zoom ?? 15
      // Leaflet zoom → Cesium altitude
      const initAlt  = Math.max(300, 2500 * Math.pow(2, 15 - initZoom))

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(initLon, initLat, initAlt),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch:   Cesium.Math.toRadians(-50),
          roll:    0.0,
        },
      })

      viewer.scene.globe.enableLighting = false
      viewerRef.current = viewer

      // Drone entity
      const dpr = window.devicePixelRatio || 1
      droneEntityRef.current = viewer.entities.add({
        name: 'Drone',
        position: Cesium.Cartesian3.fromDegrees(initLon, initLat, 0),
        billboard: {
          image:           droneIconDataUrl(0),
          width:           96 * dpr,
          height:          112 * dpr,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      })

      setTimeout(() => {
        viewer.forceResize()
        viewer.scene.requestRender()
      }, 300)

    } catch (e) {
      console.error('[MissionCesiumMap] init error:', e)
    }

    return () => {
      viewerRef.current?.destroy()
      viewerRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update drone marker ───────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    const entity = droneEntityRef.current
    if (!viewer || !entity || !telemetry) return

    const { lat, lon, relative_alt } = telemetry.position
    const heading = telemetry.heading

    if (entity.billboard) {
      entity.billboard.image = new Cesium.ConstantProperty(droneIconDataUrl(heading))
    }

    if (lat === 0 && lon === 0) return

    entity.position = new Cesium.ConstantPositionProperty(
      Cesium.Cartesian3.fromDegrees(lon, lat, relative_alt)
    )

    if (!hasFlownRef.current) {
      hasFlownRef.current = true
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1500),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch:   Cesium.Math.toRadians(-50),
          roll:    0.0,
        },
        duration: 1.5,
      })
    }
  }, [telemetry])

  // ── Render waypoint entities ──────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // Remove previous waypoint entities
    wpEntityIdsRef.current.forEach((id) => {
      const e = viewer.entities.getById(id)
      if (e) viewer.entities.remove(e)
    })
    wpEntityIdsRef.current = []

    let seq = 0
    const navWps: Waypoint[] = []

    waypoints.forEach((wp) => {
      if (!HAS_ALT[wp.action]) return
      seq++
      navWps.push(wp)

      const colorHex   = WP_COLOR[wp.action] ?? '#4FC3F7'
      const cesiumColor = Cesium.Color.fromCssColorString(colorHex)

      // Vertical stick (ground → altitude)
      const stickId = `wp-stick-${wp.uid}`
      viewer.entities.add({
        id: stickId,
        polyline: {
          positions: new Cesium.ConstantProperty([
            Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, 0),
            Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt),
          ]),
          width:    1,
          material: new Cesium.ColorMaterialProperty(cesiumColor.withAlpha(0.35)),
          clampToGround: false,
        },
      })
      wpEntityIdsRef.current.push(stickId)

      // Dot marker at altitude
      const dotId = `wp-dot-${wp.uid}`
      viewer.entities.add({
        id:       dotId,
        position: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt),
        point: {
          pixelSize:   16,
          color:       cesiumColor.withAlpha(0.9),
          outlineColor: Cesium.Color.fromCssColorString('#181C14'),
          outlineWidth: 2,
          heightReference:           Cesium.HeightReference.NONE,
          disableDepthTestDistance:  Number.POSITIVE_INFINITY,
        },
        label: {
          text:             String(seq),
          font:             "bold 11px 'JetBrains Mono', monospace",
          fillColor:        Cesium.Color.fromCssColorString('#181C14'),
          style:            Cesium.LabelStyle.FILL,
          verticalOrigin:   Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          pixelOffset:      new Cesium.Cartesian2(0, 0),
          heightReference:           Cesium.HeightReference.NONE,
          disableDepthTestDistance:  Number.POSITIVE_INFINITY,
        },
      })
      wpEntityIdsRef.current.push(dotId)

      // Altitude label above dot
      const lblId = `wp-lbl-${wp.uid}`
      viewer.entities.add({
        id:       lblId,
        position: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt),
        label: {
          text:             `${wp.alt}m`,
          font:             "10px 'JetBrains Mono', monospace",
          fillColor:        cesiumColor,
          outlineColor:     Cesium.Color.fromCssColorString('#181C14'),
          outlineWidth:     2,
          style:            Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin:   Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          pixelOffset:      new Cesium.Cartesian2(0, -14),
          heightReference:           Cesium.HeightReference.NONE,
          disableDepthTestDistance:  Number.POSITIVE_INFINITY,
        },
      })
      wpEntityIdsRef.current.push(lblId)
    })

    // Polyline connecting nav waypoints at their altitudes
    if (navWps.length >= 2) {
      const pathId = 'wp-path'
      viewer.entities.add({
        id: pathId,
        polyline: {
          positions: new Cesium.ConstantProperty(
            navWps.map((wp) => Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt))
          ),
          width:    2,
          material: new Cesium.PolylineDashMaterialProperty({
            color:     Cesium.Color.fromCssColorString('#4FC3F7').withAlpha(0.6),
            dashLength: 16,
          }),
          clampToGround: false,
        },
      })
      wpEntityIdsRef.current.push(pathId)
    }
  }, [waypoints])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  )
}

// ─── Drone SVG → data URL (same icon as MapBackground / MissionView) ─────────
function droneIconDataUrl(heading: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="224" viewBox="0 -16 96 112">
    <g transform="rotate(${heading}, 48, 36)">
      <line x1="48" y1="-14" x2="48" y2="20" stroke="#E87020" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="48" cy="52" rx="6" ry="24" fill="#111" fill-opacity="0.5"/>
      <path d="M48 42 L4 60 L5 66 L48 53 L91 66 L92 60 Z" fill="#111" fill-opacity="0.4"/>
      <ellipse cx="48" cy="52" rx="4.5" ry="22" fill="#FFFFFF"/>
      <path d="M48 42 L4 60 L5 65 L48 53 L91 65 L92 60 Z" fill="#FFFFFF" fill-opacity="0.92"/>
      <path d="M48 42 L4 60 L5 62 L48 44 Z" fill="#00CFFF" fill-opacity="0.5"/>
      <path d="M48 42 L92 60 L91 62 L48 44 Z" fill="#00CFFF" fill-opacity="0.5"/>
      <path d="M48 31 L32 37 L32 40 L48 34 L64 40 L64 37 Z" fill="#FFFFFF" fill-opacity="0.75"/>
      <path d="M43 71 L35 84 L38 85 L46 73 Z" fill="#FFFFFF" fill-opacity="0.65"/>
      <path d="M53 71 L61 84 L58 85 L50 73 Z" fill="#FFFFFF" fill-opacity="0.65"/>
      <circle cx="7"  cy="61" r="5.5" fill="#1a1a2a" stroke="#FFFFFF" stroke-width="1.5"/>
      <circle cx="89" cy="61" r="5.5" fill="#1a1a2a" stroke="#FFFFFF" stroke-width="1.5"/>
      <circle cx="48" cy="52" r="7"   fill="#1a1a2a" stroke="#FFFFFF" stroke-width="1.8"/>
      <circle cx="48" cy="52" r="3"   fill="#00CFFF"/>
      <ellipse cx="48" cy="29" rx="3" ry="3.5" fill="#00CFFF"/>
    </g>
  </svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
