/**
 * Command IPC Handlers
 * Receives commands from Renderer and sends to MAVLink
 */

import { ipcMain, BrowserWindow } from 'electron'
import type { Command, CommandResult, ConnectionConfig } from '../../renderer/src/types'
import { getMavlinkConnection } from '../mavlink/connection'
import { getMavlinkParser } from '../mavlink/parser'
import { commandToBuffer, getCommandDescription } from '../mavlink/commander'
import { MissionUploader } from '../mavlink/mission'
import type { MissionWaypoint } from '../mavlink/mission'
import {
  MissionDownloader,
  decodeMissionItems,
  type DownloadedMissionItem
} from '../mavlink/missionDownloader'
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
  ipcMain.handle(
    'mavlink:reconnect',
    async (_event, { host, port }: { host: string; port: number }) => {
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
    }
  )

  // Connect over serial (텔레메트리 라디오 COM 포트)
  ipcMain.handle(
    'mavlink:connect-serial',
    async (_event, { path, baud }: { path: string; baud: number }) => {
      try {
        const connection = getMavlinkConnection()
        if (connection.isConnected) {
          connection.disconnect()
          await new Promise<void>((resolve) => setTimeout(resolve, 200))
        }
        await connection.connectSerial(path, baud)
        sendLogMessage('info', `Serial connected ${path} @ ${baud}`)
        return { success: true }
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Serial connect failed'
        sendLogMessage('error', `Serial connect failed: ${error}`)
        return { success: false, error }
      }
    }
  )

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

  // Motor test (DO_MOTOR_TEST / cmd 209)
  // Convenience channel that wraps a MOTOR_TEST Command so the renderer
  // does not need to know the high-level Command schema.
  ipcMain.handle(
    'mavlink:motor-test',
    async (
      _event,
      payload: {
        motor: number
        throttle: number
        duration: number
        throttleType?: 'percent' | 'pwm'
        motorCount?: number
      }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const connection = getMavlinkConnection()
        if (!connection.isConnected) {
          return { success: false, error: 'Not connected to vehicle' }
        }

        const cmd: Command = {
          type: 'MOTOR_TEST',
          params: {
            motor: payload.motor,
            throttle: payload.throttle,
            duration: payload.duration,
            throttleType: payload.throttleType ?? 'percent',
            motorCount: payload.motorCount
          }
        }

        const buffer = commandToBuffer(cmd)
        connection.sendMessage(buffer)
        sendLogMessage('info', `Command sent: ${getCommandDescription(cmd)}`)
        return { success: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Motor test failed'
        sendLogMessage('error', `Motor test failed: ${message}`)
        return { success: false, error: message }
      }
    }
  )

  // Control surface test (CTRL_SURF_TEST / cmd 31010)
  // Convenience channel mirroring motor-test: wraps a CTRL_SURF_TEST Command.
  ipcMain.handle(
    'mavlink:ctrl-surf-test',
    async (
      _event,
      payload: {
        enable: boolean
        source: 'gcs' | 'rc'
        dA: number
        dE: number
        dR: number
      }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const connection = getMavlinkConnection()
        if (!connection.isConnected) {
          return { success: false, error: 'Not connected to vehicle' }
        }

        const cmd: Command = {
          type: 'CTRL_SURF_TEST',
          params: {
            enable: payload.enable,
            source: payload.source,
            dA: payload.dA,
            dE: payload.dE,
            dR: payload.dR
          }
        }

        const buffer = commandToBuffer(cmd)
        connection.sendMessage(buffer)
        sendLogMessage('info', `Command sent: ${getCommandDescription(cmd)}`)
        return { success: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Control surface test failed'
        sendLogMessage('error', `Control surface test failed: ${message}`)
        return { success: false, error: message }
      }
    }
  )

  // Upload mission waypoints via MAVLink Mission Protocol
  ipcMain.handle('mavlink:upload-mission', async (_event, waypoints: MissionWaypoint[]) => {
    const connection = getMavlinkConnection()
    const parser = getMavlinkParser()

    if (!connection.isConnected) {
      return { success: false, count: 0, error: 'Not connected to vehicle' }
    }

    const uploader = new MissionUploader(connection)

    const onRequest = (seq: number): void => uploader.onRequest(seq)
    const onAck = (type: number): void => uploader.onAck(type)

    parser.on('missionRequest', onRequest)
    parser.on('missionAck', onAck)

    try {
      const result = await uploader.upload(waypoints)
      if (result.success) {
        sendLogMessage('info', `Mission uploaded: ${result.count} items`)
      } else {
        sendLogMessage('error', `Mission upload failed: ${result.error}`)
      }
      return result
    } finally {
      parser.off('missionRequest', onRequest)
      parser.off('missionAck', onAck)
    }
  })

  // Download mission via MAVLink Mission Protocol
  ipcMain.handle(
    'mavlink:download-mission',
    async (
      event
    ): Promise<{ success: boolean; items: DownloadedMissionItem[]; error?: string }> => {
      const connection = getMavlinkConnection()
      const parser = getMavlinkParser()

      if (!connection.isConnected) {
        return { success: false, items: [], error: 'Not connected to vehicle' }
      }

      const win = BrowserWindow.fromWebContents(event.sender)

      const downloader = new MissionDownloader(connection, parser, (progress) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('mission:download-progress', progress)
        }
      })

      try {
        const result = await downloader.download()
        if (result.success) {
          sendLogMessage('info', `Mission downloaded: ${result.items.length} items`)
          return { success: true, items: decodeMissionItems(result.items) }
        }
        sendLogMessage('error', `Mission download failed: ${result.error}`)
        return {
          success: false,
          items: decodeMissionItems(result.items),
          error: result.error
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Mission download failed'
        sendLogMessage('error', `Mission download failed: ${message}`)
        return { success: false, items: [], error: message }
      }
    }
  )
}
