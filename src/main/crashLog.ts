/**
 * Crash & Diagnostics Logging
 *
 * The GCS window turns solid white when the renderer process dies: the window
 * repaints with BrowserWindow's background colour and nothing is left to draw.
 * Until now none of that was recorded anywhere, so the cause was unknowable.
 *
 * This module makes every such death leave a trace on disk:
 *   - a rolling text log at  <userData>/logs/gcs-crash.log
 *   - native crash dumps at  <crashDumps>/reports/*.dmp   (local only, never uploaded)
 *   - a memory ring buffer flushed into the log on every crash, so memory
 *     exhaustion shows up as a rising renderer workingSetSize while a GPU or
 *     driver kill shows a flat one
 *
 * Writes are synchronous on purpose: an async append is lost when the process
 * is dying, which is exactly when we need the line.
 */

import { app, crashReporter, ipcMain, BrowserWindow } from 'electron'
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import type { RendererErrorReport } from '../renderer/src/types'

const MAX_LOG_BYTES = 4 * 1024 * 1024
const SAMPLE_INTERVAL_MS = 5000
const RING_CAPACITY = 120 // 10 minutes at 5s
const RING_DUMP_COUNT = 24 // last 2 minutes are written on a crash
const HEARTBEAT_EVERY_N_SAMPLES = 6 // one routine memory line per 30s
const RISING_THRESHOLD_MB = 300
const MAX_AUTO_RELOADS = 3
const RELOAD_WINDOW_MS = 60_000

interface MemorySample {
  t: number
  browserMb: number
  rendererMb: number
  gpuMb: number
}

let logFile: string | null = null
let logFileResolved = false
const ring: MemorySample[] = []
let sampleCount = 0
let sampleTimer: ReturnType<typeof setInterval> | null = null
let reloadTimes: number[] = []
let quitting = false

// ─── log file plumbing ───────────────────────────────────────────────────────

function resolveLogFile(): string | null {
  if (logFileResolved) return logFile
  logFileResolved = true
  try {
    const dir = join(app.getPath('userData'), 'logs')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    logFile = join(dir, 'gcs-crash.log')
  } catch {
    logFile = null
  }
  return logFile
}

function rotateIfNeeded(file: string): void {
  try {
    if (!existsSync(file) || statSync(file).size <= MAX_LOG_BYTES) return
    const previous = `${file}.1`
    // Windows renameSync fails onto an existing target, so clear it first.
    rmSync(previous, { force: true })
    renameSync(file, previous)
  } catch {
    // Rotation is best-effort; never block a log write on it.
  }
}

function write(line: string): void {
  const file = resolveLogFile()
  if (!file) return
  try {
    rotateIfNeeded(file)
    appendFileSync(file, `${line}\n`, 'utf8')
  } catch {
    // Logging must never be able to break the app.
  }
}

function emit(tag: string, message: string, severe: boolean): void {
  const line = `${new Date().toISOString()} [${tag}] ${message}`
  write(line)
  if (severe) {
    console.error(line)
  } else {
    console.log(line)
  }
}

/** Routine diagnostic line. */
export function log(tag: string, message: string): void {
  emit(tag, message, false)
}

/** Crash / failure line — also highlighted in the `pnpm dev` terminal. */
export function logCrash(tag: string, message: string): void {
  emit(tag, message, true)
}

/** Absolute path of the diagnostics log, or null if it could not be opened. */
export function getLogFilePath(): string | null {
  return resolveLogFile()
}

// ─── memory sampling ─────────────────────────────────────────────────────────

function sample(): void {
  try {
    let browserMb = 0
    let rendererMb = 0
    let gpuMb = 0
    for (const metric of app.getAppMetrics()) {
      // workingSetSize is reported in kilobytes.
      const mb = Math.round((metric.memory?.workingSetSize ?? 0) / 1024)
      if (metric.type === 'Browser') browserMb += mb
      else if (metric.type === 'Tab') rendererMb += mb
      else if (metric.type === 'GPU') gpuMb += mb
    }
    ring.push({ t: Date.now(), browserMb, rendererMb, gpuMb })
    if (ring.length > RING_CAPACITY) ring.shift()
  } catch {
    // Metrics are best-effort.
  }
}

function formatSample(s: MemorySample): string {
  return `browser=${s.browserMb}MB renderer=${s.rendererMb}MB gpu=${s.gpuMb}MB`
}

/**
 * Write the recent memory trail into the log. Called on every crash so the
 * incident record answers "was it running out of memory?" on its own.
 */
function dumpMemoryTrail(): void {
  const tail = ring.slice(-RING_DUMP_COUNT)
  if (tail.length === 0) {
    write('    memory trail: (no samples yet)')
    return
  }
  write(
    `    memory trail, oldest first — ${tail.length} samples @ ${SAMPLE_INTERVAL_MS / 1000}s:`
  )
  for (const s of tail) {
    write(`      ${new Date(s.t).toISOString()}  ${formatSample(s)}`)
  }
  const delta = tail[tail.length - 1].rendererMb - tail[0].rendererMb
  const verdict =
    delta > RISING_THRESHOLD_MB
      ? 'RISING — memory exhaustion is the likely cause'
      : 'FLAT — GPU/driver or native kill is the likely cause'
  write(`    renderer delta across trail: ${delta >= 0 ? '+' : ''}${delta}MB  → ${verdict}`)
}

