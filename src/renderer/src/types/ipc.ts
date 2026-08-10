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
  | 'CTRL_SURF_TEST'
  | 'MISSION_START'

/**
 * Control-surface test source.
 * - 'gcs' drives surfaces from the dA/dE/dR values below (param2 = 1)
 * - 'rc'  hands control to the RC sticks (param2 = 0)
 */
export type CtrlSurfSource = 'gcs' | 'rc'

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
  // ── MISSION_START ───────────────────────────────────────────────────────────
  firstItem?: number // first mission item seq (0 = beginning)
  lastItem?: number // last mission item seq (0 = end)
  // ── MOTOR_TEST ──────────────────────────────────────────────────────────────
  motor?: number // motor bitmask (bit i-1 = motor i); 0 = stop. Drives masked motors together.
  throttle?: number // value (units depend on throttleType)
  duration?: number // seconds the motor should spin
  throttleType?: MotorTestThrottleType // default 'percent'
  motorCount?: number // for ALL/sequential: number of motors to test (default 6)
  // ── CTRL_SURF_TEST ────────────────────────────────────────────────────────────
  enable?: boolean // true = engage test override, false = release
  source?: CtrlSurfSource // 'gcs' (use dA/dE/dR) or 'rc' (sticks)
  dA?: number // aileron deflection, normalized -1..1
  dE?: number // elevator deflection, normalized -1..1
  dR?: number // rudder deflection,  normalized -1..1
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

// Control-surface test IPC payload (mavlink:ctrl-surf-test)
export interface CtrlSurfTestPayload {
  enable: boolean
  source: CtrlSurfSource
  dA: number // normalized -1..1
  dE: number
  dR: number
}

export interface CtrlSurfTestResult {
  success: boolean
  error?: string
}

// Renderer failure report (app:renderer-error) — written to gcs-crash.log by main
export type RendererErrorKind =
  | 'react-render'
  | 'window-error'
  | 'unhandled-rejection'
  | 'webgl-context-lost'
  | 'perf-timeline' // diagnostic, not a failure

export interface RendererErrorReport {
  kind: RendererErrorKind
  message: string
  stack: string | null
  source: string | null
}

// Renderer -> Main (invoke via ipcRenderer.invoke)
export interface RendererToMainChannels {
  'mavlink:connect': ConnectionConfig
  'mavlink:disconnect': void
  'mavlink:send-command': Command
  'mavlink:motor-test': MotorTestPayload
  'mavlink:ctrl-surf-test': CtrlSurfTestPayload
  'mavlink:request-params': void
  'mavlink:set-param': ParamEntry
  'mavlink:get-connection-status': ConnectionStatus
  'serial:list-ports': SerialPortInfo[]
  'app:renderer-error': RendererErrorReport
}
