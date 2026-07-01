/**
 * Telemetry data structures
 * Aggregated from multiple MAVLink messages, sent via IPC to Renderer
 */

export interface AttitudeData {
  roll: number // rad
  pitch: number // rad
  yaw: number // rad
  rollspeed: number // rad/s
  pitchspeed: number // rad/s
  yawspeed: number // rad/s
}

export interface PositionData {
  lat: number // degrees
  lon: number // degrees
  alt: number // meters AMSL
  relative_alt: number // meters AGL
  distance_to_wp?: number // meters (optional, may not be available)
}

export interface VelocityData {
  vx: number // m/s north
  vy: number // m/s east
  vz: number // m/s down
  groundspeed: number // m/s
  airspeed: number // m/s
  climb: number // m/s
}

export interface BatteryData {
  voltage: number // V
  current: number // A
  remaining: number // % (0..100, -1 = unknown)
}

export interface StatusData {
  armed: boolean
  flightMode: string
  /** Two-line mode label: primary = MANUAL/AUTO/EMERGENCY. */
  flightModePrimary?: string
  /** Two-line mode label: sub-state (one word, e.g. TAKEOFF/HOVER). */
  flightModeSub?: string
  /** Raw flight_mode enum from custom_mode bits [0..7] (0=Manual, 1=Auto, 2=Emergency). */
  flightModeRaw?: number
  /** Auto sub-state from custom_mode bits [16..23] (0=IDLE, 1=TAKEOFF, 2=MISSION, 3=LAND, 4=RTL, 5=HOLD). */
  subState?: number
  /** RC override active (custom_mode bit 24). True = RC stick is overriding GCS commands. */
  rcOverride?: boolean
  /** RC link up (custom_mode bit 25). True = RC 값 수신 중 (connect). */
  rcLink?: boolean
  systemStatus: string
  /** GPS fix_type from GPS_RAW_INT (0/1=no fix, 2=2D, 3=3D, 4=DGPS, 5/6=RTK). */
  gpsFix?: number
  /** Satellites visible from GPS_RAW_INT. */
  satellites?: number
  /** LIHAI serial link up (LIHAI_STATUS byte 0). */
  lihaiLink?: boolean
  /** LIHAI subsystem error flags (LIHAI_STATUS bytes 1..7, 0 = OK, nonzero = error). */
  lihaiErrors?: { bat: number; gps: number; imu: number; baro: number; rc: number; angle: number; pos: number }
  /** Timestamp (ms, Date.now) of last LIHAI_STATUS received. >0 & fresh = CONNECTED. */
  lihaiRxMs?: number
  /** KETI detection valid (KETI_OBSTACLE byte 20). */
  ketiValid?: boolean
  /** KETI total object count (KETI_OBSTACLE byte 21). */
  ketiCount?: number
  /** KETI nearest-object class id (KETI_OBSTACLE byte 22). */
  ketiId?: number
  /** KETI nearest-object distance in metres (KETI_OBSTACLE offset 0). */
  ketiDistance?: number
  /** KETI nearest-object relative x in metres (KETI_OBSTACLE offset 4). */
  ketiObjX?: number
  /** KETI nearest-object relative y in metres (KETI_OBSTACLE offset 8). */
  ketiObjY?: number
  /** KETI nearest-object relative z in metres (KETI_OBSTACLE offset 12). */
  ketiObjZ?: number
  /** KETI nearest-object size (KETI_OBSTACLE offset 16). */
  ketiSize?: number
  /** Timestamp (ms, Date.now) of last KETI_OBSTACLE received. >0 & fresh = CONNECTED. */
  ketiRxMs?: number
  battery: BatteryData
  cpuLoad: number // % (0..100)
}

export interface TelemetryData {
  attitude: AttitudeData
  position: PositionData
  velocity: VelocityData
  status: StatusData
  heading: number // degrees (0..360)
  throttle: number // % (0..100)
  timestamp: number // ms since epoch
}

// Timestamped telemetry point for chart history
export interface TelemetryPoint {
  time: number // ms since epoch
  value: number
}

// Home position (set once on first valid GPS fix or explicitly)
export interface HomePosition {
  lat: number
  lon: number
  alt: number
}
