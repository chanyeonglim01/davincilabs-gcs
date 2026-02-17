/**
 * MAVLink Commander
 * Generates and sends MAVLink COMMAND_LONG messages
 */

import type { Command } from '../../renderer/src/types'
import { MAV_CMD } from '../../renderer/src/types'

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
      seq: 0
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
  // node-mavlink doesn't have a direct serialize method, so we'll construct manually
  const buffer = Buffer.alloc(41) // MAVLink v2 header (10) + COMMAND_LONG payload (30) + checksum (2)

  // MAVLink v2 header
  buffer.writeUInt8(0xfd, 0) // Magic byte v2
  buffer.writeUInt8(30, 1) // Payload length
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

  // Checksum (simplified - in production, use proper CRC-16/MCRF4XX)
  const checksum = calculateChecksum(buffer.subarray(1, 40))
  buffer.writeUInt16LE(checksum, 40)

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
      const mode = command.params?.mode || 'AUTO'
      // SET_MODE is complex - for now, just log
      console.warn(`[Commander] SET_MODE not yet implemented for mode: ${mode}`)
      // Placeholder: MAV_CMD_DO_SET_MODE
      return createCommandLong(MAV_CMD.DO_SET_MODE, 1, 0, 0, 0, 0, 0, 0)
    }

    default:
      throw new Error(`Unknown command type: ${command.type}`)
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
    default:
      return 'Unknown command'
  }
}
