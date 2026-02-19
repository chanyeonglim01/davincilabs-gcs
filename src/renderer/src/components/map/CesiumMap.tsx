import { useEffect, useRef, useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import droneIconUrl from '@renderer/assets/drone_icon.svg'

// Preload drone image at module init
const _droneImg = new Image()
_droneImg.src = droneIconUrl

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

// DRONE_Y=50: heading line y=2→48 (46px, 앞쪽으로 뻗음), drone y=50→133
// body center=91.5≈92, ICON_H=184 → center=92 → 2D/3D anchor 일치
const ICON_W = 128
const ICON_H = 184
const DRONE_Y = 50
const DRONE_H = 83   // 128 / (1011/659)

function createDroneIcon(heading: number): string {
  const K = 4
  const canvas = document.createElement('canvas')
  canvas.width  = ICON_W * K
  canvas.height = ICON_H * K
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(K, K)

  // Rotation pivot = drone body center = icon center
  const cx = 64
  const cy = 92

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((heading * Math.PI) / 180)
  ctx.translate(-cx, -cy)

  // Heading indicator: glow + core line (기체 앞쪽, y=2→48)
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.beginPath(); ctx.moveTo(cx, 2); ctx.lineTo(cx, DRONE_Y - 2)
  ctx.strokeStyle = '#FFB060'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke()
  ctx.restore()
  ctx.beginPath(); ctx.moveTo(cx, 2); ctx.lineTo(cx, DRONE_Y - 2)
  ctx.strokeStyle = '#E87020'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke()

  // Drone SVG
  if (_droneImg.complete && _droneImg.naturalWidth > 0) {
    ctx.drawImage(_droneImg, 0, DRONE_Y, ICON_W, DRONE_H)
  }

  ctx.restore()
  return canvas.toDataURL('image/png')
}
