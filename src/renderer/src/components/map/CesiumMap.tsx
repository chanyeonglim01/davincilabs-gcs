import { useEffect, useRef, useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import { useMissionStore } from '@renderer/store/missionStore'
import type { ActionKey } from '@renderer/store/missionStore'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import {
  DRONE_MODEL_URI,
  DRONE_MODEL_SCALE,
  DRONE_MIN_PIXEL_SIZE,
  DRONE_MAX_SCALE,
  computeDroneOrientation,
  patchModelDepth
} from './cesiumDroneModel'

const DEFAULT_LON = 126.978
const DEFAULT_LAT = 37.5665

const MISSION_POLYLINE_ID = 'mission-polyline'
const MISSION_MARKER_PREFIX = 'mission-wp-'
const MISSION_STICK_PREFIX = 'mission-stick-'

const CESIUM_ACTION_COLORS: Record<ActionKey, string> = {
  VTOL_TAKEOFF: '#8B9D6B',
  VTOL_TRANSITION_FW: '#C2A15E',
  VTOL_TRANSITION_MC: '#C2A15E',
  VTOL_LAND: '#B06F5C',
  WAYPOINT: '#B6AC97',
  LOITER: '#B6AC97',
  RTL: '#B6AC97'
}

function createWaypointBillboard(seq: number, color: string): string {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Circle fill
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  // Border
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(24,28,20,0.8)'
  ctx.stroke()

  // Number text
  ctx.fillStyle = '#181C14'
  ctx.font = "bold 18px 'JetBrains Mono', monospace"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(seq + 1), size / 2, size / 2)

  return canvas.toDataURL('image/png')
}

interface CesiumMapProps {
  initialCenter?: { lon: number; lat: number; zoom: number } | null
}

