import { useEffect, useRef, useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

const DEFAULT_LON = 126.978
const DEFAULT_LAT = 37.5665

interface CesiumMapProps {
  initialCenter?: { lon: number; lat: number; zoom: number } | null
}

export function CesiumMap({ initialCenter }: CesiumMapProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const entityRef = useRef<Cesium.Entity | null>(null)
  const hasFlownRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const telemetry = useTelemetryStore((state) => state.telemetry)
  const history = useTelemetryStore((state) => state.history)

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const container = containerRef.current

    try {
      Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZjE2MmRhMi0wMzRiLTQ4MGItYTE0Yi01NTk3ZWY2Yjg3MWUiLCJpZCI6MzkxOTkyLCJpYXQiOjE3NzE1MDkwODh9.pf3-Gjw9bfY1-GhlCdCdB_Khnvl094ULGmdhk7109A0'

      const viewer = new Cesium.Viewer(container, {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        shadows: false,
        shouldAnimate: true,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        baseLayer: new Cesium.ImageryLayer(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maximumLevel: 19,
            credit: 'Tiles \u00a9 Esri'
          })
        )
      })

      // Cesium World Terrain (실제 지형 고도)
      Cesium.CesiumTerrainProvider.fromIonAssetId(1, { requestVertexNormals: false }).then((terrain) => {
        if (viewerRef.current) viewerRef.current.terrainProvider = terrain
      }).catch(() => {/* 실패 시 flat 유지 */})

      // OSM Buildings (3D 건물)
      Cesium.Cesium3DTileset.fromIonAssetId(96188).then((tileset) => {
        if (viewerRef.current) viewerRef.current.scene.primitives.add(tileset)
      }).catch(() => {/* 실패 시 무시 */})

      // Sync camera with Leaflet map position when switching from 2D
      const initLon = initialCenter?.lon ?? DEFAULT_LON
      const initLat = initialCenter?.lat ?? DEFAULT_LAT
      const initZoom = initialCenter?.zoom ?? 15
      // Leaflet zoom → Cesium altitude (zoom15 ≈ 2500m, tuned to match Leaflet FOV at typical GCS window)
      const initAlt = Math.max(500, 2500 * Math.pow(2, 15 - initZoom))

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(initLon, initLat, initAlt),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-89.9),
          roll: 0.0
        }
      })

      viewer.scene.globe.enableLighting = false
      viewerRef.current = viewer

      // Add default drone entity (same position as camera center, label hidden until real telemetry)
      entityRef.current = viewer.entities.add({
        name: 'Drone',
        position: Cesium.Cartesian3.fromDegrees(initLon, initLat, 0),
        billboard: {
          image: createDroneIcon(0),
          width: ICON_W,
          height: ICON_H,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          // Always render on top of terrain and OSM 3D buildings
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          show: false,
          text: '',
          font: "11px 'JetBrains Mono', monospace",
          fillColor: Cesium.Color.fromCssColorString('#ECDFCC'),
          outlineColor: Cesium.Color.fromCssColorString('#181C14'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -30),
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
        }
      })

      // Force layout recalculation and render
      setTimeout(() => {
        viewer.forceResize()
        viewer.scene.requestRender()
      }, 300)

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      console.error('[CesiumMap] init error:', e)
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [])

  // Update drone position
  useEffect(() => {
    if (!viewerRef.current || !telemetry || !entityRef.current) return

    const { lat, lon, relative_alt } = telemetry.position
    const heading = telemetry.heading

    // Always update icon heading
    if (entityRef.current.billboard) {
      entityRef.current.billboard.image = new Cesium.ConstantProperty(createDroneIcon(heading))
    }

    if (lat === 0 && lon === 0) return

    // Update position
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, relative_alt)
    entityRef.current.position = new Cesium.ConstantPositionProperty(position)
    if (entityRef.current.billboard) {
      entityRef.current.billboard.heightReference = new Cesium.ConstantProperty(
        Cesium.HeightReference.RELATIVE_TO_GROUND
      )
      entityRef.current.billboard.width = new Cesium.ConstantProperty(ICON_W)
      entityRef.current.billboard.height = new Cesium.ConstantProperty(ICON_H)
      entityRef.current.billboard.disableDepthTestDistance = new Cesium.ConstantProperty(Number.POSITIVE_INFINITY)
    }
    if (entityRef.current.label) {
      entityRef.current.label.show = new Cesium.ConstantProperty(true)
      entityRef.current.label.text = new Cesium.ConstantProperty(`ALT: ${relative_alt.toFixed(0)}m`)
    }

    // Fly camera to drone on first real telemetry
    if (!hasFlownRef.current) {
      hasFlownRef.current = true
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 2500),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-89.9),
          roll: 0.0
        },
        duration: 2
      })
    }
  }, [telemetry])

  // Draw path trail
  useEffect(() => {
    if (!viewerRef.current || history.length < 2) return

    const viewer = viewerRef.current
    const oldPath = viewer.entities.getById('path')
    if (oldPath) viewer.entities.remove(oldPath)

    const positions = history
      .filter((t) => t.position.lat !== 0 && t.position.lon !== 0)
      .map((t) =>
        Cesium.Cartesian3.fromDegrees(t.position.lon, t.position.lat, t.position.relative_alt)
      )

    if (positions.length > 1) {
      viewer.entities.add({
        id: 'path',
        name: 'Flight Path',
        polyline: {
          positions: positions,
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.CYAN
          }),
          clampToGround: false
        }
      })
    }
  }, [history])

  if (error) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#181C14',
        color: '#ECDFCC',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        padding: '20px',
        gap: '8px'
      }}>
        <span style={{ color: 'rgba(236,223,204,0.4)', fontSize: '9px' }}>CESIUM ERROR</span>
        <span style={{ textAlign: 'center', lineHeight: 1.6 }}>{error}</span>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

