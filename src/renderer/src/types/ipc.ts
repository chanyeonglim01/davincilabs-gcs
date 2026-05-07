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
  port: number // local UDP listen port (GCS receives here)
  remotePort?: number // remote UDP send port (drone listens here); defaults to port
  sysid: number
  compid: number
}

/**
 * Five-state link lifecycle exposed to the UI.
 *
 * - DISCONNECTED:        no transport (socket closed or never opened)
 * - WAITING_HEARTBEAT:   transport open/bound but no HEARTBEAT received yet
 * - LINKED:              HEARTBEAT received within the last 3 seconds
 * - STALE:               had HEARTBEAT(s) before, none within the last 3s
 * - ERROR:               last transport open/bind attempt failed
 */
export type LinkState = 'DISCONNECTED' | 'WAITING_HEARTBEAT' | 'LINKED' | 'STALE' | 'ERROR'

export interface ConnectionStatus {
  connected: boolean
  linkState: LinkState
  mode: ConnectionMode
  host: string
  port: number
  lastHeartbeat: number // ms since epoch, 0 = never
  error?: string // populated when linkState === 'ERROR'
}

// --- Serial port enumeration ---

export interface SerialPortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  pnpId?: string
  vendorId?: string
  productId?: string
  friendlyName?: string
}

// --- Commands ---

export type CommandType =
  | 'ARM'
  | 'DISARM'
  | 'TAKEOFF'
  | 'LAND'
  | 'RTL'
  | 'HOLD'
  | 'SET_MODE'
  | 'MOTOR_TEST'

export interface Command {
  type: CommandType
  params?: CommandParams
}

/**
 * MOTOR_TEST throttle units.
 * - 'percent' encodes throttle as 0..100 % (DO_MOTOR_TEST throttle_type 0)
 * - 'pwm' encodes throttle as raw PWM µs (DO_MOTOR_TEST throttle_type 1)
 */
export type MotorTestThrottleType = 'percent' | 'pwm'

export interface CommandParams {
  altitude?: number // meters, for TAKEOFF
  mode?: string // flight mode name, for SET_MODE
  // ── MOTOR_TEST ──────────────────────────────────────────────────────────────
  motor?: number // 1-based motor instance, 0 = ALL (sequential)
  throttle?: number // value (units depend on throttleType)
  duration?: number // seconds the motor should spin
  throttleType?: MotorTestThrottleType // default 'percent'
  motorCount?: number // for ALL/sequential: number of motors to test (default 6)
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

// Motor test IPC payload (mavlink:motor-test)
export interface MotorTestPayload {
  motor: number // 1-based, 0 = ALL
  throttle: number
  duration: number
  throttleType?: MotorTestThrottleType
  motorCount?: number
}

export interface MotorTestResult {
  success: boolean
  error?: string
}

// Renderer -> Main (invoke via ipcRenderer.invoke)
export interface RendererToMainChannels {
  'mavlink:connect': ConnectionConfig
  'mavlink:disconnect': void
  'mavlink:send-command': Command
  'mavlink:motor-test': MotorTestPayload
  'mavlink:request-params': void
  'mavlink:set-param': ParamEntry
  'mavlink:get-connection-status': ConnectionStatus
  'serial:list-ports': SerialPortInfo[]
}
