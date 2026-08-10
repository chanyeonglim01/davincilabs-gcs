/**
 * Telemetry subscription helpers
 *
 * Telemetry arrives at 30 Hz and every frame replaces both `telemetry` and
 * `history` with fresh objects, so a component that reads either one re-renders
 * thirty times a second — a selector on `state.telemetry` does not change that,
 * because the object identity is new each time. The only thing that helps is
 * subscribing to the narrowest value a component actually draws.
 *
 * These helpers cover the two cases plain selectors cannot:
 *
 *  - `useLivePose` — for consumers that push telemetry straight into an
 *    imperative API (Leaflet markers). They need every frame but never need a
 *    re-render, so the subscription bypasses React entirely.
 *  - `useThrottledHistory` — for consumers that plot the buffer. A chart redrawn
 *    at 30 Hz is indistinguishable from one redrawn at 5 Hz and costs six times
 *    as much.
 */

import { useEffect, useRef, useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import type { TelemetryData } from '@renderer/types'

export interface LivePose {
  lat: number
  lon: number
  heading: number
}

/**
 * Call `onPose` for every telemetry frame **without re-rendering the caller**.
 *
 * The callback runs outside React's render cycle, so it may only touch refs and
 * imperative handles — never state that the component renders from.
 */
export function useLivePose(onPose: (pose: LivePose) => void): void {
  const latest = useRef(onPose)

  // Keep the callback current without restarting the subscription.
  useEffect(() => {
    latest.current = onPose
  })

  useEffect(() => {
    const push = (data: TelemetryData | null): void => {
      if (!data) return
      latest.current({
        lat: data.position.lat,
        lon: data.position.lon,
        heading: data.heading ?? 0
      })
    }

    push(useTelemetryStore.getState().telemetry)

    return useTelemetryStore.subscribe((state, previous) => {
      if (state.telemetry !== previous.telemetry) push(state.telemetry)
    })
  }, [])
}

/**
 * Snapshot of the telemetry history, refreshed at most every `intervalMs`.
 *
 * Returns the identical array reference when nothing new arrived, so an idle
 * link produces no re-renders at all.
 */
export function useThrottledHistory(intervalMs: number): TelemetryData[] {
  const [history, setHistory] = useState<TelemetryData[]>(
    () => useTelemetryStore.getState().history
  )

  useEffect(() => {
    const timer = setInterval(() => {
      const next = useTelemetryStore.getState().history
      setHistory((current) => (current === next ? current : next))
    }, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return history
}
