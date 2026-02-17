/**
 * IPC channel definitions and data types
 * Contract between Main Process and Renderer Process
 */

import type { TelemetryData, HomePosition } from './telemetry'

// --- Connection ---

export type ConnectionMode = 'simulink' | 'real-drone'

export interface ConnectionConfig {
  mode: ConnectionMode
  host: string // e.g. '127.0.0.1'
  port: number // e.g. 14551
  sysid: number
  compid: number
}

export interface ConnectionStatus {
  connected: boolean
  mode: ConnectionMode
  host: string
  port: number
  lastHeartbeat: number // ms since epoch, 0 = never
}

// --- Commands ---

export type CommandType = 'ARM' | 'DISARM' | 'TAKEOFF' | 'LAND' | 'RTL' | 'HOLD' | 'SET_MODE'

export interface Command {
  type: CommandType
  params?: CommandParams
}

export interface CommandParams {
  altitude?: number // meters, for TAKEOFF
  mode?: string // flight mode name, for SET_MODE
}

export interface CommandResult {
  success: boolean
  command: CommandType
  message: string
}

// --- Parameters ---

export interface ParamEntry {
  id: string // param name (16 char max)
  value: number
  type: number // MAV_PARAM_TYPE
  index: number
}

export interface ParamProgress {
  received: number
  total: number
}

// --- Log ---

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: number
}

// --- IPC Channel Map ---
// Main -> Renderer (broadcast via webContents.send)

export interface MainToRendererChannels {
  'telemetry-update': TelemetryData
  'connection-status': ConnectionStatus
  'home-position': HomePosition
  'param-value': ParamEntry
  'param-progress': ParamProgress
  'command-ack': CommandResult
  'log-message': LogEntry
}

// Renderer -> Main (invoke via ipcRenderer.invoke)
export interface RendererToMainChannels {
  'mavlink:connect': ConnectionConfig
  'mavlink:disconnect': void
  'mavlink:send-command': Command
  'mavlink:request-params': void
  'mavlink:set-param': ParamEntry
  'mavlink:get-connection-status': ConnectionStatus
}
