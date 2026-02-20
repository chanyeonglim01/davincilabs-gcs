import { useEffect, useRef, useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import {
  DRONE_MODEL_URI,
  DRONE_MODEL_SCALE,
  DRONE_MIN_PIXEL_SIZE,
  DRONE_MAX_SCALE,
  computeDroneOrientation,
  patchModelDepth,
  HEADING_STICK_IMAGE,
  STICK_WIDTH_PX,
  STICK_LENGTH_PX,
  STICK_NOSE_PX,
  STICK_SCREEN_Y_OFFSET_PX,
} from './cesiumDroneModel'

const DEFAULT_LON = 126.978
const DEFAULT_LAT = 37.5665

interface CesiumMapProps {
  initialCenter?: { lon: number; lat: number; zoom: number } | null
}

export function CesiumMap({ initialCenter }: CesiumMapProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const entityRef = useRef<Cesium.Entity | null>(null)
  const headingEntityRef = useRef<Cesium.Entity | null>(null)
  const hasFlownRef = useRef(false)
  const headingDegRef = useRef<number>(0)
  const billboardPosRef = useRef<Cesium.Cartesian3>(Cesium.Cartesian3.ZERO)
  const billboardRotRef = useRef<number>(0)
  const billboardOffRef = useRef<Cesium.Cartesian2>(new Cesium.Cartesian2(0, 0))
  const [error, setError] = useState<string | null>(null)

  const telemetry = useTelemetryStore((state) => state.telemetry)
  const history = useTelemetryStore((state) => state.history)

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const container = containerRef.current
    let removeDepthPatch: (() => void) | undefined

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

      Cesium.CesiumTerrainProvider.fromIonAssetId(1, { requestVertexNormals: false }).then((terrain) => {
        if (viewerRef.current) viewerRef.current.terrainProvider = terrain
      }).catch(() => {})

      // OSM Buildings (3D 건물)
      Cesium.Cesium3DTileset.fromIonAssetId(96188).then((tileset) => {
        if (viewerRef.current) viewerRef.current.scene.primitives.add(tileset)
      }).catch(() => {})

      viewer.scene.globe.depthTestAgainstTerrain = false

      const initLon = initialCenter?.lon ?? DEFAULT_LON
      const initLat = initialCenter?.lat ?? DEFAULT_LAT
      const initZoom = initialCenter?.zoom ?? 15
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

      const initPos = Cesium.Cartesian3.fromDegrees(initLon, initLat, 0)
      billboardPosRef.current = initPos

      // 3D GLB 드론 모델 엔티티
      entityRef.current = viewer.entities.add({
        name: 'Drone',
        position: initPos,
        orientation: new Cesium.ConstantProperty(
          computeDroneOrientation(initPos, 0, 0, 0)
        ),
        model: {
          uri: DRONE_MODEL_URI,
          scale: DRONE_MODEL_SCALE,
          minimumPixelSize: DRONE_MIN_PIXEL_SIZE,
          maximumScale: DRONE_MAX_SCALE,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          silhouetteColor: Cesium.Color.fromCssColorString('#ECDFCC'),
          silhouetteSize: 1.0,
          shadows: Cesium.ShadowMode.DISABLED,
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

      // 헤딩 표시: billboard + disableDepthTestDistance=Infinity (건물에 가리지 않음)
      headingEntityRef.current = viewer.entities.add({
        position: new Cesium.CallbackProperty(
          () => billboardPosRef.current, false
        ) as unknown as Cesium.PositionProperty,
        billboard: {
          image: HEADING_STICK_IMAGE,
          width: STICK_WIDTH_PX,
          height: STICK_LENGTH_PX,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          rotation: new Cesium.CallbackProperty(() => billboardRotRef.current, false),
          pixelOffset: new Cesium.CallbackProperty(() => billboardOffRef.current, false),
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        },
      })

      // postUpdate: depth patch + heading billboard 갱신
      removeDepthPatch = viewer.scene.postUpdate.addEventListener(() => {
        if (entityRef.current) {
          patchModelDepth(viewer.scene, entityRef.current)
        }
        if (entityRef.current) {
          const dronePos = entityRef.current.position?.getValue(viewer.clock.currentTime)
          if (dronePos) {
            billboardPosRef.current = dronePos
            const droneHeadingRad = Cesium.Math.toRadians(headingDegRef.current)
            const screenAngle = droneHeadingRad - viewer.camera.heading
            const midpointPx = STICK_NOSE_PX + STICK_LENGTH_PX / 2
            billboardRotRef.current = viewer.camera.heading - droneHeadingRad
            billboardOffRef.current.x = midpointPx * Math.sin(screenAngle)
            billboardOffRef.current.y = -midpointPx * Math.cos(screenAngle) + STICK_SCREEN_Y_OFFSET_PX
          }
        }
      })

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
      removeDepthPatch?.()
      viewerRef.current?.destroy()
      viewerRef.current = null
    }
  }, [])

  // Update drone position
  useEffect(() => {
    if (!viewerRef.current || !telemetry || !entityRef.current) return

    const { lat, lon, relative_alt } = telemetry.position
    const heading = telemetry.heading

    if (lat === 0 && lon === 0) return

    headingDegRef.current = heading

    const position = Cesium.Cartesian3.fromDegrees(lon, lat, relative_alt)
    entityRef.current.position = new Cesium.ConstantPositionProperty(position)
    entityRef.current.orientation = new Cesium.ConstantProperty(
      computeDroneOrientation(position, heading, telemetry.attitude.pitch, telemetry.attitude.roll)
    )
    if (entityRef.current.label) {
      entityRef.current.label.show = new Cesium.ConstantProperty(true)
      entityRef.current.label.text = new Cesium.ConstantProperty(`ALT: ${relative_alt.toFixed(0)}m`)
    }

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
