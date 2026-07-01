/**
 * MAVLink Message Parser
 * Parses incoming MAVLink v2 messages and converts to TelemetryData
 * Simplified parser using basic buffer parsing (node-mavlink has limited API)
 */

import { EventEmitter } from 'events'
import type {
  TelemetryData,
  HomePosition,
  ParamEntry,
  CommandResult,
  CommandType
} from '../../renderer/src/types'
import { MAV_MODE_FLAG, MAV_STATE, MAV_RESULT } from '../../renderer/src/types'
import { decodeCustomMode, formatModeLabel, formatModeParts } from './customModes'
import { decodeLihaiStatus, decodeKetiObstacle } from './customMessages'

/**
 * MAVLink v2 CRC_EXTRA table by msgid.
 * Only includes message types we encode/decode.
 */
const CRC_EXTRA: Readonly<Record<number, number>> = {
  0: 50, // HEARTBEAT
  1: 124, // SYS_STATUS
  20: 214, // PARAM_REQUEST_READ
  21: 159, // PARAM_REQUEST_LIST
  22: 220, // PARAM_VALUE
  23: 168, // PARAM_SET
  24: 24, // GPS_RAW_INT
  30: 39, // ATTITUDE
  33: 104, // GLOBAL_POSITION_INT
  41: 28, // MISSION_SET_CURRENT
  42: 28, // MISSION_CURRENT
  43: 132, // MISSION_REQUEST_LIST
  44: 221, // MISSION_COUNT
  45: 232, // MISSION_CLEAR_ALL
  46: 11, // MISSION_ITEM_REACHED
  47: 153, // MISSION_ACK
  51: 196, // MISSION_REQUEST_INT
  73: 38, // MISSION_ITEM_INT
  74: 20, // VFR_HUD
  76: 152, // COMMAND_LONG
  77: 143, // COMMAND_ACK
  42001: 103, // LIHAI_STATUS (custom)
  42002: 104 // KETI_OBSTACLE (custom)
}

const GCS_SYSID = 255
const GCS_COMPID = 190

/**
 * CRC-16/MCRF4XX with CRC_EXTRA appended at the end.
 * Returns 0xFFFF on unknown msgid (so verification will fail).
 */
function calculateCrc(data: Buffer, msgid: number): number {
  const extra = CRC_EXTRA[msgid]
  if (extra === undefined) return 0xffff

  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    const tmp = data[i] ^ (crc & 0xff)
    const tmpShifted = (tmp ^ (tmp << 4)) & 0xff
    crc = ((crc >> 8) ^ (tmpShifted << 8) ^ (tmpShifted << 3) ^ (tmpShifted >> 4)) & 0xffff
  }
  const tmp = extra ^ (crc & 0xff)
  const tmpShifted = (tmp ^ (tmp << 4)) & 0xff
  crc = ((crc >> 8) ^ (tmpShifted << 8) ^ (tmpShifted << 3) ^ (tmpShifted >> 4)) & 0xffff
  return crc
}

/**
 * MISSION_ITEM_INT decoded payload (download).
 * `lat`/`lon` are stored as 1e7-scaled integers as on the wire so the
 * downloader can verify against what was originally sent without floating
 * point loss.
 */
export interface MissionItemInt {
  seq: number
  command: number
  frame: number
  current: number
  autocontinue: number
  param1: number
  param2: number
  param3: number
  param4: number
  /** Latitude * 1e7 (int32) */
  lat: number
  /** Longitude * 1e7 (int32) */
  lon: number
  /** Altitude in metres (float32) */
  alt: number
}

export interface MavlinkParserEvents {
  telemetry: (data: TelemetryData) => void
  homePosition: (home: HomePosition) => void
  paramValue: (param: ParamEntry) => void
  paramCount: (count: number) => void
  commandAck: (result: CommandResult) => void
  heartbeat: () => void
  missionRequest: (seq: number) => void
  missionAck: (type: number) => void
  missionCount: (count: number) => void
  missionItemInt: (item: MissionItemInt) => void
}

export declare interface MavlinkParser {
  on<U extends keyof MavlinkParserEvents>(event: U, listener: MavlinkParserEvents[U]): this
  emit<U extends keyof MavlinkParserEvents>(
    event: U,
    ...args: Parameters<MavlinkParserEvents[U]>
  ): boolean
}

export class MavlinkParser extends EventEmitter {
  private telemetryState: Partial<TelemetryData> = {}
  private lastTelemetryEmit: number = 0
  private homePositionSet: boolean = false
  private buffer: Buffer = Buffer.alloc(0)