/** Start the 5s memory sampler. Safe to call more than once. */
export function startMetricsSampler(): void {
  if (sampleTimer) return
  sample()
  sampleTimer = setInterval(() => {
    sample()
    sampleCount += 1
    if (sampleCount % HEARTBEAT_EVERY_N_SAMPLES === 0) {
      const last = ring[ring.length - 1]
      if (last) log('mem', formatSample(last))
    }
  }, SAMPLE_INTERVAL_MS)
}

// ─── guards ──────────────────────────────────────────────────────────────────

/**
 * Enable crash reporting and open the log. Call this as early as possible in
 * the main process — before app.whenReady().
 */
export function initCrashLogging(): void {
  try {
    // Local dumps only. submitURL is unused when uploadToServer is false.
    crashReporter.start({ submitURL: '', uploadToServer: false })
  } catch (error) {
    logCrash('boot', `crashReporter.start failed: ${String(error)}`)
  }

  let dumpDir = 'unavailable'
  try {
    dumpDir = app.getPath('crashDumps')
  } catch {
    // Not fatal — the text log still works.
  }

  write('')
  log(
    'boot',
    `GCS ${app.getVersion()} electron=${process.versions.electron} chrome=${process.versions.chrome} platform=${process.platform} arch=${process.arch}`
  )
  log('boot', `log=${getLogFilePath() ?? 'unavailable'}`)
  log('boot', `dumps=${dumpDir}`)
}

/** Process-wide guards: GPU/utility deaths and unhandled main-process failures. */
export function attachProcessGuards(): void {
  app.on('before-quit', () => {
    quitting = true
  })

  app.on('child-process-gone', (_event, details) => {
    const name = details.name ? ` name=${details.name}` : ''
    logCrash(
      'child-gone',
      `type=${details.type} reason=${details.reason} exitCode=${details.exitCode}${name}`
    )
    if (details.type === 'GPU') dumpMemoryTrail()
  })

  process.on('uncaughtException', (error: Error) => {
    logCrash('main-uncaught', `${error.name}: ${error.message}\n${error.stack ?? '(no stack)'}`)
  })

  process.on('unhandledRejection', (reason: unknown) => {
    const text =
      reason instanceof Error
        ? `${reason.name}: ${reason.message}\n${reason.stack ?? '(no stack)'}`
        : String(reason)
    logCrash('main-unhandled-rejection', text)
  })
}

/**
 * Window guards: renderer death (the white screen), hangs, and failed loads.
 * A dead renderer is reloaded automatically, rate-limited so a crash loop
 * cannot spin forever.
 */
export function attachWindowGuards(win: BrowserWindow): void {
  win.webContents.on('render-process-gone', (_event, details) => {
    logCrash(
      'renderer-gone',
      `reason=${details.reason} exitCode=${details.exitCode}  ← this is the white screen`
    )
    dumpMemoryTrail()

    if (details.reason === 'clean-exit' || quitting || win.isDestroyed()) return

    const now = Date.now()
    reloadTimes = reloadTimes.filter((t) => now - t < RELOAD_WINDOW_MS)
    if (reloadTimes.length >= MAX_AUTO_RELOADS) {
      logCrash(
        'renderer-gone',
        `auto-reload suppressed — ${reloadTimes.length} crashes within ${RELOAD_WINDOW_MS / 1000}s`
      )
      return
    }
    reloadTimes.push(now)
    logCrash('renderer-gone', `auto-reload ${reloadTimes.length}/${MAX_AUTO_RELOADS}`)
    win.reload()
  })

  win.on('unresponsive', () => {
    logCrash('hang', 'renderer stopped responding')
    dumpMemoryTrail()
  })

  win.on('responsive', () => {
    log('hang', 'renderer responsive again')
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logCrash('load-fail', `${errorCode} ${errorDescription} url=${validatedURL}`)
  })
}

/** Receive renderer-side failure reports (see renderer/src/lib/errorReporting.ts). */
export function registerCrashIpc(): void {
  ipcMain.on(
    'app:renderer-error',
    (_event: Electron.IpcMainEvent, report: RendererErrorReport): void => {
      // perf-timeline is a routine diagnostic, not a failure.
      if (report.kind === 'perf-timeline') {
        log('perf', report.message)
        return
      }
      const where = report.source ? ` @ ${report.source}` : ''
      logCrash('renderer-error', `${report.kind}: ${report.message}${where}`)
      if (report.stack) write(`    ${report.stack.split('\n').join('\n    ')}`)
      if (report.kind === 'webgl-context-lost') dumpMemoryTrail()
    }
  )
}
