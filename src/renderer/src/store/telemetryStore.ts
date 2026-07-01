import { create } from 'zustand'
import type { TelemetryData, ConnectionStatus, HomePosition } from '@renderer/types'

interface TelemetryStore {
  telemetry: TelemetryData | null
  connection: ConnectionStatus
  history: TelemetryData[]
  maxHistorySize: number
  /** Increments when user requests map to recenter on drone (TAKEOFF or manual). */
  mapCenterRequestId: number
  /** Drone home position — set once on first valid GPS fix. null until then. */
  homePosition: HomePosition | null

  setTelemetry: (data: TelemetryData) => void
  setConnection: (status: ConnectionStatus) => void
  setHomePosition: (home: HomePosition) => void
  clearHistory: () => void
  requestMapCenter: () => void
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
  mapCenterRequestId: 0,
  homePosition: null,

  setTelemetry: (data) =>
    set((state) => ({
      telemetry: data,
      history: [...state.history.slice(-state.maxHistorySize + 1), data]
    })),

  setConnection: (status) => set({ connection: status }),
  setHomePosition: (home) => set({ homePosition: home }),
  clearHistory: () => set({ history: [] }),
  requestMapCenter: () => set((s) => ({ mapCenterRequestId: s.mapCenterRequestId + 1 }))
}))