  constructor() {
    super()

    // Initialize telemetry state with default values
    this.telemetryState = {
      attitude: { roll: 0, pitch: 0, yaw: 0, rollspeed: 0, pitchspeed: 0, yawspeed: 0 },
      position: { lat: 0, lon: 0, alt: 0, relative_alt: 0 },
      velocity: { vx: 0, vy: 0, vz: 0, groundspeed: 0, airspeed: 0, climb: 0 },
      status: {
        armed: false,
        flightMode: 'UNKNOWN',
        flightModeRaw: 0,
        subState: 0,
        rcOverride: false,
        rcLink: false,
        systemStatus: 'UNKNOWN',
        battery: { voltage: 0, current: 0, remaining: -1 },
        cpuLoad: 0,
        lihaiLink: false,
        lihaiErrors: { bat: 0, gps: 0, imu: 0, baro: 0, rc: 0, angle: 0, pos: 0 },
        ketiValid: false,
        ketiCount: 0,
        ketiId: 0,
        ketiDistance: 0,
        ketiObjX: 0,
        ketiObjY: 0,
        ketiObjZ: 0,
        ketiSize: 0
      },
      heading: 0,
      throttle: 0,
      timestamp: Date.now()
    }
  }

  /**
   * Parse incoming MAVLink buffer
   * Simplified approach: emit dummy telemetry for now
   * Full MAVLink v2 parsing would require detailed buffer parsing
   */
  parseBuffer(incomingBuffer: Buffer): void {
    // Append to internal buffer
    this.buffer = Buffer.concat([this.buffer, incomingBuffer])

    // Look for MAVLink v2 magic byte (0xFD), verify CRC, dispatch.
    // On length/CRC/flag failure, advance one byte and resync (do not drop the
    // entire buffer — a single bad byte should not lose subsequent good packets).
    while (this.buffer.length > 0) {
      const magicIndex = this.buffer.indexOf(0xfd)
      if (magicIndex === -1) {
        // No magic at all in buffer — drop everything except the last byte
        // (in case it is the start of a future magic)
        this.buffer =
          this.buffer.length > 0 ? this.buffer.subarray(this.buffer.length - 1) : Buffer.alloc(0)
        break
      }

      // Discard bytes before magic
      if (magicIndex > 0) {
        this.buffer = this.buffer.subarray(magicIndex)
      }

      // Need at least 12 bytes for header
      if (this.buffer.length < 12) {
        break
      }

      const payloadLen = this.buffer[1]
      const incompatFlags = this.buffer[2]

      // Drop packets with unsupported incompat flags (e.g. signing bit 0x01).
      // We only know how to verify unsigned packets.
      if ((incompatFlags & ~0x00) !== 0) {
        // Advance one byte and resync.
        this.buffer = this.buffer.subarray(1)
        continue
      }

      const signatureLen = (incompatFlags & 0x01) !== 0 ? 13 : 0
      const packetLen = 12 + payloadLen + signatureLen

      if (this.buffer.length < packetLen) {
        // Not enough data yet
        break
      }

      const packet = this.buffer.subarray(0, packetLen)

      // CRC verify: bytes [1 .. packetLen-3] + CRC_EXTRA(msgid) → CRC16/MCRF4XX
      const msgid = packet.readUInt8(7) | (packet.readUInt8(8) << 8) | (packet.readUInt8(9) << 16)
      const crcPkt = packet.readUInt16LE(packetLen - 2 - signatureLen)
      const crcCalc = calculateCrc(packet.subarray(1, packetLen - 2 - signatureLen), msgid)
      if (crcCalc !== crcPkt) {
        // CRC mismatch — drop one byte and resync, keep the rest
        this.buffer = this.buffer.subarray(1)
        continue
      }

      // target_system / target_component filter (best-effort, message-specific):
      // For COMMAND_ACK (msgid 77) the target lives at payload offsets 4 (sys) and 5 (comp).
      // Skip filtering for messages without target fields.
      if (!this.isAddressedToUs(msgid, packet)) {
        this.buffer = this.buffer.subarray(packetLen)
        continue
      }

      this.buffer = this.buffer.subarray(packetLen)
      this.parsePacket(packet)
    }
  }

