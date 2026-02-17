/**
 * MAVLink Mission Upload Protocol
 *
 * Implements QGC-compatible MISSION_ITEM_INT upload sequence:
 *   GCS → Drone  : MISSION_COUNT
 *   Drone → GCS  : MISSION_REQUEST_INT (per item)
 *   GCS → Drone  : MISSION_ITEM_INT   (per item)
 *   Drone → GCS  : MISSION_ACK
 *
 * References:
 *   https://mavlink.io/en/services/mission.html
 *   PX4 autopilot mission protocol
 */

import type { MavlinkConnection } from './connection'

// ─── Message IDs ───────────────────────────────────────────────────────────────
const MSGID_MISSION_CLEAR_ALL = 45
const MSGID_MISSION_COUNT     = 44
const MSGID_MISSION_ITEM_INT  = 73

// ─── CRC_EXTRA table (from MAVLink XML definitions) ───────────────────────────
const CRC_EXTRA: Record<number, number> = {
  44: 221, // MISSION_COUNT
  45: 232, // MISSION_CLEAR_ALL
  73: 38,  // MISSION_ITEM_INT
  47: 153, // MISSION_ACK
  40: 230, // MISSION_REQUEST
  51: 196, // MISSION_REQUEST_INT
}

// ─── MAVLink frame constants ───────────────────────────────────────────────────
const MAV_FRAME_GLOBAL_RELATIVE_ALT = 3  // alt relative to home position
const MAV_FRAME_MISSION             = 2  // frame-less commands (RTL, transition…)

// ─── MAV_MISSION_RESULT ────────────────────────────────────────────────────────
export const MAV_MISSION_ACCEPTED = 0

// ─── Waypoint type (mirrors renderer missionStore.Waypoint) ───────────────────
export interface MissionWaypoint {
  action: string
  lat: number
  lon: number
  alt: number
  acceptRadius: number
  loiterRadius: number
}

// ─── Internal item representation ─────────────────────────────────────────────
interface ItemParams {
  frame: number
  command: number
  autocontinue: number
  param1: number; param2: number; param3: number; param4: number
  lat: number; lon: number; alt: number
}

// ─── CRC-16/MCRF4XX ───────────────────────────────────────────────────────────
function crc16Mcrf4xx(data: Buffer, crcExtra: number): number {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    let tmp = (data[i] ^ crc) & 0xff
    tmp = (tmp ^ (tmp << 4)) & 0xff
    crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff
  }
  // Append CRC_EXTRA byte
  let tmp = (crcExtra ^ crc) & 0xff
  tmp = (tmp ^ (tmp << 4)) & 0xff
  crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff
  return crc
}

// ─── MAVLink v2 packet builder ─────────────────────────────────────────────────
let _seq = 0
const GCS_SYSID  = 255
const GCS_COMPID = 190  // MAV_COMP_ID_MISSIONPLANNER

function buildPacket(msgid: number, payload: Buffer): Buffer {
  const hdr = Buffer.alloc(10)
  hdr[0] = 0xfd
  hdr[1] = payload.length
  hdr[2] = 0           // incompat flags
  hdr[3] = 0           // compat flags
  hdr[4] = _seq++ & 0xff
  hdr[5] = GCS_SYSID
  hdr[6] = GCS_COMPID
  hdr[7] =  msgid        & 0xff
  hdr[8] = (msgid >> 8)  & 0xff
  hdr[9] = (msgid >> 16) & 0xff

  const crcInput = Buffer.concat([hdr.subarray(1), payload])
  const checksum = crc16Mcrf4xx(crcInput, CRC_EXTRA[msgid] ?? 0)
  const crcBuf = Buffer.alloc(2)
  crcBuf.writeUInt16LE(checksum, 0)

  return Buffer.concat([hdr, payload, crcBuf])
}

// ─── Message builders ──────────────────────────────────────────────────────────
function buildMissionClearAll(targetSystem = 1, targetComponent = 1): Buffer {
  const payload = Buffer.alloc(3)
  payload.writeUInt8(targetSystem,    0)
  payload.writeUInt8(targetComponent, 1)
  payload.writeUInt8(0,               2) // MAV_MISSION_TYPE_MISSION
  return buildPacket(MSGID_MISSION_CLEAR_ALL, payload)
}

