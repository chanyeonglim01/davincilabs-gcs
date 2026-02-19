import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
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

// ─── Props & Handle ──────────────────────────────────────────────────────────
interface MissionCesiumMapProps {
  initialCenter?: { lon: number; lat: number; zoom: number } | null
  waypoints: Waypoint[]
}

export interface MissionCesiumMapHandle {
  getCameraState: () => { lon: number; lat: number; zoom: number } | null
}

// ─── Component ───────────────────────────────────────────────────────────────
export const MissionCesiumMap = forwardRef<MissionCesiumMapHandle, MissionCesiumMapProps>(
function MissionCesiumMap({ initialCenter, waypoints }, ref) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const viewerRef       = useRef<Cesium.Viewer | null>(null)
  const droneEntityRef  = useRef<Cesium.Entity | null>(null)
  const wpEntityIdsRef  = useRef<string[]>([])
  // initialCenter provided = user switched from 2D → keep that position, skip auto-fly
  const hasFlownRef     = useRef<boolean>(initialCenter != null)

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
          pitch:   Cesium.Math.toRadians(-89.9),
          roll:    0.0,
        },
      })

      viewer.scene.globe.enableLighting = false
      viewerRef.current = viewer

      // Drone entity
      droneEntityRef.current = viewer.entities.add({
        name: 'Drone',
        position: Cesium.Cartesian3.fromDegrees(initLon, initLat, 0),
        billboard: {
          image:                    createDroneIcon(0),
          width:                    96,
          height:                   112,
          heightReference:          Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
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
      entity.billboard.image = new Cesium.ConstantProperty(createDroneIcon(heading))
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
          pitch:   Cesium.Math.toRadians(-89.9),
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

  // ── Expose camera state to parent for 3D→2D zoom sync ───────────────────
  useImperativeHandle(ref, () => ({
    getCameraState: () => {
      const viewer = viewerRef.current
      if (!viewer) return null
      // Pick the globe point at screen center (accurate even when tilted)
      const canvas = viewer.canvas
      const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
      const ray    = viewer.camera.getPickRay(center)
      const hit    = ray ? viewer.scene.globe.pick(ray, viewer.scene) : null
      let lon: number, lat: number
      if (hit) {
        const carto = Cesium.Cartographic.fromCartesian(hit)
        lon = Cesium.Math.toDegrees(carto.longitude)
        lat = Cesium.Math.toDegrees(carto.latitude)
      } else {
        const carto = viewer.camera.positionCartographic
        lon = Cesium.Math.toDegrees(carto.longitude)
        lat = Cesium.Math.toDegrees(carto.latitude)
      }
      // Cesium alt → Leaflet zoom (×2 reference = +1 zoom level to match 3D detail)
      const alt  = viewer.camera.positionCartographic.height
      const zoom = Math.max(1, Math.min(20, Math.round(15 - Math.log2(Math.max(300, alt) / 5000))))
      return { lon, lat, zoom }
    },
  }))

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  )
})

