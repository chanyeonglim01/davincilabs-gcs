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
  systemStatus: string
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
