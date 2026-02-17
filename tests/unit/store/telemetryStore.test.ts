/**
 * Zustand telemetryStore unit tests
 * Tests initial state and basic state mutation methods.
 */
import { describe, it, expect, beforeEach } from 'vitest'

// Stub the @renderer alias resolution for vitest (node environment)
// We manually import the store using the resolved path since vitest
// does not bundle the renderer in node mode.
import { useTelemetryStore } from '../../../src/renderer/src/store/telemetryStore'
import type { TelemetryData, ConnectionStatus } from '../../../src/renderer/src/types/telemetry'
import type { ConnectionConfig } from '../../../src/renderer/src/types/ipc'

// Helper that creates a minimal TelemetryData object
function makeTelemetry(overrides: Partial<TelemetryData> = {}): TelemetryData {
  return {
    attitude: { roll: 0, pitch: 0, yaw: 0, rollspeed: 0, pitchspeed: 0, yawspeed: 0 },
    position: { lat: 37.5, lon: 127.0, alt: 100, relative_alt: 50 },
    velocity: { vx: 0, vy: 0, vz: 0, groundspeed: 0, airspeed: 0, climb: 0 },
    status: {
      armed: false,
      flightMode: 'MANUAL',
      systemStatus: 'STANDBY',
      battery: { voltage: 22.2, current: 0, remaining: 100 },
      cpuLoad: 5
    },
    heading: 90,
    throttle: 0,
    timestamp: Date.now(),
    ...overrides
  }
}

describe('useTelemetryStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useTelemetryStore.setState({
      telemetry: null,
      connection: {
        connected: false,
        mode: 'simulink',
        host: '127.0.0.1',
        port: 14551,
        lastHeartbeat: 0
      },
      history: [],
      maxHistorySize: 300
    })
  })

  describe('initial state', () => {
    it('telemetry is null on init', () => {
      const { telemetry } = useTelemetryStore.getState()
      expect(telemetry).toBeNull()
    })

    it('connection defaults are correct', () => {
      const { connection } = useTelemetryStore.getState()
      expect(connection.connected).toBe(false)
      expect(connection.mode).toBe('simulink')
      expect(connection.host).toBe('127.0.0.1')
      expect(connection.port).toBe(14551)
      expect(connection.lastHeartbeat).toBe(0)
    })

    it('history is empty on init', () => {
      const { history } = useTelemetryStore.getState()
      expect(history).toHaveLength(0)
    })

    it('maxHistorySize is 300', () => {
      const { maxHistorySize } = useTelemetryStore.getState()
      expect(maxHistorySize).toBe(300)
    })
  })

  describe('setTelemetry', () => {
    it('sets telemetry data', () => {
      const data = makeTelemetry()
      useTelemetryStore.getState().setTelemetry(data)
      const { telemetry } = useTelemetryStore.getState()
      expect(telemetry).not.toBeNull()
      expect(telemetry?.heading).toBe(90)
    })

    it('appends to history on each call', () => {
      useTelemetryStore.getState().setTelemetry(makeTelemetry({ heading: 10 }))
      useTelemetryStore.getState().setTelemetry(makeTelemetry({ heading: 20 }))
      const { history } = useTelemetryStore.getState()
      expect(history).toHaveLength(2)
    })

    it('history does not exceed maxHistorySize', () => {
      const store = useTelemetryStore.getState()
      useTelemetryStore.setState({ maxHistorySize: 3 })
      store.setTelemetry(makeTelemetry({ heading: 1 }))
      store.setTelemetry(makeTelemetry({ heading: 2 }))
      store.setTelemetry(makeTelemetry({ heading: 3 }))
      store.setTelemetry(makeTelemetry({ heading: 4 }))
      const { history } = useTelemetryStore.getState()
      expect(history.length).toBeLessThanOrEqual(3)
    })

    it('most recent telemetry is the last history entry', () => {
      useTelemetryStore.getState().setTelemetry(makeTelemetry({ heading: 100 }))
      useTelemetryStore.getState().setTelemetry(makeTelemetry({ heading: 200 }))
      const { history } = useTelemetryStore.getState()
      expect(history[history.length - 1].heading).toBe(200)
    })
  })

  describe('setConnection', () => {
    it('updates connection status', () => {
      const newStatus: ConnectionStatus = {
        connected: true,
        mode: 'simulink',
        host: '192.168.1.1',
        port: 14550,
        lastHeartbeat: Date.now()
      }
      useTelemetryStore.getState().setConnection(newStatus)
      const { connection } = useTelemetryStore.getState()
      expect(connection.connected).toBe(true)
      expect(connection.host).toBe('192.168.1.1')
      expect(connection.port).toBe(14550)
    })
  })

  describe('clearHistory', () => {
    it('clears history', () => {
      useTelemetryStore.getState().setTelemetry(makeTelemetry())
      useTelemetryStore.getState().setTelemetry(makeTelemetry())
      useTelemetryStore.getState().clearHistory()
      const { history } = useTelemetryStore.getState()
      expect(history).toHaveLength(0)
    })

    it('does not clear current telemetry', () => {
      useTelemetryStore.getState().setTelemetry(makeTelemetry({ heading: 42 }))
      useTelemetryStore.getState().clearHistory()
      const { telemetry } = useTelemetryStore.getState()
      expect(telemetry).not.toBeNull()
      expect(telemetry?.heading).toBe(42)
    })
  })
})
