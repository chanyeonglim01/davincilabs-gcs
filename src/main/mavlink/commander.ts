/**
 * MAVLink Commander
 * Generates and sends MAVLink COMMAND_LONG messages
 */

import type { Command } from '../../renderer/src/types'
import { MAV_CMD } from '../../renderer/src/types'
import { modeNameToParam2 } from './customModes'

// Single per-link tx sequence counter (0..255 wrap)
let txSeq = 0
function nextSeq(): number {
  const s = txSeq & 0xff
  txSeq = (txSeq + 1) & 0xff
  return s
}

/**
 * Create COMMAND_LONG message buffer
 */
function createCommandLong(
  command: number,
  param1: number = 0,
  param2: number = 0,
  param3: number = 0,
  param4: number = 0,
  param5: number = 0,
  param6: number = 0,
  param7: number = 0,
  targetSystem: number = 1,
  targetComponent: number = 1
): Buffer {
  const message = {
    header: {
      msgid: 76, // COMMAND_LONG
      sysid: 255, // GCS system ID
      compid: 190, // MAV_COMP_ID_MISSIONPLANNER
      seq: nextSeq()
    },
    payload: {
      command,
      confirmation: 0,
      param1,
      param2,
      param3,
      param4,
      param5,
      param6,
      param7,
      target_system: targetSystem,
      target_component: targetComponent
    }
  }

  // Serialize to MAVLink v2 buffer
  // COMMAND_LONG payload = 7 floats (28) + uint16 command (2) + 3 uint8 (3) = 33 bytes
  // Total wire size = 10 header + 33 payload + 2 CRC = 45 bytes
  const COMMAND_LONG_PAYLOAD_LEN = 33
  const HEADER_LEN = 10
  const CRC_LEN = 2
  const buffer = Buffer.alloc(HEADER_LEN + COMMAND_LONG_PAYLOAD_LEN + CRC_LEN)

  // MAVLink v2 header
  buffer.writeUInt8(0xfd, 0) // Magic byte v2
  buffer.writeUInt8(COMMAND_LONG_PAYLOAD_LEN, 1) // Payload length
  buffer.writeUInt8(0, 2) // Incompat flags
  buffer.writeUInt8(0, 3) // Compat flags
  buffer.writeUInt8(message.header.seq, 4)
  buffer.writeUInt8(message.header.sysid, 5)
  buffer.writeUInt8(message.header.compid, 6)
  buffer.writeUInt8(message.header.msgid & 0xff, 7) // msgid low
  buffer.writeUInt8((message.header.msgid >> 8) & 0xff, 8) // msgid mid
  buffer.writeUInt8((message.header.msgid >> 16) & 0xff, 9) // msgid high

  // Payload (COMMAND_LONG structure)
  let offset = 10
  buffer.writeFloatLE(message.payload.param1, offset)
  offset += 4
  buffer.writeFloatLE(message.payload.param2, offset)
  offset += 4
  buffer.writeFloatLE(message.payload.param3, offset)
  offset += 4
  buffer.writeFloatLE(message.payload.param4, offset)
  offset += 4
  buffer.writeFloatLE(message.payload.param5, offset)
  offset += 4
  buffer.writeFloatLE(message.payload.param6, offset)
  offset += 4
  buffer.writeFloatLE(message.payload.param7, offset)
  offset += 4
  buffer.writeUInt16LE(message.payload.command, offset)
  offset += 2
  buffer.writeUInt8(message.payload.target_system, offset)
  offset += 1
  buffer.writeUInt8(message.payload.target_component, offset)
  offset += 1
  buffer.writeUInt8(message.payload.confirmation, offset)
  offset += 1

  // Checksum (CRC-16/MCRF4XX over [seq..end-of-payload], with CRC_EXTRA appended)
  const crcStart = 1
  const crcEnd = HEADER_LEN + COMMAND_LONG_PAYLOAD_LEN
  const checksum = calculateChecksum(buffer.subarray(crcStart, crcEnd))
  buffer.writeUInt16LE(checksum, crcEnd)

  return buffer
}

/**
 * Simplified checksum calculation (CRC-16/MCRF4XX)
 * In production, use node-mavlink's built-in CRC
 */
function calculateChecksum(data: Buffer): number {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    const tmp = data[i] ^ (crc & 0xff)
    const tmpShifted = (tmp ^ (tmp << 4)) & 0xff
    crc = ((crc >> 8) ^ (tmpShifted << 8) ^ (tmpShifted << 3) ^ (tmpShifted >> 4)) & 0xffff
  }
  // Add CRC_EXTRA for COMMAND_LONG (msgid 76) = 152
  const tmp = 152 ^ (crc & 0xff)
  const tmpShifted = (tmp ^ (tmp << 4)) & 0xff
  crc = ((crc >> 8) ^ (tmpShifted << 8) ^ (tmpShifted << 3) ^ (tmpShifted >> 4)) & 0xffff
  return crc
}