export function CesiumMap({ initialCenter }: CesiumMapProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const entityRef = useRef<Cesium.Entity | null>(null)
  const hasFlownRef = useRef(false)
  const prevHeadingRef = useRef<number | null>(null)
  const accHeadingRef = useRef(0)
  const pathEntityRef = useRef<Cesium.Entity | null>(null)
  const lastTrailMsRef = useRef(0)
  const [error, setError] = useState<string | null>(null)

  const telemetry = useTelemetryStore((state) => state.telemetry)
  const history = useTelemetryStore((state) => state.history)
  const waypoints = useMissionStore((state) => state.waypoints)

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const container = containerRef.current
    let removeDepthPatch: (() => void) | undefined
    let resizeTimer: ReturnType<typeof setTimeout> | undefined

    try {
      Cesium.Ion.defaultAccessToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZjE2MmRhMi0wMzRiLTQ4MGItYTE0Yi01NTk3ZWY2Yjg3MWUiLCJpZCI6MzkxOTkyLCJpYXQiOjE3NzE1MDkwODh9.pf3-Gjw9bfY1-GhlCdCdB_Khnvl094ULGmdhk7109A0'

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
        shouldAnimate: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        baseLayer: new Cesium.ImageryLayer(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maximumLevel: 19,
            credit: 'Tiles \u00a9 Esri'
          })
        )
      })

      Cesium.CesiumTerrainProvider.fromIonAssetId(1, { requestVertexNormals: false })
        .then((terrain) => {
          if (viewerRef.current) {
            viewerRef.current.terrainProvider = terrain
            viewerRef.current.scene.requestRender()
          }
        })
        .catch(() => {})

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

      // 3D GLB 드론 모델 엔티티
      entityRef.current = viewer.entities.add({
        name: 'Drone',
        position: initPos,
        orientation: new Cesium.ConstantProperty(computeDroneOrientation(initPos, 0, 0, 0)),
        model: {
          uri: DRONE_MODEL_URI,
          scale: DRONE_MODEL_SCALE,
          minimumPixelSize: DRONE_MIN_PIXEL_SIZE,
          maximumScale: DRONE_MAX_SCALE,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          silhouetteColor: Cesium.Color.fromCssColorString('#ECDFCC'),
          silhouetteSize: 1.0,
          shadows: Cesium.ShadowMode.DISABLED
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

      // postUpdate: depth patch
      removeDepthPatch = viewer.scene.postUpdate.addEventListener(() => {
        if (entityRef.current) {
          patchModelDepth(viewer.scene, entityRef.current)
        }
      })

      resizeTimer = setTimeout(() => {
        if (viewer.isDestroyed()) return
        viewer.forceResize()
        viewer.scene.requestRender()
      }, 300)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      console.error('[CesiumMap] init error:', e)
    }

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      removeDepthPatch?.()
      viewerRef.current?.destroy()
      viewerRef.current = null
      pathEntityRef.current = null
      lastTrailMsRef.current = 0
    }
  }, [])

  // Update drone position
  useEffect(() => {
    if (!viewerRef.current || !telemetry || !entityRef.current) return

    const { lat, lon, relative_alt } = telemetry.position
    const heading = telemetry.heading
    // FCC(X7/DYNAMICS)는 relative_alt를 NED-down(음수=위)로 보냄. Cesium height는 양수=위이므로 부호 반전.
    // (숫자 패널 TelemetryPanel/AltimeterIndicator도 동일하게 -relative_alt 사용 → 앱 전체 규약 통일)
    const altUp = -relative_alt

    if (lat === 0 && lon === 0) return

    // Heading unwrap — shortest-path delta 누적
    if (prevHeadingRef.current === null) {
      prevHeadingRef.current = heading
      accHeadingRef.current = heading
    } else {
      let delta = heading - prevHeadingRef.current
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360
      prevHeadingRef.current = heading
      accHeadingRef.current += delta
    }
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, altUp)
    entityRef.current.position = new Cesium.ConstantPositionProperty(position)
    entityRef.current.orientation = new Cesium.ConstantProperty(
      computeDroneOrientation(
        position,
        accHeadingRef.current,
        telemetry.attitude.pitch,
        telemetry.attitude.roll
      )
    )
    if (entityRef.current.label) {
      entityRef.current.label.show = new Cesium.ConstantProperty(true)
      entityRef.current.label.text = new Cesium.ConstantProperty(`ALT: ${altUp.toFixed(0)}m`)
    }

    if (!hasFlownRef.current) {
      hasFlownRef.current = true
      // requestRenderMode에서는 애니메이션 카메라(flyTo)가 렌더 펌프 없이 멈추므로 즉시 setView로 배치
      viewerRef.current.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 2500),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-89.9),
          roll: 0.0
        }
      })
    }

    viewerRef.current.scene.requestRender()
  }, [telemetry])

  // Draw path trail — entity 1회 생성 후 positions만 10Hz로 갱신 (매 프레임 remove/add GPU churn 방지)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || history.length < 2) return

    // 10Hz(100ms) 스로틀 — 보드 위치 텔레메트리(GLOBAL_POSITION 10Hz)와 동일 상한 (그 이상은 새 위치점 없음)
    const now = performance.now()
    if (now - lastTrailMsRef.current < 100) return
    lastTrailMsRef.current = now

    const positions = history
      .filter((t) => t.position.lat !== 0 && t.position.lon !== 0)
      .map((t) =>
        // NED-down(음수=위) → Cesium 양수=위 부호 반전 (드론 위치와 동일 규약)
        Cesium.Cartesian3.fromDegrees(t.position.lon, t.position.lat, -t.position.relative_alt)
      )
    if (positions.length < 2) return

    if (!pathEntityRef.current) {
      pathEntityRef.current = viewer.entities.add({
        id: 'path',
        name: 'Flight Path',
        polyline: {
          positions: new Cesium.ConstantProperty(positions),
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.CYAN
          }),
          clampToGround: false
        }
      })
    } else if (pathEntityRef.current.polyline) {
      pathEntityRef.current.polyline.positions = new Cesium.ConstantProperty(positions)
    }
    viewer.scene.requestRender()
  }, [history])

  // Mission waypoint overlay
  useEffect(() => {
    if (!viewerRef.current) return

    const viewer = viewerRef.current

    // Remove existing mission entities
    const oldPolyline = viewer.entities.getById(MISSION_POLYLINE_ID)
    if (oldPolyline) viewer.entities.remove(oldPolyline)

    // Remove existing waypoint markers and altitude sticks
    const toRemove: Cesium.Entity[] = []
    viewer.entities.values.forEach((e) => {
      if (e.id?.startsWith(MISSION_MARKER_PREFIX) || e.id?.startsWith(MISSION_STICK_PREFIX))
        toRemove.push(e)
    })
    toRemove.forEach((e) => viewer.entities.remove(e))

    if (waypoints.length === 0) {
      // 미션 클리어 시에도 지워진 오버레이가 화면에서 사라지도록 렌더 요청 (requestRenderMode)
      viewer.scene.requestRender()
      return
    }

    // Filter waypoints with valid coordinates for polyline
    const navPoints = waypoints.filter((w) => !(w.lat === 0 && w.lon === 0))

    // Draw mission polyline if 2+ navigable points
    if (navPoints.length >= 2) {
      const positions = navPoints.map((w) => Cesium.Cartesian3.fromDegrees(w.lon, w.lat, w.alt))
      viewer.entities.add({
        id: MISSION_POLYLINE_ID,
        name: 'Mission Path',
        polyline: {
          positions,
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#FFFFFF'),
            dashLength: 16
          }),
          clampToGround: false
        }
      })
    }

    // Create waypoint markers + altitude sticks
    waypoints.forEach((wp, seq) => {
      const color = CESIUM_ACTION_COLORS[wp.action]
      const hasPosition = !(wp.lat === 0 && wp.lon === 0)

      // Altitude stick: ground → waypoint altitude
      if (hasPosition && wp.alt > 0) {
        viewer.entities.add({
          id: `${MISSION_STICK_PREFIX}${seq}`,
          polyline: {
            positions: [
              Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, 0),
              Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt)
            ],
            width: 1.5,
            material: new Cesium.ColorMaterialProperty(
              Cesium.Color.fromCssColorString(color).withAlpha(0.5)
            ),
            clampToGround: false
          }
        })
      }

      viewer.entities.add({
        id: `${MISSION_MARKER_PREFIX}${seq}`,
        name: `WP ${seq + 1}`,
        position: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt),
        billboard: {
          image: createWaypointBillboard(seq, color),
          width: 24,
          height: 24,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          heightReference: Cesium.HeightReference.NONE
        },
        label: hasPosition
          ? {
              text: `${wp.alt}m`,
              font: "10px 'JetBrains Mono', monospace",
              fillColor: Cesium.Color.fromCssColorString(color),
              outlineColor: Cesium.Color.fromCssColorString('#181C14'),
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              pixelOffset: new Cesium.Cartesian2(0, -16),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: Cesium.HeightReference.NONE
            }
          : undefined
      })
    })

    viewer.scene.requestRender()
  }, [waypoints])

  if (error) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#181C14',
          color: '#ECDFCC',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          padding: '20px',
          gap: '8px'
        }}
      >
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
