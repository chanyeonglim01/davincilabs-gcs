import * as Cesium from 'cesium'

export const DRONE_MODEL_URI = '/models/drone.glb'
export const DRONE_MODEL_SCALE = 0.01 // 극소 world-space → minimumPixelSize가 항상 적용됨
export const DRONE_MIN_PIXEL_SIZE = 130 // 화면 고정 픽셀 크기 (줌 무관)
export const DRONE_MAX_SCALE = 500000 // minimumPixelSize 스케일 업 상한
export const MODEL_HEADING_OFFSET_DEG = 180

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
