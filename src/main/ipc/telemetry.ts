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
 * Safely send to the renderer. The window can be alive while its render
 * frame is disposed mid-reload (HMR) — webContents.send throws then.
 * Guard with isDestroyed() AND swallow the disposed-frame race.
 */
function safeSend(channel: string, payload: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const wc = mainWindow.webContents
  if (!wc || wc.isDestroyed() || wc.isCrashed()) return
  try {
    wc.send(channel, payload)
  } catch {
    // Render frame disposed during reload — drop this frame, resume next.
  }
}

/**
 * Broadcast telemetry update to Renderer (30Hz throttled)
 */
export function sendTelemetryUpdate(data: TelemetryData): void {
  safeSend('telemetry-update', data)
}

/**
 * Broadcast home position to Renderer (once per session)
 */
export function sendHomePosition(home: HomePosition): void {
  safeSend('home-position', home)
}

/**
 * Send log message to Renderer console
 */
export function sendLogMessage(level: LogEntry['level'], message: string): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: Date.now()
  }
  safeSend('log-message', entry)
}