  /**
   * For messages that carry target_system/target_component, drop packets not
   * addressed to this GCS (255/190) or broadcast (0).
   * For messages without targets, accept.
   */
  private isAddressedToUs(msgid: number, packet: Buffer): boolean {
    // Messages with (target_system, target_component) at known payload offsets
    // payload starts at byte 10 in the trimmed packet
    let offSys = -1
    let offComp = -1
    switch (msgid) {
      case 77: // COMMAND_ACK: command(2) + result(1) + progress(1) + result_param2(4) + target_system(1) + target_component(1)
        offSys = 10 + 2 + 1 + 1 + 4
        offComp = offSys + 1
        break
      case 22: // PARAM_VALUE — broadcast typically, no target
      case 0: // HEARTBEAT — no target
      case 30: // ATTITUDE — no target
      case 33: // GLOBAL_POSITION_INT — no target
      case 24: // GPS_RAW_INT — no target
      case 74: // VFR_HUD — no target
      case 1: // SYS_STATUS — no target
      case 42: // MISSION_CURRENT — no target
      case 46: // MISSION_ITEM_REACHED — no target
      case 42001: // LIHAI_STATUS (custom) — no target (broadcast)
      case 42002: // KETI_OBSTACLE (custom) — no target (broadcast)
        return true
      case 47: {
        // MISSION_ACK: target_system(1) + target_component(1) + type(1)
        offSys = 10
        offComp = 11
        break
      }
      case 44: {
        // MISSION_COUNT: count(2) + target_system(1) + target_component(1)
        offSys = 10 + 2
        offComp = offSys + 1
        break
      }
      case 73:
        // MISSION_ITEM_INT carries target_system/target_component but most
        // autopilots broadcast it; accept regardless.
        return true
      case 40: // MISSION_REQUEST (legacy)
      case 51: {
        // MISSION_REQUEST_INT: target_system(1) + target_component(1) + seq(2)
        offSys = 10 + 2
        offComp = offSys + 1
        break
      }
      default:
        return true
    }
    // MAVLink v2 trims trailing zero bytes — anything past (10 + payload_len)
    // is the CRC, NOT payload. Treat fields beyond the trimmed payload as 0.
    if (offSys < 0) return true
    const payloadEnd = 10 + (packet.length > 1 ? packet[1] : 0)
    const ts = offSys < payloadEnd ? packet.readUInt8(offSys) : 0
    const tc = offComp < payloadEnd ? packet.readUInt8(offComp) : 0
    if (ts === 0 && tc === 0) return true // broadcast
    if (ts === GCS_SYSID && (tc === GCS_COMPID || tc === 0)) return true
    return false
  }

  /**
   * Parse a complete MAVLink v2 packet
   */
  private parsePacket(packet: Buffer): void {
    const msgid = packet.readUInt8(7) | (packet.readUInt8(8) << 8) | (packet.readUInt8(9) << 16)

    // MAVLink v2 allows trailing zero bytes to be truncated from the payload.
    // Rebuild with zero-padded payload so fixed-offset reads are correct.
    // (Appending zeros to the END of the packet is wrong — CRC sits right
    //  after the truncated payload, so fixed offsets would read CRC bytes.)
    const payloadLen = packet[1]
    // 40 bytes covers all decoded message types up through MISSION_ITEM_INT (38B).
    const paddedPayload = Buffer.alloc(40)
    packet.copy(paddedPayload, 0, 10, 10 + payloadLen)
    const safe = Buffer.concat([packet.subarray(0, 10), paddedPayload])

    // Simple dispatch based on msgid
    switch (msgid) {
      case 0: // HEARTBEAT
        this.handleHeartbeat(safe)
        break
      case 30: // ATTITUDE
        this.handleAttitude(safe)
        break
      case 33: // GLOBAL_POSITION_INT
        this.handleGlobalPositionInt(safe)
        break
      case 24: // GPS_RAW_INT
        this.handleGpsRawInt(safe)
        break
      case 74: // VFR_HUD
        this.handleVfrHud(safe)
        break
      case 1: // SYS_STATUS
        this.handleSysStatus(safe)
        break
      case 22: // PARAM_VALUE
        this.handleParamValue(safe)
        break
      case 77: // COMMAND_ACK
        this.handleCommandAck(safe)
        break
      case 40: // MISSION_REQUEST (legacy, used by some autopilots)
        this.emit('missionRequest', safe.readUInt16LE(10))
        break
      case 51: // MISSION_REQUEST_INT (PX4 preferred)
        this.emit('missionRequest', safe.readUInt16LE(10))
        break
      case 47: // MISSION_ACK
        this.emit('missionAck', safe.readUInt8(12))
        break
      case 44: // MISSION_COUNT
        this.handleMissionCount(safe)
        break
      case 73: // MISSION_ITEM_INT (download response)
        this.handleMissionItemInt(safe)
        break
      case 42001: // LIHAI_STATUS (custom)
        this.handleLihaiStatus(safe)
        break
      case 42002: // KETI_OBSTACLE (custom)
        this.handleKetiObstacle(safe)
        break
      default:
      // unhandled msgid
    }
  }

