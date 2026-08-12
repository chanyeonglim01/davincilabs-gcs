/**
 * Electron Main Process
 * Entry point for DavinciLabs GCS
 */

import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  initCrashLogging,
  attachProcessGuards,
  attachWindowGuards,
  registerCrashIpc,
  startMetricsSampler
} from './crashLog'

// Must be called before app.whenReady().
app.commandLine.appendSwitch('ignore-gpu-blacklist')
app.commandLine.appendSwitch('enable-webgl', 'true')

// The two switches below were added for a WebGL GPU-process crash on macOS and
// must stay scoped to it. ANGLE has no Metal backend outside macOS, and
// disable-gpu-process-crash-limit removes Chromium's fallback to software
// rendering after repeated GPU crashes — on Windows that turns a recoverable
// GPU blip into a dead renderer, i.e. the solid-white window.
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('use-angle', 'metal')
  app.commandLine.appendSwitch('disable-gpu-process-crash-limit')
}

// Earliest possible — enables native crash dumps and opens
// <userData>/logs/gcs-crash.log so a white screen is no longer silent.
initCrashLogging()

// MAVLink connection and parser
import { getMavlinkConnection } from './mavlink/connection'
import { getMavlinkParser } from './mavlink/parser'

// IPC handlers
import {
  registerTelemetryHandlers,
  sendTelemetryUpdate,
  sendHomePosition,
  sendLogMessage
} from './ipc/telemetry'
import { registerCommandHandlers } from './ipc/commands'
import {
  registerParameterHandlers,
  sendParamValue,
  sendParamProgress,
  onParamRequest
} from './ipc/parameters'
import { registerSerialHandlers } from './ipc/serial'

// Store
import { getWindowBounds, setWindowBounds } from './store'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const bounds = getWindowBounds()

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    title: 'DavinciLabs GCS',
    // Without this the window paints Chromium's default white when the renderer
    // dies. Matching the app background keeps a crash visually distinguishable
    // from a React unmount and removes the alarming white flash.
    backgroundColor: '#13151A',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Record renderer death / hangs / failed loads, and auto-reload a dead renderer.
  attachWindowGuards(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Save window bounds on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      setWindowBounds(bounds)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Initialize MAVLink connection and parser
 */
function initializeMavlink(): void {
  const connection = getMavlinkConnection()
  const parser = getMavlinkParser()

  let paramTotalCount = 0
  const paramSeen = new Set<number>()

  // Wire up parser events to IPC
  parser.on('telemetry', (data) => {
    sendTelemetryUpdate(data)
  })

  parser.on('homePosition', (home) => {
    sendHomePosition(home)
  })

  parser.on('paramCount', (count) => {
    paramTotalCount = count
  })

  parser.on('paramValue', (param) => {
    sendParamValue(param)
    // Index-set dedup: PARAM_SET echoes and re-requested indices resend the
    // same index, which a plain counter would double-count past `total`.
    if (param.index >= 0) paramSeen.add(param.index)
    if (paramTotalCount > 0) {
      sendParamProgress(paramSeen.size, paramTotalCount)
    }
  })

  // Reset param counters when a new PARAM_REQUEST_LIST is sent
  onParamRequest(() => {
    paramTotalCount = 0
    paramSeen.clear()
  })

  parser.on('commandAck', (result) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('command-ack', result)
    }
  })

  parser.on('heartbeat', () => {
    connection.updateHeartbeat()
  })

  // Wire up connection events to parser
  connection.on('data', (buffer) => {
    parser.parseBuffer(buffer)
  })

  connection.on('connected', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-status', connection.getStatus())
    }
  })

  connection.on('disconnected', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-status', connection.getStatus())
    }
  })

  connection.on('heartbeatTimeout', () => {
    parser.markStale()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-status', connection.getStatus())
    }
  })

  connection.on('heartbeatRecovered', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-status', connection.getStatus())
    }
  })

  // Single canonical broadcast for any 5-state lifecycle transition.
  connection.on('linkStateChanged', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-status', connection.getStatus())
    }
  })

  connection.on('error', (err) => {
    console.error('[Main] MAVLink connection error:', err)
    sendLogMessage('error', `MAVLink error: ${err.message}`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-status', connection.getStatus())
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.davincilabs.gcs')

  // Diagnostics: GPU/utility process deaths, main-process failures, renderer
  // error reports, and a 5s memory sampler whose trail is dumped on any crash.
  attachProcessGuards()
  registerCrashIpc()
  startMetricsSampler()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Allow map tile requests (CORS bypass for external tile servers)
  // Only add header if not already present — duplicate CORS headers cause ERR_FAILED
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders ?? {}
    const hasCorHeader =
      'access-control-allow-origin' in headers || 'Access-Control-Allow-Origin' in headers
    if (hasCorHeader) {
      callback({})
    } else {
      callback({
        responseHeaders: { ...headers, 'Access-Control-Allow-Origin': ['*'] }
      })
    }
  })

  createWindow()

  if (mainWindow) {
    // Register IPC handlers
    registerTelemetryHandlers(mainWindow)
    registerCommandHandlers()
    registerParameterHandlers(mainWindow)
    registerSerialHandlers()

    // Initialize MAVLink
    initializeMavlink()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Cleanup MAVLink connection
  const connection = getMavlinkConnection()
  connection.disconnect()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
