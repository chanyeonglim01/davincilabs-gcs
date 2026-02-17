/**
 * Command IPC Handlers
 * Receives commands from Renderer and sends to MAVLink
 */

import { ipcMain } from 'electron'
import type {
  Command,
  CommandResult,
  ConnectionConfig
} from '../../renderer/src/types'
import { getMavlinkConnection } from '../mavlink/connection'
import { commandToBuffer, getCommandDescription } from '../mavlink/commander'
import { sendLogMessage } from './telemetry'

/**
 * Register command IPC handlers
 */
export function registerCommandHandlers(): void {
  // Connect to MAVLink
  ipcMain.handle('mavlink:connect', async (_event, config: ConnectionConfig) => {
    try {
      const connection = getMavlinkConnection()
      await connection.connect(config)
      sendLogMessage('info', `Connected to ${config.host}:${config.port} (${config.mode} mode)`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      sendLogMessage('error', `Connection failed: ${message}`)
      throw err
    }
  })

  // Reconnect to new host:port
  ipcMain.handle('mavlink:reconnect', async (_event, { host, port }: { host: string; port: number }) => {
    try {
      const connection = getMavlinkConnection()
      await connection.reconnect(host, port)
      sendLogMessage('info', `Reconnected to ${host}:${port}`)
      return { success: true }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Reconnect failed'
      sendLogMessage('error', `Reconnect failed: ${error}`)
      return { success: false, error }
    }
  })

  // Disconnect from MAVLink
  ipcMain.handle('mavlink:disconnect', async (_event) => {
    try {
      const connection = getMavlinkConnection()
      connection.disconnect()
      sendLogMessage('info', 'Disconnected from MAVLink')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Disconnect failed'
      sendLogMessage('error', `Disconnect failed: ${message}`)
      throw err
    }
  })

  // Send command
  ipcMain.handle('mavlink:send-command', async (_event, command: Command) => {
    try {
      const connection = getMavlinkConnection()

      if (!connection.isConnected) {
        const result: CommandResult = {
          success: false,
          command: command.type,
          message: 'Not connected to vehicle'
        }
        return result
      }

      // Convert command to MAVLink buffer
      const buffer = commandToBuffer(command)
      const description = getCommandDescription(command)

      // Send to vehicle
      connection.sendMessage(buffer)

      sendLogMessage('info', `Command sent: ${description}`)

      // Return success (actual result comes via COMMAND_ACK asynchronously)
      const result: CommandResult = {
        success: true,
        command: command.type,
        message: 'Command sent, awaiting acknowledgement...'
      }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Command failed'
      sendLogMessage('error', `Command failed: ${message}`)

      const result: CommandResult = {
        success: false,
        command: command.type,
        message
      }
      return result
    }
  })

  // Get connection status
  ipcMain.handle('mavlink:get-connection-status', async (_event) => {
    const connection = getMavlinkConnection()
    return connection.getStatus()
  })
}