  /**
   * Handle HEARTBEAT (msgid 0)
   */
  private handleHeartbeat(packet: Buffer): void {
    const base_mode = packet.readUInt8(16)
    const system_status = packet.readUInt8(19)
    const custom_mode = packet.readUInt32LE(10)

    const armed = (base_mode & MAV_MODE_FLAG.SAFETY_ARMED) !== 0
    const statusStr = this.getSystemStatusString(system_status)
    // UAM custom_mode bit layout (see customModes.ts §1.5):
    // [0..7] flight_mode, [8..15] flight_state, [16..23] sub_state, [24] rc_override, [25] rc_link
    const decoded = decodeCustomMode(custom_mode)
    const flightMode = formatModeLabel(decoded, true)
    const modeParts = formatModeParts(decoded)

    if (this.telemetryState.status) {
      this.telemetryState.status.armed = armed
      this.telemetryState.status.systemStatus = statusStr
      this.telemetryState.status.flightMode = flightMode
      this.telemetryState.status.flightModePrimary = modeParts.primary
      this.telemetryState.status.flightModeSub = modeParts.sub
      this.telemetryState.status.flightModeRaw = decoded.flightMode
      this.telemetryState.status.subState = decoded.subState
      this.telemetryState.status.rcOverride = decoded.rcOverride
      this.telemetryState.status.rcLink = decoded.rcLink
    }

    this.emit('heartbeat')
    this.tryEmitTelemetry()
  }

  /**
   * Handle ATTITUDE (msgid 30)
   */
  private handleAttitude(packet: Buffer): void {
    const roll = packet.readFloatLE(14)
    const pitch = packet.readFloatLE(18)
    const yaw = packet.readFloatLE(22)
    const rollspeed = packet.readFloatLE(26)
    const pitchspeed = packet.readFloatLE(30)
    const yawspeed = packet.readFloatLE(34)

    this.telemetryState.attitude = { roll, pitch, yaw, rollspeed, pitchspeed, yawspeed }
    this.tryEmitTelemetry()
  }

  /**
   * Handle GLOBAL_POSITION_INT (msgid 33)
   */
  private handleGlobalPositionInt(packet: Buffer): void {
    const lat = packet.readInt32LE(14)
    const lon = packet.readInt32LE(18)
    const alt = packet.readInt32LE(22)
    const relative_alt = packet.readInt32LE(26)
    const vx = packet.readInt16LE(30)
    const vy = packet.readInt16LE(32)
    const vz = packet.readInt16LE(34)
    const hdg = packet.readUInt16LE(36)

    this.telemetryState.position = {
      lat: lat / 1e7,
      lon: lon / 1e7,
      alt: alt / 1000,
      relative_alt: relative_alt / 1000
    }

    this.telemetryState.velocity = {
      ...this.telemetryState.velocity!,
      vx: vx / 100,
      vy: vy / 100,
      vz: vz / 100
    }

    // hdg=65535 means "unknown" in MAVLink — skip to avoid 655° spike
    if (hdg !== 65535) {
      this.telemetryState.heading = hdg / 100
    }

    // Set home position on first valid GPS fix
    if (!this.homePositionSet && lat !== 0 && lon !== 0 && lat !== -1 && lon !== -1) {
      this.homePositionSet = true
      this.emit('homePosition', {
        lat: lat / 1e7,
        lon: lon / 1e7,
        alt: alt / 1000
      })
    }

    this.tryEmitTelemetry()
  }

  /**
   * Handle VFR_HUD (msgid 74)
   */
  private handleVfrHud(packet: Buffer): void {
    const airspeed = packet.readFloatLE(10)
    const groundspeed = packet.readFloatLE(14)
    // const heading = packet.readInt16LE(18) // Already set in GLOBAL_POSITION_INT
    const throttle = packet.readUInt16LE(20)
    const climb = packet.readFloatLE(26)

    this.telemetryState.velocity = {
      ...this.telemetryState.velocity!,
      airspeed,
      groundspeed,
      climb
    }

    this.telemetryState.throttle = throttle

    this.tryEmitTelemetry()
  }

