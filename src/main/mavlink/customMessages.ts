/**
 * Custom MAVLink v2 Messages — LIHAI / KETI (WIRE CONTRACT SoT)
 *
 * 이 파일은 FCC C++ 인코더와 GCS 파서가 byte-for-byte 일치해야 하는 단일 진실 소스다.
 * FCC는 sysid=1 compid=1로 송신, GCS는 255/190. Little-endian.
 * incompat_flags=0, compat_flags=0.
 *
 * MSG 1 — LIHAI_STATUS
 *   msgid = 42001
 *   CRC_EXTRA = 103
 *   payload = 8 bytes, offsets (payload byte X = packet byte 10+X on GCS side):
 *    [0] link                    uint8   (1 = LIHAI serial frames arriving recently / connected, 0 = stale)
 *    [1] bat_error               uint8
 *    [2] gps_error               uint8
 *    [3] imu_error               uint8
 *    [4] barometer_error         uint8
 *    [5] rc_error                uint8
 *    [6] angle_control_error     uint8
 *    [7] position_control_error  uint8
 *   Source: g_state_err (fcc.h:34, defined main.cpp:149), written by lihai_rx (lihai.h).
 *   link derived from time since last successful read_state_errors_packet20.
 *
 * MSG 2 — KETI_OBSTACLE
 *   msgid = 42002
 *   CRC_EXTRA = 104
 *   payload = 24 bytes, offsets:
 *    [0]  distance  float32   nearest-object distance (m)
 *    [4]  obj_x     float32   relative x (m)
 *    [8]  obj_y     float32   relative y (m)
 *    [12] obj_z     float32   relative z (m)
 *    [16] size      float32   nearest-object size
 *    [20] valid     uint8     1 = detection valid, 0 = stale (500ms no-rx)
 *    [21] count     uint8     total object count
 *    [22] id        uint8     nearest-object class id
 *    [23] reserved  uint8     0
 *   Source: g_fcc.keti_* (fcc.h:153-161), written by keti_thread_fn (keti.h).
 *   Note fcc.h keti_distance/size/obj_* are double -> cast to float32 on the wire.
 *
 * CRC = MAVLink v2 CRC-16/MCRF4XX over [len,incompat,compat,seq,sysid,compid,msgid(3),payload]
 * then accumulate CRC_EXTRA byte, appended LE. FCC sends full (untruncated) payload length;
 * GCS already zero-pads payload to a fixed buffer so fixed offsets are safe.
 */

export const CUSTOM_MSG = {
  LIHAI_STATUS: { id: 42001, crcExtra: 103 },
  KETI_OBSTACLE: { id: 42002, crcExtra: 104 }
} as const

/**
 * LIHAI_STATUS (msgid 42001) 디코딩 결과
 */
export interface LihaiStatus {
  /** [0] 1 = LIHAI serial frames arriving recently / connected, 0 = stale */
  link: boolean
  /** [1] battery error flag */
  batError: number
  /** [2] GPS error flag */
  gpsError: number
  /** [3] IMU error flag */
  imuError: number
  /** [4] barometer error flag */
  barometerError: number
  /** [5] RC error flag */
  rcError: number
  /** [6] angle control error flag */
  angleControlError: number
  /** [7] position control error flag */
  positionControlError: number
}

/**
 * KETI_OBSTACLE (msgid 42002) 디코딩 결과
 */
export interface KetiObstacle {
  /** [0] nearest-object distance (m) */
  distance: number
  /** [4] relative x (m) */
  objX: number
  /** [8] relative y (m) */
  objY: number
  /** [12] relative z (m) */
  objZ: number
  /** [16] nearest-object size */
  size: number
  /** [20] 1 = detection valid, 0 = stale (500ms no-rx) */
  valid: boolean
  /** [21] total object count */
  count: number
  /** [22] nearest-object class id */
  id: number
}

/**
 * LIHAI_STATUS payload (8 bytes) → LihaiStatus
 *
 * payload는 이미 10바이트 헤더가 제거되고 고정 버퍼로 zero-pad된 상태로 가정한다.
 */
export function decodeLihaiStatus(payload: Buffer): LihaiStatus {
  return {
    link: payload.readUInt8(0) !== 0,
    batError: payload.readUInt8(1),
    gpsError: payload.readUInt8(2),
    imuError: payload.readUInt8(3),
    barometerError: payload.readUInt8(4),
    rcError: payload.readUInt8(5),
    angleControlError: payload.readUInt8(6),
    positionControlError: payload.readUInt8(7)
  }
}

/**
 * KETI_OBSTACLE payload (24 bytes) → KetiObstacle
 *
 * payload는 이미 10바이트 헤더가 제거되고 고정 버퍼로 zero-pad된 상태로 가정한다.
 */
export function decodeKetiObstacle(payload: Buffer): KetiObstacle {
  return {
    distance: payload.readFloatLE(0),
    objX: payload.readFloatLE(4),
    objY: payload.readFloatLE(8),
    objZ: payload.readFloatLE(12),
    size: payload.readFloatLE(16),
    valid: payload.readUInt8(20) !== 0,
    count: payload.readUInt8(21),
    id: payload.readUInt8(22)
  }
}
