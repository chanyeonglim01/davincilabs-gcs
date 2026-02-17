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

export interface MavlinkParserEvents {
  telemetry: (data: TelemetryData) => void
  homePosition: (home: HomePosition) => void
  paramValue: (param: ParamEntry) => void
  paramCount: (count: number) => void
  commandAck: (result: CommandResult) => void
  heartbeat: () => void
  missionRequest: (seq: number) => void
  missionAck: (type: number) => void
}

export declare interface MavlinkParser {
  on<U extends keyof MavlinkParserEvents>(
    event: U,
    listener: MavlinkParserEvents[U]
  ): this
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
        systemStatus: 'UNKNOWN',
        battery: { voltage: 0, current: 0, remaining: -1 },
        cpuLoad: 0
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

    // Simple heuristic: look for MAVLink v2 magic byte (0xFD)
    while (this.buffer.length > 0) {
      const magicIndex = this.buffer.indexOf(0xfd)
      if (magicIndex === -1) {
        // No MAVLink message found
        this.buffer = Buffer.alloc(0)
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

      // Extract payload length and calculate total packet size
      const payloadLen = this.buffer[1]
      const incompatFlags = this.buffer[2]
      const signatureLen = (incompatFlags & 0x01) !== 0 ? 13 : 0
      const packetLen = 12 + payloadLen + signatureLen

      if (this.buffer.length < packetLen) {
        // Not enough data yet
        break
      }

      // Extract packet
      const packet = this.buffer.subarray(0, packetLen)
      this.buffer = this.buffer.subarray(packetLen)

      // Parse packet
      this.parsePacket(packet)
    }
  }

  /**
   * Parse a complete MAVLink v2 packet
   */
  private parsePacket(packet: Buffer): void {
    const msgid = packet.readUInt8(7) | (packet.readUInt8(8) << 8) | (packet.readUInt8(9) << 16)

    // Simple dispatch based on msgid
    switch (msgid) {
      case 0: // HEARTBEAT
        this.handleHeartbeat(packet)
        break
      case 30: // ATTITUDE
        this.handleAttitude(packet)
        break
      case 33: // GLOBAL_POSITION_INT
        this.handleGlobalPositionInt(packet)
        break
      case 74: // VFR_HUD
        this.handleVfrHud(packet)
        break
      case 1: // SYS_STATUS
        this.handleSysStatus(packet)
        break
      case 22: // PARAM_VALUE
        this.handleParamValue(packet)
        break
      case 77: // COMMAND_ACK
        this.handleCommandAck(packet)
        break
      case 40: // MISSION_REQUEST (legacy, used by some autopilots)
        this.emit('missionRequest', packet.readUInt16LE(10))
        break
      case 51: // MISSION_REQUEST_INT (PX4 preferred)
        this.emit('missionRequest', packet.readUInt16LE(10))
        break
      case 47: // MISSION_ACK
        this.emit('missionAck', packet.readUInt8(12))
        break
      default:
      // console.log(`[MAVLink Parser] Unhandled msgid: ${msgid}`)
    }
  }

  /**
   * Handle HEARTBEAT (msgid 0)
   */
  private handleHeartbeat(packet: Buffer): void {
    const base_mode = packet.readUInt8(16)
    const system_status = packet.readUInt8(19)
    const custom_mode = packet.readUInt32LE(10)
    const main_mode = (custom_mode >> 16) & 0xff
    const sub_mode = (custom_mode >> 24) & 0xff

    const armed = (base_mode & MAV_MODE_FLAG.SAFETY_ARMED) !== 0
    const statusStr = this.getSystemStatusString(system_status)
    const flightMode = this.getPx4FlightMode(main_mode, sub_mode)

    if (this.telemetryState.status) {
      this.telemetryState.status.armed = armed
      this.telemetryState.status.systemStatus = statusStr
      this.telemetryState.status.flightMode = flightMode
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

    this.telemetryState.heading = hdg / 100

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
   * Convert PX4 custom_mode main/sub to flight mode string
   */
  private getPx4FlightMode(mainMode: number, subMode: number): string {
    switch (mainMode) {
      case 1:
        return 'MANUAL'
      case 2:
        return 'ALTCTL'
      case 3:
        return 'POSCTL'
      case 4: {
        const autoSubMap: Record<number, string> = {
          2: 'AUTO.TAKEOFF',
          3: 'AUTO.LOITER',
          4: 'AUTO.MISSION',
          5: 'AUTO.RTL',
          6: 'AUTO.LAND'
        }
        return autoSubMap[subMode] || 'AUTO'
      }
      case 5:
        return 'ACRO'
      case 6:
        return 'OFFBOARD'
      case 7:
        return 'STABILIZED'
      default:
        return 'UNKNOWN'
    }
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
      176: 'SET_MODE'
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