  /**
   * Handle SYS_STATUS (msgid 1)
   */
  private handleSysStatus(packet: Buffer): void {
    const load = packet.readUInt16LE(26)
    const voltage_battery = packet.readUInt16LE(28)
    const current_battery = packet.readInt16LE(30)
    const battery_remaining = packet.readInt8(42)

    if (this.telemetryState.status) {
      this.telemetryState.status.battery = {
        voltage: voltage_battery / 1000,
        current: current_battery / 100,
        remaining: battery_remaining
      }
      this.telemetryState.status.cpuLoad = load / 10
    }

    this.tryEmitTelemetry()
  }

  /**
   * Handle GPS_RAW_INT (msgid 24) — real GPS fix_type + satellite count.
   * payload: time_usec(8) lat(4) lon(4) alt(4) eph(2) epv(2) vel(2) cog(2)
   *          fix_type(1)@28 satellites_visible(1)@29  → safe offsets 38/39.
   */
  private handleGpsRawInt(packet: Buffer): void {
    const fix_type = packet.readUInt8(38)
    const satellites_visible = packet.readUInt8(39)

    if (this.telemetryState.status) {
      this.telemetryState.status.gpsFix = fix_type
      this.telemetryState.status.satellites = satellites_visible
    }

    this.tryEmitTelemetry()
  }

  /**
   * Handle LIHAI_STATUS (msgid 42001) — LIHAI link + subsystem error flags.
   * Wire contract SoT: customMessages.ts. Payload starts at safe byte 10.
   */
  private handleLihaiStatus(packet: Buffer): void {
    const lihai = decodeLihaiStatus(packet.subarray(10))

    if (this.telemetryState.status) {
      this.telemetryState.status.lihaiLink = lihai.link
      this.telemetryState.status.lihaiErrors = {
        bat: lihai.batError,
        gps: lihai.gpsError,
        imu: lihai.imuError,
        baro: lihai.barometerError,
        rc: lihai.rcError,
        angle: lihai.angleControlError,
        pos: lihai.positionControlError
      }
    }

    this.tryEmitTelemetry()
  }

  /**
   * Handle KETI_OBSTACLE (msgid 42002) — forward obstacle detection.
   * Wire contract SoT: customMessages.ts. Payload starts at safe byte 10.
   */
  private handleKetiObstacle(packet: Buffer): void {
    const keti = decodeKetiObstacle(packet.subarray(10))

    if (this.telemetryState.status) {
      this.telemetryState.status.ketiValid = keti.valid
      this.telemetryState.status.ketiCount = keti.count
      this.telemetryState.status.ketiId = keti.id
      this.telemetryState.status.ketiDistance = keti.distance
      this.telemetryState.status.ketiObjX = keti.objX
      this.telemetryState.status.ketiObjY = keti.objY
      this.telemetryState.status.ketiObjZ = keti.objZ
      this.telemetryState.status.ketiSize = keti.size
    }

    this.tryEmitTelemetry()
  }

  /**
   * Handle PARAM_VALUE (msgid 22)
   */
  private handleParamValue(packet: Buffer): void {
    const param_value = packet.readFloatLE(10)
    const param_count = packet.readUInt16LE(14)
    const param_index = packet.readUInt16LE(16)
    const param_type = packet.readUInt8(18)
    const param_id = packet.subarray(19, 35).toString('ascii').replace(/\0/g, '')

    const param: ParamEntry = {
      id: param_id,
      value: param_value,
      type: param_type,
      index: param_index
    }

    if (param_count > 0) {
      this.emit('paramCount', param_count)
    }
    this.emit('paramValue', param)
  }

  /**
   * Handle COMMAND_ACK (msgid 77)
   */
  private handleCommandAck(packet: Buffer): void {
    const command = packet.readUInt16LE(10)
    const result = packet.readUInt8(12)

    const success = result === MAV_RESULT.ACCEPTED
    const commandName = this.getCommandName(command)
    const resultMessage = this.getResultMessage(result)

    const commandResult: CommandResult = {
      success,
      command: commandName,
      message: resultMessage
    }

    this.emit('commandAck', commandResult)
  }

  /**
   * Handle MISSION_COUNT (msgid 44).
   * Payload: count(uint16) + target_system + target_component + mission_type
   */
  private handleMissionCount(packet: Buffer): void {
    const count = packet.readUInt16LE(10)
    this.emit('missionCount', count)
  }