function buildMissionCount(count: number, targetSystem = 1, targetComponent = 1): Buffer {
  const payload = Buffer.alloc(5)
  payload.writeUInt16LE(count,          0)
  payload.writeUInt8(targetSystem,      2)
  payload.writeUInt8(targetComponent,   3)
  payload.writeUInt8(0,                 4) // MAV_MISSION_TYPE_MISSION
  return buildPacket(MSGID_MISSION_COUNT, payload)
}

function buildMissionItemInt(
  seq: number,
  item: ItemParams,
  current: number,
  targetSystem = 1,
  targetComponent = 1
): Buffer {
  const payload = Buffer.alloc(38)
  payload.writeFloatLE(item.param1,                 0)
  payload.writeFloatLE(item.param2,                 4)
  payload.writeFloatLE(item.param3,                 8)
  payload.writeFloatLE(item.param4,                12)
  payload.writeInt32LE(Math.round(item.lat * 1e7), 16)
  payload.writeInt32LE(Math.round(item.lon * 1e7), 20)
  payload.writeFloatLE(item.alt,                   24)
  payload.writeUInt16LE(seq,                       28)
  payload.writeUInt16LE(item.command,              30)
  payload.writeUInt8(targetSystem,                 32)
  payload.writeUInt8(targetComponent,              33)
  payload.writeUInt8(item.frame,                   34)
  payload.writeUInt8(current,                      35)
  payload.writeUInt8(item.autocontinue,            36)
  payload.writeUInt8(0,                            37) // MAV_MISSION_TYPE_MISSION
  return buildPacket(MSGID_MISSION_ITEM_INT, payload)
}

// ─── Action → MAVLink params ───────────────────────────────────────────────────
function actionToParams(wp: MissionWaypoint): ItemParams {
  switch (wp.action) {
    case 'VTOL_TAKEOFF':
      return {
        frame: MAV_FRAME_GLOBAL_RELATIVE_ALT, command: 84, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: NaN,
        lat: wp.lat, lon: wp.lon, alt: wp.alt,
      }
    case 'MC_TAKEOFF':
    case 'FW_TAKEOFF':
      return {
        frame: MAV_FRAME_GLOBAL_RELATIVE_ALT, command: 22, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: NaN,
        lat: wp.lat, lon: wp.lon, alt: wp.alt,
      }
    case 'WAYPOINT':
      return {
        frame: MAV_FRAME_GLOBAL_RELATIVE_ALT, command: 16, autocontinue: 1,
        param1: 0, param2: wp.acceptRadius, param3: 0, param4: NaN,
        lat: wp.lat, lon: wp.lon, alt: wp.alt,
      }
    case 'LOITER':
      return {
        frame: MAV_FRAME_GLOBAL_RELATIVE_ALT, command: 17, autocontinue: 0,
        param1: 0, param2: 0, param3: wp.loiterRadius, param4: 0,
        lat: wp.lat, lon: wp.lon, alt: wp.alt,
      }
    case 'VTOL_TRANSITION_FW':
      return {
        frame: MAV_FRAME_MISSION, command: 3000, autocontinue: 1,
        param1: 4, param2: 0, param3: 0, param4: 0,  // MAV_VTOL_STATE_FW=4
        lat: 0, lon: 0, alt: 0,
      }
    case 'VTOL_TRANSITION_MC':
      return {
        frame: MAV_FRAME_MISSION, command: 3000, autocontinue: 1,
        param1: 3, param2: 0, param3: 0, param4: 0,  // MAV_VTOL_STATE_MC=3
        lat: 0, lon: 0, alt: 0,
      }
    case 'VTOL_LAND':
      return {
        frame: MAV_FRAME_GLOBAL_RELATIVE_ALT, command: 85, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: NaN,
        lat: wp.lat, lon: wp.lon, alt: wp.alt,
      }
    case 'MC_LAND':
    case 'FW_LAND':
      return {
        frame: MAV_FRAME_GLOBAL_RELATIVE_ALT, command: 21, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: NaN,
        lat: wp.lat, lon: wp.lon, alt: 0,
      }
    case 'RTL':
      return {
        frame: MAV_FRAME_MISSION, command: 20, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: 0,
        lat: 0, lon: 0, alt: 0,
      }
    default:
      // Fallback: plain waypoint
      return {
        frame: MAV_FRAME_GLOBAL_RELATIVE_ALT, command: 16, autocontinue: 1,
        param1: 0, param2: wp.acceptRadius, param3: 0, param4: NaN,
        lat: wp.lat, lon: wp.lon, alt: wp.alt,
      }
  }
}

