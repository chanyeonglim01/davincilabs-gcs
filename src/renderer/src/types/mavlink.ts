/**
 * MAVLink message type definitions
 * Used across Main Process (parser) and Renderer (telemetry display)
 */

// MAVLink message header (common to all messages)
export interface MavlinkHeader {
  msgid: number
  sysid: number
  compid: number
  seq: number
}

// Generic MAVLink message wrapper
export interface MavlinkMessage<T = unknown> {
  header: MavlinkHeader
  payload: T
}

// --- Received messages ---

export interface HeartbeatMessage {
  type: number // MAV_TYPE
  autopilot: number // MAV_AUTOPILOT
  base_mode: number // MAV_MODE_FLAG bitmask
  custom_mode: number
  system_status: number // MAV_STATE
  mavlink_version: number
}

export interface AttitudeMessage {
  time_boot_ms: number
  roll: number // rad
  pitch: number // rad
  yaw: number // rad
  rollspeed: number // rad/s
  pitchspeed: number // rad/s
  yawspeed: number // rad/s
}

export interface GlobalPositionIntMessage {
  time_boot_ms: number
  lat: number // degE7
  lon: number // degE7
  alt: number // mm AMSL
  relative_alt: number // mm AGL
  vx: number // cm/s
  vy: number // cm/s
  vz: number // cm/s
  hdg: number // cdeg (0..35999)
}

export interface VfrHudMessage {
  airspeed: number // m/s
  groundspeed: number // m/s
  heading: number // deg (0..360)
  throttle: number // % (0..100)
  alt: number // m AMSL
  climb: number // m/s
}

export interface SysStatusMessage {
  onboard_control_sensors_present: number
  onboard_control_sensors_enabled: number
  onboard_control_sensors_health: number
  load: number // permille (0..1000)
  voltage_battery: number // mV
  current_battery: number // cA (10 * mA)
  battery_remaining: number // % (-1 = not available)
  drop_rate_comm: number // permille
  errors_comm: number
  errors_count1: number
  errors_count2: number
  errors_count3: number
  errors_count4: number
}

export interface ParamValueMessage {
  param_id: string // 16 char max
  param_value: number
  param_type: number // MAV_PARAM_TYPE
  param_count: number
  param_index: number
}

export interface CommandAckMessage {
  command: number // MAV_CMD
  result: number // MAV_RESULT
  progress: number // 0..100 or 255 if not available
  result_param2: number
  target_system: number
  target_component: number
}

// --- MAVLink enums ---

export const MAV_TYPE = {
  GENERIC: 0,
  FIXED_WING: 1,
  QUADROTOR: 2,
  COAXIAL: 3,
  HELICOPTER: 4,
  VTOL_TAILSITTER_DUOROTOR: 19,
  VTOL_TAILSITTER_QUADROTOR: 20,
  VTOL_TILTROTOR: 21,
  VTOL_FIXEDROTOR: 22,
  VTOL_TAILSITTER: 23
} as const

export const MAV_STATE = {
  UNINIT: 0,
  BOOT: 1,
  CALIBRATING: 2,
  STANDBY: 3,
  ACTIVE: 4,
  CRITICAL: 5,
  EMERGENCY: 6,
  POWEROFF: 7,
  FLIGHT_TERMINATION: 8
} as const

export const MAV_MODE_FLAG = {
  CUSTOM_MODE_ENABLED: 1,
  TEST_ENABLED: 2,
  AUTO_ENABLED: 4,
  GUIDED_ENABLED: 8,
  STABILIZE_ENABLED: 16,
  HIL_ENABLED: 32,
  MANUAL_INPUT_ENABLED: 64,
  SAFETY_ARMED: 128
} as const

export const MAV_RESULT = {
  ACCEPTED: 0,
  TEMPORARILY_REJECTED: 1,
  DENIED: 2,
  UNSUPPORTED: 3,
  FAILED: 4,
  IN_PROGRESS: 5,
  CANCELLED: 6
} as const

export const MAV_CMD = {
  COMPONENT_ARM_DISARM: 400,
  NAV_TAKEOFF: 22,
  NAV_LAND: 21,
  NAV_RETURN_TO_LAUNCH: 20,
  DO_SET_MODE: 176
} as const

// Union type of all known message payloads
export type MavlinkPayload =
  | HeartbeatMessage
  | AttitudeMessage
  | GlobalPositionIntMessage
  | VfrHudMessage
  | SysStatusMessage
  | ParamValueMessage
  | CommandAckMessage