  /**
   * Handle MISSION_ITEM_INT (msgid 73). Mirror of mission.ts encoder layout.
   * Payload (38B):
   *   param1..4 (float32)        @ 0,4,8,12
   *   x (int32, lat*1e7)         @ 16
   *   y (int32, lon*1e7)         @ 20
   *   z (float32, altitude m)    @ 24
   *   seq (uint16)               @ 28
   *   command (uint16)           @ 30
   *   target_system (uint8)      @ 32
   *   target_component (uint8)   @ 33
   *   frame (uint8)              @ 34
   *   current (uint8)            @ 35
   *   autocontinue (uint8)       @ 36
   *   mission_type (uint8)       @ 37
   */
  private handleMissionItemInt(packet: Buffer): void {
    const item: MissionItemInt = {
      param1: packet.readFloatLE(10),
      param2: packet.readFloatLE(14),
      param3: packet.readFloatLE(18),
      param4: packet.readFloatLE(22),
      lat: packet.readInt32LE(26),
      lon: packet.readInt32LE(30),
      alt: packet.readFloatLE(34),
      seq: packet.readUInt16LE(38),
      command: packet.readUInt16LE(40),
      // bytes 42 (target_system), 43 (target_component) ignored
      frame: packet.readUInt8(44),
      current: packet.readUInt8(45),
      autocontinue: packet.readUInt8(46)
    }
    this.emit('missionItemInt', item)
  }

  /**
   * Mark the link as stale (no HEARTBEAT for >3s).
   * Forces a telemetry emit with flightMode='STALE' so the renderer can
   * surface the loss of contact even when other messages stop arriving.
   */
  markStale(): void {
    if (this.telemetryState.status) {
      this.telemetryState.status.flightMode = 'STALE'
    }
    this.telemetryState.timestamp = Date.now()
    this.lastTelemetryEmit = this.telemetryState.timestamp
    this.emit('telemetry', this.telemetryState as TelemetryData)
  }

  /**
   * Emit telemetry at max 30Hz (throttle)
   */
  private tryEmitTelemetry(): void {
    const now = Date.now()
    if (now - this.lastTelemetryEmit < 33) {
      return
    }

    this.telemetryState.timestamp = now
    this.lastTelemetryEmit = now

    if (this.telemetryState.attitude && this.telemetryState.position) {
      this.emit('telemetry', this.telemetryState as TelemetryData)
    }
  }

  /**
   * Convert MAV_STATE enum to string
   */
  private getSystemStatusString(status: number): string {
    const statusMap: Record<number, string> = {
      [MAV_STATE.UNINIT]: 'UNINIT',
      [MAV_STATE.BOOT]: 'BOOT',
      [MAV_STATE.CALIBRATING]: 'CALIBRATING',
      [MAV_STATE.STANDBY]: 'STANDBY',
      [MAV_STATE.ACTIVE]: 'ACTIVE',
      [MAV_STATE.CRITICAL]: 'CRITICAL',
      [MAV_STATE.EMERGENCY]: 'EMERGENCY',
      [MAV_STATE.POWEROFF]: 'POWEROFF',
      [MAV_STATE.FLIGHT_TERMINATION]: 'FLIGHT_TERMINATION'
    }
    return statusMap[status] || 'UNKNOWN'
  }

  /**
   * Convert MAV_CMD to command name
   */
  private getCommandName(cmd: number): CommandType {
    const cmdMap: Record<number, CommandType> = {
      400: 'ARM',
      22: 'TAKEOFF',
      21: 'LAND',
      20: 'RTL',
      176: 'SET_MODE',
      300: 'MISSION_START',
      209: 'MOTOR_TEST'
    }
    return cmdMap[cmd] || ('ARM' as CommandType)
  }

  /**
   * Convert MAV_RESULT to human-readable message
   */
  private getResultMessage(result: number): string {
    const resultMap: Record<number, string> = {
      [MAV_RESULT.ACCEPTED]: 'Command accepted',
      [MAV_RESULT.TEMPORARILY_REJECTED]: 'Command temporarily rejected',
      [MAV_RESULT.DENIED]: 'Command denied',
      [MAV_RESULT.UNSUPPORTED]: 'Command unsupported',
      [MAV_RESULT.FAILED]: 'Command failed',
      [MAV_RESULT.IN_PROGRESS]: 'Command in progress',
      [MAV_RESULT.CANCELLED]: 'Command cancelled'
    }
    return resultMap[result] || `Result: ${result}`
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _parser: MavlinkParser | null = null

export function getMavlinkParser(): MavlinkParser {
  if (!_parser) {
    _parser = new MavlinkParser()
  }
  return _parser
}
