import { useEffect } from 'react'
import { useTelemetryStore } from '../store/telemetryStore'

export function useMavlink() {
  const setTelemetry = useTelemetryStore((state) => state.setTelemetry)
  const setConnection = useTelemetryStore((state) => state.setConnection)
  const setHomePosition = useTelemetryStore((state) => state.setHomePosition)

  useEffect(() => {
    // Check if window.mavlink is available (it will be provided by the Backend agent)
    if (!window.mavlink) {
      console.warn('window.mavlink API not available yet')
      return
    }

    // Setup telemetry listener
    const unsubscribeTelemetry = window.mavlink.onTelemetryUpdate((data) => {
      setTelemetry(data)
    })

    // Setup connection status listener
    const unsubscribeConnection = window.mavlink.onConnectionStatus((status) => {
      setConnection(status)
    })

    // Setup home position listener (set once on first valid GPS fix)
    const unsubscribeHome = window.mavlink.onHomePosition((home) => {
      setHomePosition(home)
    })

    // Fetch initial connection status (handles auto-connect race condition)
    window.mavlink
      .getConnectionStatus()
      .then((status) => {
        setConnection(status)
      })
      .catch(() => {
        // Ignore — API not ready yet
      })

    // Cleanup on unmount
    return () => {
      if (unsubscribeTelemetry) unsubscribeTelemetry()
      if (unsubscribeConnection) unsubscribeConnection()
      if (unsubscribeHome) unsubscribeHome()
    }
  }, [setTelemetry, setConnection, setHomePosition])
}
