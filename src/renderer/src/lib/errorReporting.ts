/**
 * Renderer failure reporting
 *
 * Forwards renderer-side failures to the main process log so a white-screen
 * incident leaves a trace even when React never sees the error — async
 * callbacks, the Cesium/Leaflet render loops, and rejected promises all throw
 * outside React's render phase, where an ErrorBoundary cannot reach them.
 *
 * `webglcontextlost` is listened for in the capture phase: the event is
 * dispatched on the <canvas> and does not bubble, but the capture path still
 * runs through window on its way down to the target.
 */

import type { RendererErrorReport } from '@renderer/types'

function report(payload: RendererErrorReport): void {
  window.mavlink?.reportRendererError(payload)
}

function stackOf(value: unknown): string | null {
  return value instanceof Error ? (value.stack ?? null) : null
}

function messageOf(value: unknown): string {
  return value instanceof Error ? `${value.name}: ${value.message}` : String(value)
}

const PERF_SWEEP_INTERVAL_MS = 5000
const PERF_REPORT_EVERY_N_SWEEPS = 6 // one line per 30s, matching the main-process [mem] line

/**
 * Bound the user-timing buffer.
 *
 * React's development build emits a performance.measure() per component render
 * (its COMPONENTS_TRACK instrumentation). Chrome never evicts user-timing
 * entries, so at telemetry rates the timeline grows without bound — measured at
 * ~21MB/s, reaching the renderer's ~4GB ceiling in about three minutes and
 * ending in an out-of-memory hang, i.e. the white screen.
 *
 * This app never calls performance.mark/measure itself, so clearing the buffer
 * is safe. Production builds emit nothing and the sweep costs nothing.
 * Trade-off: React DevTools' component performance track is truncated to the
 * last few seconds.
 */
export function installPerformanceTimelineGuard(): void {
  let sweptSinceReport = 0
  let sweeps = 0

  setInterval(() => {
    try {
      // Safe to materialise: the buffer only ever holds one sweep interval.
      const entries =
        performance.getEntriesByType('measure').length + performance.getEntriesByType('mark').length
      if (entries > 0) {
        performance.clearMeasures()
        performance.clearMarks()
        sweptSinceReport += entries
      }
      sweeps += 1
      if (sweeps % PERF_REPORT_EVERY_N_SWEEPS === 0) {
        if (sweptSinceReport > 0) {
          report({
            kind: 'perf-timeline',
            message: `swept ${sweptSinceReport} user-timing entries in the last ${(PERF_SWEEP_INTERVAL_MS * PERF_REPORT_EVERY_N_SWEEPS) / 1000}s`,
            stack: null,
            source: null
          })
        }
        sweptSinceReport = 0
      }
    } catch {
      // Diagnostics must never break the UI.
    }
  }, PERF_SWEEP_INTERVAL_MS)
}

export function installGlobalErrorReporters(): void {
  window.addEventListener('error', (event: ErrorEvent): void => {
    report({
      kind: 'window-error',
      message: event.message || messageOf(event.error),
      stack: stackOf(event.error),
      source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : null
    })
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent): void => {
    report({
      kind: 'unhandled-rejection',
      message: messageOf(event.reason),
      stack: stackOf(event.reason),
      source: null
    })
  })

  window.addEventListener(
    'webglcontextlost',
    (event: Event): void => {
      const canvas = event.target as HTMLCanvasElement | null
      const label = canvas?.id || canvas?.className || 'unnamed canvas'
      report({
        kind: 'webgl-context-lost',
        message: `WebGL context lost (${label})`,
        stack: null,
        source: null
      })
    },
    true
  )
}