// ─── Mission Upload Result ─────────────────────────────────────────────────────
export interface MissionUploadResult {
  success: boolean
  count: number
  error?: string
}

// ─── MissionUploader ───────────────────────────────────────────────────────────
/**
 * Manages the MAVLink mission upload state machine.
 * One instance per upload attempt.
 *
 * Usage:
 *   const uploader = new MissionUploader(connection)
 *   parser.on('missionRequest', (seq) => uploader.onRequest(seq))
 *   parser.on('missionAck',    (type) => uploader.onAck(type))
 *   const result = await uploader.upload(waypoints)
 */
export class MissionUploader {
  private readonly conn: MavlinkConnection
  private items: ItemParams[] = []
  private uploadedCount = 0
  private timeout: NodeJS.Timeout | null = null
  private resolve: ((r: MissionUploadResult) => void) | null = null
  private done = false

  constructor(conn: MavlinkConnection) {
    this.conn = conn
  }

  async upload(
    waypoints: MissionWaypoint[],
    targetSystem = 1,
    targetComponent = 1
  ): Promise<MissionUploadResult> {
    if (waypoints.length === 0) {
      return { success: false, count: 0, error: 'No waypoints to upload' }
    }
    if (!this.conn.isConnected) {
      return { success: false, count: 0, error: 'Not connected to vehicle' }
    }

    this.items = waypoints.map((wp) => actionToParams(wp))
    this.done = false
    this.uploadedCount = 0

    return new Promise<MissionUploadResult>((resolve) => {
      this.resolve = resolve

      // 30s overall timeout
      this.timeout = setTimeout(() => {
        this.finish({ success: false, count: 0, error: 'Upload timeout (30s)' })
      }, 30_000)

      // Step 1: Clear existing mission
      this.conn.sendMessage(buildMissionClearAll(targetSystem, targetComponent))

      // Step 2: Announce item count after a short delay
      setTimeout(() => {
        if (!this.done) {
          this.conn.sendMessage(buildMissionCount(this.items.length, targetSystem, targetComponent))
          console.log(`[Mission] Count sent: ${this.items.length} items`)
        }
      }, 300)
    })
  }

  /** Called when drone requests a specific item (MISSION_REQUEST or MISSION_REQUEST_INT) */
  onRequest(seq: number, targetSystem = 1, targetComponent = 1): void {
    if (this.done || seq < 0 || seq >= this.items.length) return

    const item = this.items[seq]
    const current = seq === 0 ? 1 : 0
    const msg = buildMissionItemInt(seq, item, current, targetSystem, targetComponent)
    this.conn.sendMessage(msg)
    this.uploadedCount = Math.max(this.uploadedCount, seq + 1)
    console.log(`[Mission] Item ${seq}/${this.items.length - 1} sent (cmd=${item.command})`)
  }

  /** Called when drone sends MISSION_ACK */
  onAck(type: number): void {
    if (this.done) return
    if (type === MAV_MISSION_ACCEPTED) {
      this.finish({ success: true, count: this.items.length })
    } else {
      this.finish({ success: false, count: 0, error: `Mission rejected (MAV_MISSION_RESULT=${type})` })
    }
  }

  private finish(result: MissionUploadResult): void {
    if (this.done) return
    this.done = true
    if (this.timeout) { clearTimeout(this.timeout); this.timeout = null }
    this.resolve?.(result)
    this.resolve = null
  }
}
