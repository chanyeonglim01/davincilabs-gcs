import * as Cesium from 'cesium'

export const DRONE_MODEL_URI = '/models/drone.glb'
export const DRONE_MODEL_SCALE = 0.01          // 극소 world-space → minimumPixelSize가 항상 적용됨
export const DRONE_MIN_PIXEL_SIZE = 130        // 화면 고정 픽셀 크기 (줌 무관)
export const DRONE_MAX_SCALE = 500000          // minimumPixelSize 스케일 업 상한
export const MODEL_HEADING_OFFSET_DEG = 180

// ─── Heading stick billboard 상수 ─────────────────────────────────────────────
export const STICK_WIDTH_PX  = 6
export const STICK_LENGTH_PX = Math.round(DRONE_MIN_PIXEL_SIZE * 0.4)   // ~52px
export const STICK_NOSE_PX   = Math.round(DRONE_MIN_PIXEL_SIZE * 0.42)  // ~55px
export const STICK_SCREEN_Y_OFFSET_PX = 10  // 노즈 높이 보정 (양수=화면 아래)

function createStickImage(): string {
  const K = 2
  const W = STICK_WIDTH_PX
  const H = STICK_LENGTH_PX
  const canvas = document.createElement('canvas')
  canvas.width  = W * K
  canvas.height = H * K
  const ctx = canvas.getContext('2d')!
  ctx.scale(K, K)

  // Glow
  ctx.beginPath()
  ctx.moveTo(W / 2, 2)
  ctx.lineTo(W / 2, H - 2)
  ctx.globalAlpha = 0.35
  ctx.strokeStyle = '#FFB060'
  ctx.lineWidth = W + 4
  ctx.lineCap = 'round'
  ctx.stroke()

  // Main line
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.moveTo(W / 2, 2)
  ctx.lineTo(W / 2, H - 2)
  ctx.strokeStyle = '#FFB060'
  ctx.lineWidth = W - 1
  ctx.lineCap = 'round'
  ctx.stroke()

  return canvas.toDataURL('image/png')
}

/** 모듈 로드 시 1회 생성 (renderer 컨텍스트 전용) */
export const HEADING_STICK_IMAGE = createStickImage()

export function computeDroneOrientation(
  position: Cesium.Cartesian3,
  headingDeg: number,
  pitchRad: number,
  rollRad: number
): Cesium.Quaternion {
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(headingDeg + MODEL_HEADING_OFFSET_DEG),
    pitchRad,
    rollRad
  )
  return Cesium.Transforms.headingPitchRollQuaternion(position, hpr)
}

/**
 * 3D 타일셋(OSM 건물)이 드론 모델을 가리지 않도록 draw command depth test 비활성화.
 * scene.postUpdate 이벤트에서 매 프레임 호출.
 */
export function patchModelDepth(scene: Cesium.Scene, entity: Cesium.Entity): void {
  const primitives = scene.primitives
  for (let i = 0; i < primitives.length; i++) {
    const p = primitives.get(i) as any
    if (!p || p.id !== entity || !p.ready) continue

    const nodes: any[] = p._sceneGraph?._runtimeNodes ?? []
    for (const node of nodes) {
      if (!node) continue
      for (const rp of node.runtimePrimitives ?? []) {
        const derivedCmds: any[] = rp?.drawCommand?._derivedCommands ?? []
        for (const derived of derivedCmds) {
          const cmd = derived?.command
          if (!cmd?.renderState?.depthTest?.enabled) continue
          const rs = (Cesium as any).clone(cmd.renderState, true)
          rs.depthTest.enabled = false
          cmd.renderState = (Cesium as any).RenderState.fromCache(rs)
        }
      }
    }
    break
  }
}