/**
 * Convert high-level Command to MAVLink COMMAND_LONG buffer
 */
export function commandToBuffer(command: Command): Buffer {
  switch (command.type) {
    case 'ARM':
      return createCommandLong(MAV_CMD.COMPONENT_ARM_DISARM, 1, 0)

    case 'DISARM':
      return createCommandLong(MAV_CMD.COMPONENT_ARM_DISARM, 0, 0)

    case 'TAKEOFF': {
      const altitude = command.params?.altitude || 10 // Default 10m
      return createCommandLong(MAV_CMD.NAV_TAKEOFF, 0, 0, 0, 0, 0, 0, altitude)
    }

    case 'LAND':
      return createCommandLong(MAV_CMD.NAV_LAND, 0, 0, 0, 0, 0, 0, 0)

    case 'RTL':
      return createCommandLong(MAV_CMD.NAV_RETURN_TO_LAUNCH, 0, 0, 0, 0, 0, 0, 0)

    case 'HOLD':
      // MAV_CMD_DO_PAUSE_CONTINUE (193): param1=1 for pause
      return createCommandLong(193, 1, 0, 0, 0, 0, 0, 0)

    case 'SET_MODE': {
      const mode = command.params?.mode || 'AUTO.MISSION'
      // UAM custom mode bit layout — see customModes.ts §1.5
      const customMode = modeNameToParam2(mode)
      // param1=1 (MAV_MODE_FLAG_CUSTOM_MODE_ENABLED), param2=custom_mode as float
      return createCommandLong(MAV_CMD.DO_SET_MODE, 1, customMode, 0, 0, 0, 0, 0)
    }

    case 'MISSION_START': {
      // MAV_CMD_MISSION_START (300)
      //  param1: first_item (0 = use mission start from beginning)
      //  param2: last_item  (0 = use mission end)
      const firstItem = command.params?.firstItem ?? 0
      const lastItem = command.params?.lastItem ?? 0
      return createCommandLong(MAV_CMD.MISSION_START, firstItem, lastItem, 0, 0, 0, 0, 0)
    }

    case 'MOTOR_TEST': {
      // MAV_CMD_DO_MOTOR_TEST (209)
      //  param1: motor instance (1-based; 0 = ALL/sequential)
      //  param2: throttle type   (0 = percent, 1 = PWM µs)
      //  param3: throttle value
      //  param4: duration (seconds)
      //  param5: motor count (for sequential ALL)
      //  param6: test order   (0 = default board order)
      //  param7: reserved
      const motor = command.params?.motor ?? 1
      const throttleType = command.params?.throttleType ?? 'percent'
      const throttle = command.params?.throttle ?? 0
      const duration = command.params?.duration ?? 0
      const motorCount = command.params?.motorCount ?? (motor === 0 ? 6 : 0)
      const throttleTypeValue = throttleType === 'pwm' ? 1 : 0
      return createCommandLong(
        MAV_CMD.DO_MOTOR_TEST,
        motor,
        throttleTypeValue,
        throttle,
        duration,
        motorCount,
        0,
        0
      )
    }

    default:
      throw new Error(`Unknown command type: ${command.type as string}`)
  }
}

/**
 * Get command description for logging
 */
export function getCommandDescription(command: Command): string {
  switch (command.type) {
    case 'ARM':
      return 'Arm motors'
    case 'DISARM':
      return 'Disarm motors'
    case 'TAKEOFF':
      return `Takeoff to ${command.params?.altitude || 10}m`
    case 'LAND':
      return 'Land at current position'
    case 'RTL':
      return 'Return to launch'
    case 'HOLD':
      return 'Hold position'
    case 'SET_MODE':
      return `Set mode to ${command.params?.mode || 'AUTO'}`
    case 'MISSION_START': {
      const first = command.params?.firstItem ?? 0
      const last = command.params?.lastItem ?? 0
      return `Mission start (items ${first}..${last === 0 ? 'end' : last})`
    }
    case 'MOTOR_TEST': {
      const m = command.params?.motor ?? 1
      const t = command.params?.throttle ?? 0
      const d = command.params?.duration ?? 0
      const unit = command.params?.throttleType === 'pwm' ? 'µs' : '%'
      const target = m === 0 ? 'ALL' : `M${m}`
      return `Motor test ${target} @ ${t}${unit} for ${d}s`
    }
    default:
      return 'Unknown command'
  }
}
