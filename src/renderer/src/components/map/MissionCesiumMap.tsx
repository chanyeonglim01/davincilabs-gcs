import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import type { Waypoint } from '@renderer/store/missionStore'
import droneIconUrl from '@renderer/assets/drone_icon.svg'

const _droneImg = new Image()
_droneImg.src = droneIconUrl

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
  selectedUid?: number | null
  onAddWaypoint?: (lat: number, lon: number) => void
  onSelectWaypoint?: (uid: number | null) => void
  onMoveWaypoint?: (uid: number, lat: number, lon: number) => void
}

export interface MissionCesiumMapHandle {
  getCameraState: () => { lon: number; lat: number; zoom: number } | null
}

// ─── Component ───────────────────────────────────────────────────────────────
export const MissionCesiumMap = forwardRef<MissionCesiumMapHandle, MissionCesiumMapProps>(
function MissionCesiumMap({ initialCenter, waypoints, selectedUid, onAddWaypoint, onSelectWaypoint, onMoveWaypoint }, ref) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const viewerRef       = useRef<Cesium.Viewer | null>(null)
  const droneEntityRef  = useRef<Cesium.Entity | null>(null)
  const wpEntityIdsRef  = useRef<string[]>([])
  // initialCenter provided = user switched from 2D → keep that position, skip auto-fly
  const hasFlownRef     = useRef<boolean>(initialCenter != null)

  // Callback refs — always point to latest prop without re-subscribing the handler
  const onAddWaypointRef    = useRef(onAddWaypoint)
  const onSelectWaypointRef = useRef(onSelectWaypoint)
  const onMoveWaypointRef   = useRef(onMoveWaypoint)
  onAddWaypointRef.current    = onAddWaypoint
  onSelectWaypointRef.current = onSelectWaypoint
  onMoveWaypointRef.current   = onMoveWaypoint

  // 최신 waypoints를 드래그 핸들러에서 참조하기 위한 ref
  const waypointsRef = useRef(waypoints)
  waypointsRef.current = waypoints

  // 드래그 상태
  const dragStateRef    = useRef<{ uid: number } | null>(null)
  const dragMovedRef    = useRef(false)
  const lastDragPosRef  = useRef<{ lat: number; lon: number } | null>(null)
  const justDraggedRef  = useRef(false)

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
          width:                    128,
          height:                   184,
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

  // ── 카메라 컨트롤 ON/OFF 헬퍼 ─────────────────────────────────────────────
  function setCameraEnabled(viewer: Cesium.Viewer, enabled: boolean) {
    const ctrl = viewer.scene.screenSpaceCameraController
    ctrl.enableRotate    = enabled
    ctrl.enableTranslate = enabled
    ctrl.enableZoom      = enabled
    ctrl.enableTilt      = enabled
  }

  // uid로 entity id prefix 파싱 ("wp-dot-42" → 42)
  function parseWpUid(entityId: string): number | null {
    if (!entityId.startsWith('wp-')) return null
    const parts = entityId.split('-')
    const uid = parseInt(parts[parts.length - 1], 10)
    return isNaN(uid) ? null : uid
  }

  // ── 인터랙션 핸들러 (클릭 추가 / 선택 / 드래그 이동) ──────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas)

    // ── LEFT_DOWN: 웨이포인트 위에서 누르면 드래그 시작 ──────────────────────
    handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(e.position)
      if (!Cesium.defined(picked) || !(picked.id instanceof Cesium.Entity)) return
      const uid = parseWpUid(picked.id.id)
      if (uid === null) return

      dragStateRef.current   = { uid }
      dragMovedRef.current   = false
      lastDragPosRef.current = null
      setCameraEnabled(viewer, false)
      viewer.canvas.style.cursor = 'grabbing'
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN)

    // ── MOUSE_MOVE: 호버 커서 + 드래그 중 entity 위치 업데이트 ─────────────────
    handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      // 드래그 중이 아닐 때: 웨이포인트 위면 pointer, 아니면 default
      if (!dragStateRef.current) {
        const picked = viewer.scene.pick(e.endPosition)
        if (Cesium.defined(picked) && picked.id instanceof Cesium.Entity && parseWpUid(picked.id.id) !== null) {
          viewer.canvas.style.cursor = 'pointer'
        } else {
          viewer.canvas.style.cursor = 'default'
        }
        return
      }
      const { uid } = dragStateRef.current

      const ray = viewer.camera.getPickRay(e.endPosition)
      if (!ray) return
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene)
      if (!cartesian) return

      const carto = Cesium.Cartographic.fromCartesian(cartesian)
      const lat = Cesium.Math.toDegrees(carto.latitude)
      const lon = Cesium.Math.toDegrees(carto.longitude)

      dragMovedRef.current   = true
      lastDragPosRef.current = { lat, lon }

      // 현재 웨이포인트 고도 참조
      const wp  = waypointsRef.current.find((w) => w.uid === uid)
      const alt = wp?.alt ?? 0

      // dot + 고도 라벨 위치 이동
      const newPos = Cesium.Cartesian3.fromDegrees(lon, lat, alt)
      const dot = viewer.entities.getById(`wp-dot-${uid}`)
      const lbl = viewer.entities.getById(`wp-lbl-${uid}`)
      if (dot) dot.position = new Cesium.ConstantPositionProperty(newPos)
      if (lbl) lbl.position = new Cesium.ConstantPositionProperty(newPos)

      // 수직 stick 이동
      const stick = viewer.entities.getById(`wp-stick-${uid}`)
      if (stick?.polyline) {
        stick.polyline.positions = new Cesium.ConstantProperty([
          Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          Cesium.Cartesian3.fromDegrees(lon, lat, alt),
        ])
      }

      // 경로 polyline 전체 갱신
      const path = viewer.entities.getById('wp-path')
      if (path?.polyline) {
        const positions = waypointsRef.current
          .filter((w) => HAS_ALT[w.action])
          .map((w) =>
            w.uid === uid
              ? Cesium.Cartesian3.fromDegrees(lon, lat, alt)
              : Cesium.Cartesian3.fromDegrees(w.lon, w.lat, w.alt)
          )
        path.polyline.positions = new Cesium.ConstantProperty(positions)
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    // ── LEFT_UP: 드래그 끝 → 위치 확정 ─────────────────────────────────────
    handler.setInputAction(() => {
      setCameraEnabled(viewer, true)
      viewer.canvas.style.cursor = 'default'
      if (!dragStateRef.current) return
      const { uid } = dragStateRef.current
      const moved   = dragMovedRef.current
      const pos     = lastDragPosRef.current

      dragStateRef.current   = null
      dragMovedRef.current   = false
      lastDragPosRef.current = null

      if (moved && pos) {
        justDraggedRef.current = true
        setTimeout(() => { justDraggedRef.current = false }, 50)
        onMoveWaypointRef.current?.(
          uid,
          parseFloat(pos.lat.toFixed(7)),
          parseFloat(pos.lon.toFixed(7))
        )
      }
    }, Cesium.ScreenSpaceEventType.LEFT_UP)

    // ── LEFT_CLICK: 선택 / 웨이포인트 추가 ──────────────────────────────────
    handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      // 드래그 직후에는 클릭 무시 (드래그 끝 좌표에서 오탐 방지)
      if (justDraggedRef.current) return

      const picked = viewer.scene.pick(click.position)
      if (Cesium.defined(picked) && picked.id instanceof Cesium.Entity) {
        const uid = parseWpUid(picked.id.id)
        if (uid !== null) {
          onSelectWaypointRef.current?.(uid)
        }
        return
      }

      // 빈 지형 클릭 → 웨이포인트 추가
      const ray = viewer.camera.getPickRay(click.position)
      if (!ray) return
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene)
      if (!cartesian) return

      const carto = Cesium.Cartographic.fromCartesian(cartesian)
      const lat = parseFloat(Cesium.Math.toDegrees(carto.latitude).toFixed(7))
      const lon = parseFloat(Cesium.Math.toDegrees(carto.longitude).toFixed(7))
      onAddWaypointRef.current?.(lat, lon)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      handler.destroy()
      if (viewerRef.current) setCameraEnabled(viewerRef.current, true)
    }
  }, []) // 한 번만 실행 — 최신 값은 모두 ref로 접근

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
          width:    2.5,
          material: new Cesium.ColorMaterialProperty(cesiumColor.withAlpha(0.5)),
          clampToGround: false,
        },
      })
      wpEntityIdsRef.current.push(stickId)

      // Dot marker at altitude — 2D Leaflet 스타일 캔버스 아이콘
      const dotId = `wp-dot-${wp.uid}`
      const isSelected = selectedUid === wp.uid
      viewer.entities.add({
        id:       dotId,
        position: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt),
        billboard: {
          image:                    createWaypointIcon(seq, colorHex, isSelected),
          width:                    40,
          height:                   40,
          heightReference:           Cesium.HeightReference.NONE,
          disableDepthTestDistance:  Number.POSITIVE_INFINITY,
          verticalOrigin:            Cesium.VerticalOrigin.CENTER,
          horizontalOrigin:          Cesium.HorizontalOrigin.CENTER,
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
          width:    3,
          material: new Cesium.PolylineDashMaterialProperty({
            color:     Cesium.Color.fromCssColorString('#4FC3F7').withAlpha(0.75),
            dashLength: 16,
          }),
          clampToGround: false,
        },
      })
      wpEntityIdsRef.current.push(pathId)
    }
  }, [waypoints, selectedUid]) // eslint-disable-line react-hooks/exhaustive-deps

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

