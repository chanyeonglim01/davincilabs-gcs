/**
 * Telemetry IPC Handlers
 * Broadcasts telemetry data from MAVLink parser to Renderer
 */

import type { BrowserWindow } from 'electron'
import type { TelemetryData, HomePosition, LogEntry } from '../../renderer/src/types'

let mainWindow: BrowserWindow | null = null

/**
 * Register telemetry IPC handlers
 */
export function registerTelemetryHandlers(window: BrowserWindow): void {
  mainWindow = window
}

/**
 * Broadcast telemetry update to Renderer (30Hz throttled)
 */
export function sendTelemetryUpdate(data: TelemetryData): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('telemetry-update', data)
  }
}

/**
 * Broadcast home position to Renderer (once per session)
 */
export function sendHomePosition(home: HomePosition): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('home-position', home)
  }
}

/**
 * Send log message to Renderer console
 */
export function sendLogMessage(level: LogEntry['level'], message: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now()
    }
    mainWindow.webContents.send('log-message', entry)
  }
}
