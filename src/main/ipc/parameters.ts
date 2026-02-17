/**
 * Parameter IPC Handlers
 * Handles PARAM_REQUEST_LIST and PARAM_SET
 */

import { ipcMain, type BrowserWindow } from 'electron'
import type { ParamEntry, ParamProgress } from '../../renderer/src/types'
import { getMavlinkConnection } from '../mavlink/connection'
import { sendLogMessage } from './telemetry'

let mainWindow: BrowserWindow | null = null
const parameterCache = new Map<string, ParamEntry>()

/**
 * Register parameter IPC handlers
 */
export function registerParameterHandlers(window: BrowserWindow): void {
  mainWindow = window

  // Request all parameters from vehicle
  ipcMain.handle('mavlink:request-params', async (_event) => {
    try {
      const connection = getMavlinkConnection()

      if (!connection.isConnected) {
        throw new Error('Not connected to vehicle')
      }

      // Clear cache
      parameterCache.clear()

      // Send PARAM_REQUEST_LIST (msgid 21)
      const buffer = createParamRequestList()
      connection.sendMessage(buffer)

      sendLogMessage('info', 'Requesting parameters from vehicle...')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request params failed'
      sendLogMessage('error', `Request params failed: ${message}`)
      throw err
    }
  })

  // Set a single parameter
  ipcMain.handle('mavlink:set-param', async (_event, param: ParamEntry) => {
    try {
      const connection = getMavlinkConnection()

      if (!connection.isConnected) {
        throw new Error('Not connected to vehicle')
      }

      // Send PARAM_SET (msgid 23)
      const buffer = createParamSet(param)
      connection.sendMessage(buffer)

      sendLogMessage('info', `Setting parameter ${param.id} = ${param.value}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Set param failed'
      sendLogMessage('error', `Set param failed: ${message}`)
      throw err
    }
  })
}

/**
 * Broadcast parameter value to Renderer
 */
export function sendParamValue(param: ParamEntry): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    parameterCache.set(param.id, param)
    mainWindow.webContents.send('param-value', param)
  }
}

/**
 * Broadcast parameter download progress
 */
export function sendParamProgress(received: number, total: number): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const progress: ParamProgress = { received, total }
    mainWindow.webContents.send('param-progress', progress)
  }
}

/**
 * Create PARAM_REQUEST_LIST message buffer (msgid 21)
 */
function createParamRequestList(): Buffer {
  const buffer = Buffer.alloc(17) // MAVLink v2 header (10) + payload (5) + checksum (2)

  // MAVLink v2 header
  buffer.writeUInt8(0xfd, 0) // Magic byte v2
  buffer.writeUInt8(5, 1) // Payload length
  buffer.writeUInt8(0, 2) // Incompat flags
  buffer.writeUInt8(0, 3) // Compat flags
  buffer.writeUInt8(0, 4) // Seq
  buffer.writeUInt8(255, 5) // Sysid (GCS)
  buffer.writeUInt8(190, 6) // Compid
  buffer.writeUInt8(21, 7) // msgid low (PARAM_REQUEST_LIST)
  buffer.writeUInt8(0, 8) // msgid mid
  buffer.writeUInt8(0, 9) // msgid high

  // Payload: target_system (1), target_component (1)
  buffer.writeUInt8(1, 10) // target_system
  buffer.writeUInt8(1, 11) // target_component

  // Checksum (simplified)
  const checksum = calculateChecksum(buffer.subarray(1, 12), 159) // CRC_EXTRA = 159
  buffer.writeUInt16LE(checksum, 15)

  return buffer
}

/**
 * Create PARAM_SET message buffer (msgid 23)
 */
function createParamSet(param: ParamEntry): Buffer {
  const buffer = Buffer.alloc(33) // MAVLink v2 header (10) + payload (21) + checksum (2)

  // MAVLink v2 header
  buffer.writeUInt8(0xfd, 0)
  buffer.writeUInt8(21, 1) // Payload length
  buffer.writeUInt8(0, 2)
  buffer.writeUInt8(0, 3)
  buffer.writeUInt8(0, 4)
  buffer.writeUInt8(255, 5)
  buffer.writeUInt8(190, 6)
  buffer.writeUInt8(23, 7) // msgid low (PARAM_SET)
  buffer.writeUInt8(0, 8)
  buffer.writeUInt8(0, 9)

  // Payload
  let offset = 10
  buffer.writeFloatLE(param.value, offset)
  offset += 4
  buffer.writeUInt8(1, offset) // target_system
  offset += 1
  buffer.writeUInt8(1, offset) // target_component
  offset += 1

  // param_id (16 bytes, null-terminated)
  const paramIdBuffer = Buffer.from(param.id.substring(0, 16).padEnd(16, '\0'), 'ascii')
  paramIdBuffer.copy(buffer, offset)
  offset += 16

  buffer.writeUInt8(param.type, offset) // param_type
  offset += 1

  // Checksum
  const checksum = calculateChecksum(buffer.subarray(1, 31), 168) // CRC_EXTRA = 168
  buffer.writeUInt16LE(checksum, 31)

  return buffer
}

/**
 * CRC-16/MCRF4XX checksum
 */
function calculateChecksum(data: Buffer, crcExtra: number): number {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    const tmp = data[i] ^ (crc & 0xff)
    const tmpShifted = (tmp ^ (tmp << 4)) & 0xff
    crc = ((crc >> 8) ^ (tmpShifted << 8) ^ (tmpShifted << 3) ^ (tmpShifted >> 4)) & 0xffff
  }
  const tmp = crcExtra ^ (crc & 0xff)
  const tmpShifted = (tmp ^ (tmp << 4)) & 0xff
  crc = ((crc >> 8) ^ (tmpShifted << 8) ^ (tmpShifted << 3) ^ (tmpShifted >> 4)) & 0xffff
  return crc
}