// ─── Drone icon using drone_icon.svg + heading line ─────────────────────────
const _ICON_W = 128
const _ICON_H = 184
const _DRONE_Y = 50
const _DRONE_H = 83  // 128 / (1011/659)

function createDroneIcon(heading: number): string {
  const K = 4
  const ICON_W = _ICON_W
  const ICON_H = _ICON_H
  const DRONE_Y = _DRONE_Y
  const DRONE_H = _DRONE_H
  const canvas = document.createElement('canvas')
  canvas.width  = ICON_W * K
  canvas.height = ICON_H * K
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(K, K)

  const cx = 64
  const cy = 92  // DRONE_Y + DRONE_H/2 = 50 + 41.5

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((heading * Math.PI) / 180)
  ctx.translate(-cx, -cy)

  // Heading indicator (기체 앞쪽으로 뻗음)
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

// ─── Canvas waypoint icon (2D Leaflet 스타일과 동일) ─────────────────────────
function createWaypointIcon(seq: number, colorHex: string, isSelected: boolean): string {
  const SIZE = 40
  const K    = 2  // retina
  const canvas = document.createElement('canvas')
  canvas.width  = SIZE * K
  canvas.height = SIZE * K
  const ctx = canvas.getContext('2d')!
  ctx.scale(K, K)

  const cx = SIZE / 2
  const cy = SIZE / 2
  const r  = 13

  // 선택 시 외부 흰 링
  if (isSelected) {
    ctx.beginPath()
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // 어두운 아웃라인 (위성 배경 대비)
  ctx.beginPath()
  ctx.arc(cx, cy, r + 1, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'
  ctx.lineWidth = 3
  ctx.stroke()

  // 솔리드 컬러 fill
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = colorHex + 'DD'  // ~87% opacity
  ctx.fill()

  // 순서 번호 (어두운 색 — 밝은 배경 대비)
  ctx.fillStyle = '#181C14'
  ctx.font = "bold 11px 'JetBrains Mono', monospace"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(seq), cx, cy + 0.5)

  return canvas.toDataURL('image/png')
}
