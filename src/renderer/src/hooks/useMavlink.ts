import { useEffect } from 'react'
import { useTelemetryStore } from '../store/telemetryStore'

export function useMavlink() {
  const setTelemetry = useTelemetryStore((state) => state.setTelemetry)
  const setConnection = useTelemetryStore((state) => state.setConnection)

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

    // Cleanup on unmount
    return () => {
      if (unsubscribeTelemetry) unsubscribeTelemetry()
      if (unsubscribeConnection) unsubscribeConnection()
    }
  }, [setTelemetry, setConnection])
}
