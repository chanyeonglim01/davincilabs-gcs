import { create } from 'zustand'
import type { TelemetryData, ConnectionStatus } from '@renderer/types'

interface TelemetryStore {
  telemetry: TelemetryData | null
  connection: ConnectionStatus
  history: TelemetryData[]
  maxHistorySize: number

  setTelemetry: (data: TelemetryData) => void
  setConnection: (status: ConnectionStatus) => void
  clearHistory: () => void
}

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  telemetry: null,
  connection: {
    connected: false,
    mode: 'simulink',
    host: '127.0.0.1',
    port: 14551,
    lastHeartbeat: 0
  },
  history: [],
  maxHistorySize: 300, // 10 seconds at 30Hz

  setTelemetry: (data) =>
    set((state) => ({
      telemetry: data,
      history: [...state.history.slice(-state.maxHistorySize + 1), data]
    })),

  setConnection: (status) => set({ connection: status }),
  clearHistory: () => set({ history: [] })
}))
