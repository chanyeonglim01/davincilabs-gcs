import { create } from 'zustand'
import type { TelemetryData, ConnectionStatus, HomePosition } from '@renderer/types'

export interface TrailPoint {
  lat: number
  lon: number
  timestamp: number
}

/**
 * Minimum spacing between stored trail points, in degrees (~2 m).
 * Telemetry arrives at 30 Hz; storing every frame would add 30 points a second
 * for the whole flight, which is how a trail turns into a memory leak.
 */
const TRAIL_MIN_STEP_DEG = 1.8e-5

/**
 * Hard cap on stored trail points. On reaching it the path is halved rather than
 * truncated, so the full route is kept at lower resolution instead of losing its
 * beginning. 5000 covers ~10 km at 2 m spacing, and keeps the polyline cheap
 * enough for Leaflet to re-project on every redraw.
 */
const TRAIL_MAX_POINTS = 5000

/**
 * How long a point stays on the map trail before it ages out of the head of
 * the array, so the drawn track only covers the trailing window of flight
 * (QGC/Mission Planner style) instead of accumulating for the whole session.
 */
const TRAIL_TTL_MS = 60_000

interface TelemetryStore {
  telemetry: TelemetryData | null
  connection: ConnectionStatus
  history: TelemetryData[]
  maxHistorySize: number
  /**
   * Whole-flight path for the map trail, decimated by distance. Kept outside
   * `history` (10 s of raw frames for the charts) so it survives view switches
   * and covers the entire mission.
   */
  flightPath: TrailPoint[]
  /** Increments when user requests map to recenter on drone (TAKEOFF or manual). */
  mapCenterRequestId: number
  /** Drone home position — set once on first valid GPS fix. null until then. */
  homePosition: HomePosition | null

  setTelemetry: (data: TelemetryData) => void
  setConnection: (status: ConnectionStatus) => void
  setHomePosition: (home: HomePosition) => void
  clearHistory: () => void
  clearFlightPath: () => void
  requestMapCenter: () => void
}

/**
 * Append a position to the flight path, skipping frames the vehicle barely moved
 * in. Returns the original array when nothing was added, so consumers can detect
 * "no new point" by reference.
 */
function appendTrailPoint(path: TrailPoint[], data: TelemetryData, now: number): TrailPoint[] {
  // Age out points past the TTL first, so the trail keeps shrinking from the
  // head even while the vehicle sits still (position-based dedup below would
  // otherwise never touch the array again).
  const fresh = path.filter((p) => now - p.timestamp < TRAIL_TTL_MS)

  const { lat, lon } = data.position
  if (lat === 0 && lon === 0) return fresh.length === path.length ? path : fresh // no GPS fix yet

  const last = fresh[fresh.length - 1]
  if (
    last &&
    Math.abs(lat - last.lat) < TRAIL_MIN_STEP_DEG &&
    Math.abs(lon - last.lon) < TRAIL_MIN_STEP_DEG
  ) {
    return fresh
  }

  const next = [...fresh, { lat, lon, timestamp: now }]
  // Halve the resolution instead of dropping the start of the trailing window.
  return next.length > TRAIL_MAX_POINTS ? next.filter((_, i) => i % 2 === 0) : next
}

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  telemetry: null,
  connection: {
    connected: false,
    linkState: 'DISCONNECTED',
    mode: 'simulink',
    host: '127.0.0.1',
    port: 14551,
    lastHeartbeat: 0
  },
  history: [],
  maxHistorySize: 300, // 10 seconds at 30Hz
  flightPath: [],
  mapCenterRequestId: 0,
  homePosition: null,

  setTelemetry: (data) =>
    set((state) => ({
      telemetry: data,
      history: [...state.history.slice(-state.maxHistorySize + 1), data],
      flightPath: appendTrailPoint(state.flightPath, data, Date.now())
    })),

  setConnection: (status) => set({ connection: status }),
  setHomePosition: (home) => set({ homePosition: home }),
  clearHistory: () => set({ history: [] }),
  clearFlightPath: () => set({ flightPath: [] }),
  requestMapCenter: () => set((s) => ({ mapCenterRequestId: s.mapCenterRequestId + 1 }))
}))