// ─── Canvas-based drone icon (Fix: SVG negative viewBox breaks Cesium) ────────
function createDroneIcon(heading: number): string {
  const K = 4
  const canvas = document.createElement('canvas')
  canvas.width  = 96  * K
  canvas.height = 112 * K
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(K, K)

  ctx.save()
  ctx.translate(48, 64)
  ctx.rotate((heading * Math.PI) / 180)
  ctx.translate(-48, -64)

  // Drop shadow
  ctx.save(); ctx.globalAlpha = 0.22; ctx.filter = 'blur(4px)'; ctx.translate(3, 4)
  ctx.beginPath(); ctx.moveTo(48, 58); ctx.lineTo(4, 76); ctx.lineTo(5, 82)
  ctx.lineTo(48, 69); ctx.lineTo(91, 82); ctx.lineTo(92, 76); ctx.closePath()
  ctx.fillStyle = '#000000'; ctx.fill(); ctx.restore()

  // Heading line glow
  ctx.save(); ctx.globalAlpha = 0.30
  ctx.beginPath(); ctx.moveTo(48, 2); ctx.lineTo(48, 36)
  ctx.strokeStyle = '#FFB060'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore()
  // Heading line core
  ctx.beginPath(); ctx.moveTo(48, 2); ctx.lineTo(48, 36)
  ctx.strokeStyle = '#E87020'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke()

  // Wing shadow
  ctx.save(); ctx.globalAlpha = 0.28
  ctx.beginPath(); ctx.moveTo(48, 58); ctx.lineTo(4, 76); ctx.lineTo(5, 82)
  ctx.lineTo(48, 69); ctx.lineTo(91, 82); ctx.lineTo(92, 76); ctx.closePath()
  ctx.fillStyle = '#000000'; ctx.fill(); ctx.restore()

  // Wings
  const wg = ctx.createLinearGradient(48, 54, 48, 82)
  wg.addColorStop(0, '#FFFFFF'); wg.addColorStop(0.45, '#E8EBF2'); wg.addColorStop(1, '#B8BDD0')
  ctx.beginPath(); ctx.moveTo(48, 58); ctx.lineTo(4, 76); ctx.lineTo(5, 81)
  ctx.lineTo(48, 69); ctx.lineTo(91, 81); ctx.lineTo(92, 76); ctx.closePath()
  ctx.fillStyle = wg; ctx.fill()
  // Leading edge accent
  ctx.save(); ctx.globalAlpha = 0.55
  ctx.beginPath(); ctx.moveTo(48, 58); ctx.lineTo(4, 76); ctx.lineTo(5, 78); ctx.lineTo(48, 60); ctx.closePath()
  ctx.fillStyle = '#00CFFF'; ctx.fill()
  ctx.beginPath(); ctx.moveTo(48, 58); ctx.lineTo(92, 76); ctx.lineTo(91, 78); ctx.lineTo(48, 60); ctx.closePath()
  ctx.fillStyle = '#00CFFF'; ctx.fill(); ctx.restore()

  // Fuselage
  const fg = ctx.createLinearGradient(42, 46, 54, 90)
  fg.addColorStop(0, '#D0D8F0'); fg.addColorStop(0.2, '#FFFFFF')
  fg.addColorStop(0.8, '#FFFFFF'); fg.addColorStop(1, '#C8CEDF')
  ctx.beginPath(); ctx.ellipse(48, 68, 4.5, 22, 0, 0, Math.PI * 2)
  ctx.fillStyle = fg; ctx.fill()
  ctx.save(); ctx.globalAlpha = 0.42
  ctx.beginPath(); ctx.ellipse(47, 63, 1.8, 12, -0.15, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.restore()

  // Canards
  ctx.save(); ctx.globalAlpha = 0.82
  ctx.beginPath(); ctx.moveTo(48, 47); ctx.lineTo(32, 53); ctx.lineTo(32, 56)
  ctx.lineTo(48, 50); ctx.lineTo(64, 56); ctx.lineTo(64, 53); ctx.closePath()
  ctx.fillStyle = '#DCE6F8'; ctx.fill(); ctx.restore()

  // Tail fins
  ctx.save(); ctx.globalAlpha = 0.70
  ctx.beginPath(); ctx.moveTo(43, 87); ctx.lineTo(35, 100); ctx.lineTo(38, 101); ctx.lineTo(46, 89); ctx.closePath()
  ctx.fillStyle = '#CDD5E6'; ctx.fill()
  ctx.beginPath(); ctx.moveTo(53, 87); ctx.lineTo(61, 100); ctx.lineTo(58, 101); ctx.lineTo(50, 89); ctx.closePath()
  ctx.fillStyle = '#CDD5E6'; ctx.fill(); ctx.restore()

  // Wing rotor pods
  for (const [px, py] of [[7, 77], [89, 77]] as [number, number][]) {
    const pg = ctx.createRadialGradient(px - 2, py - 1.5, 0.5, px, py, 5.5)
    pg.addColorStop(0, '#4A5878'); pg.addColorStop(0.65, '#1a1a2a'); pg.addColorStop(1, '#07070E')
    ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI * 2)
    ctx.fillStyle = pg; ctx.fill()
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke()
  }

  // Center engine
  ctx.save(); ctx.globalAlpha = 0.20
  ctx.beginPath(); ctx.arc(48, 68, 9, 0, Math.PI * 2)
  ctx.fillStyle = '#00CFFF'; ctx.fill(); ctx.restore()
  const eg = ctx.createRadialGradient(46, 66, 0.5, 48, 68, 7)
  eg.addColorStop(0, '#3C4468'); eg.addColorStop(0.75, '#1a1a2a'); eg.addColorStop(1, '#07070E')
  ctx.beginPath(); ctx.arc(48, 68, 7, 0, Math.PI * 2)
  ctx.fillStyle = eg; ctx.fill()
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.8; ctx.stroke()
  const cg = ctx.createRadialGradient(47.5, 67.5, 0, 48, 68, 3)
  cg.addColorStop(0, '#CCFFFF'); cg.addColorStop(0.5, '#00CFFF'); cg.addColorStop(1, '#0077AA')
  ctx.beginPath(); ctx.arc(48, 68, 3, 0, Math.PI * 2)
  ctx.fillStyle = cg; ctx.fill()

  // Nose
  const ng = ctx.createRadialGradient(47.5, 44, 0.3, 48, 45, 3.5)
  ng.addColorStop(0, '#CCFFFF'); ng.addColorStop(0.55, '#00CFFF'); ng.addColorStop(1, '#0077AA')
  ctx.beginPath(); ctx.ellipse(48, 45, 3, 3.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = ng; ctx.fill()

  ctx.restore()
  return canvas.toDataURL('image/png')
}