/**
 * Canvas-based 3D-style drone icon for Cesium billboard.
 * SVG data URLs have rendering issues in Cesium (negative viewBox clipping).
 * Canvas 2D API is fully deterministic and adds volumetric depth for the 3D map.
 * Coordinates are shifted +16 from SVG viewBox="0 -16 96 112" → canvas y origin at 0.
 */
// Billboard display size (matches 2D Leaflet iconSize: [96, 112])
const ICON_W = 96
const ICON_H = 112

function createDroneIcon(heading: number): string {
  // Draw canvas at 4× the logical 96×112 coordinate space (384×448 px)
  // so Cesium never upscales the PNG regardless of zoom level → no pixelation
  const K = 4
  const canvas = document.createElement('canvas')
  canvas.width = 96 * K   // 384
  canvas.height = 112 * K // 448
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(K, K)

  // Rotate around aircraft center (matches Leaflet transform-origin: 48px 64px)
  ctx.save()
  ctx.translate(48, 64)
  ctx.rotate((heading * Math.PI) / 180)
  ctx.translate(-48, -64)

  // ── DROP SHADOW ──────────────────────────────────────────────────────────────
  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.filter = 'blur(4px)'
  ctx.translate(3, 4)
  ctx.beginPath()
  ctx.moveTo(48, 58); ctx.lineTo(4, 76); ctx.lineTo(5, 82)
  ctx.lineTo(48, 69); ctx.lineTo(91, 82); ctx.lineTo(92, 76); ctx.closePath()
  ctx.fillStyle = '#000000'; ctx.fill()
  ctx.restore()

  // ── HEADING LINE ─────────────────────────────────────────────────────────────
  // Glow halo
  ctx.save(); ctx.globalAlpha = 0.30
  ctx.beginPath(); ctx.moveTo(48, 2); ctx.lineTo(48, 36)
  ctx.strokeStyle = '#FFB060'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke()
  ctx.restore()
  // Core line
  ctx.beginPath(); ctx.moveTo(48, 2); ctx.lineTo(48, 36)
  ctx.strokeStyle = '#E87020'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke()

  // ── WING SHADOW ──────────────────────────────────────────────────────────────
  ctx.save(); ctx.globalAlpha = 0.28
  ctx.beginPath()
  ctx.moveTo(48, 58); ctx.lineTo(4, 76); ctx.lineTo(5, 82)
  ctx.lineTo(48, 69); ctx.lineTo(91, 82); ctx.lineTo(92, 76); ctx.closePath()
  ctx.fillStyle = '#000000'; ctx.fill(); ctx.restore()

  // ── WINGS (gradient lit from top) ────────────────────────────────────────────
  const wg = ctx.createLinearGradient(48, 54, 48, 82)
  wg.addColorStop(0, '#FFFFFF'); wg.addColorStop(0.45, '#E8EBF2'); wg.addColorStop(1, '#B8BDD0')
  ctx.beginPath()
  ctx.moveTo(48, 58); ctx.lineTo(4, 76); ctx.lineTo(5, 81)
  ctx.lineTo(48, 69); ctx.lineTo(91, 81); ctx.lineTo(92, 76); ctx.closePath()
  ctx.fillStyle = wg; ctx.fill()

  // Leading edge cyan accent
  ctx.save(); ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.moveTo(48, 58); ctx.lineTo(4, 76); ctx.lineTo(5, 78); ctx.lineTo(48, 60); ctx.closePath()
  ctx.fillStyle = '#00CFFF'; ctx.fill()
  ctx.beginPath()
  ctx.moveTo(48, 58); ctx.lineTo(92, 76); ctx.lineTo(91, 78); ctx.lineTo(48, 60); ctx.closePath()
  ctx.fillStyle = '#00CFFF'; ctx.fill()
  ctx.restore()

  // ── FUSELAGE (vertical gradient) ─────────────────────────────────────────────
  const fg = ctx.createLinearGradient(42, 46, 54, 90)
  fg.addColorStop(0, '#D0D8F0'); fg.addColorStop(0.2, '#FFFFFF')
  fg.addColorStop(0.8, '#FFFFFF'); fg.addColorStop(1, '#C8CEDF')
  ctx.beginPath(); ctx.ellipse(48, 68, 4.5, 22, 0, 0, Math.PI * 2)
  ctx.fillStyle = fg; ctx.fill()
  // Specular highlight on fuselage
  ctx.save(); ctx.globalAlpha = 0.42
  ctx.beginPath(); ctx.ellipse(47, 63, 1.8, 12, -0.15, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.restore()

  // ── CANARDS ───────────────────────────────────────────────────────────────────
  ctx.save(); ctx.globalAlpha = 0.82
  ctx.beginPath()
  ctx.moveTo(48, 47); ctx.lineTo(32, 53); ctx.lineTo(32, 56)
  ctx.lineTo(48, 50); ctx.lineTo(64, 56); ctx.lineTo(64, 53); ctx.closePath()
  ctx.fillStyle = '#DCE6F8'; ctx.fill(); ctx.restore()

  // ── TAIL FINS ─────────────────────────────────────────────────────────────────
  ctx.save(); ctx.globalAlpha = 0.70
  ctx.beginPath(); ctx.moveTo(43, 87); ctx.lineTo(35, 100); ctx.lineTo(38, 101); ctx.lineTo(46, 89); ctx.closePath()
  ctx.fillStyle = '#CDD5E6'; ctx.fill()
  ctx.beginPath(); ctx.moveTo(53, 87); ctx.lineTo(61, 100); ctx.lineTo(58, 101); ctx.lineTo(50, 89); ctx.closePath()
  ctx.fillStyle = '#CDD5E6'; ctx.fill()
  ctx.restore()

  // ── WING ROTOR PODS (radial gradient = sphere illusion) ───────────────────────
  const pods: [number, number][] = [[7, 77], [89, 77]]
  for (const [px, py] of pods) {
    const pg = ctx.createRadialGradient(px - 2, py - 1.5, 0.5, px, py, 5.5)
    pg.addColorStop(0, '#4A5878'); pg.addColorStop(0.65, '#1a1a2a'); pg.addColorStop(1, '#07070E')
    ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI * 2)
    ctx.fillStyle = pg; ctx.fill()
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke()
  }

  // ── CENTER ENGINE RING ────────────────────────────────────────────────────────
  // Outer glow ring
  ctx.save(); ctx.globalAlpha = 0.20
  ctx.beginPath(); ctx.arc(48, 68, 9, 0, Math.PI * 2)
  ctx.fillStyle = '#00CFFF'; ctx.fill(); ctx.restore()
  // Dark housing
  const eg = ctx.createRadialGradient(46, 66, 0.5, 48, 68, 7)
  eg.addColorStop(0, '#3C4468'); eg.addColorStop(0.75, '#1a1a2a'); eg.addColorStop(1, '#07070E')
  ctx.beginPath(); ctx.arc(48, 68, 7, 0, Math.PI * 2)
  ctx.fillStyle = eg; ctx.fill()
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.8; ctx.stroke()
  // Glowing core
  const cg = ctx.createRadialGradient(47.5, 67.5, 0, 48, 68, 3)
  cg.addColorStop(0, '#CCFFFF'); cg.addColorStop(0.5, '#00CFFF'); cg.addColorStop(1, '#0077AA')
  ctx.beginPath(); ctx.arc(48, 68, 3, 0, Math.PI * 2)
  ctx.fillStyle = cg; ctx.fill()

  // ── NOSE ─────────────────────────────────────────────────────────────────────
  const ng = ctx.createRadialGradient(47.5, 44, 0.3, 48, 45, 3.5)
  ng.addColorStop(0, '#CCFFFF'); ng.addColorStop(0.55, '#00CFFF'); ng.addColorStop(1, '#0077AA')
  ctx.beginPath(); ctx.ellipse(48, 45, 3, 3.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = ng; ctx.fill()

  ctx.restore()
  return canvas.toDataURL('image/png')
}
