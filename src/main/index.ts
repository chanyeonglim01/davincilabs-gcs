/**
 * Electron Main Process
 * Entry point for DavinciLabs GCS
 */

import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

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
import { registerParameterHandlers, sendParamValue, sendParamProgress } from './ipc/parameters'

// Store
import { getConnectionConfig, getWindowBounds, setWindowBounds } from './store'

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
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

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
  let paramReceivedCount = 0

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
    paramReceivedCount++
    if (paramTotalCount > 0) {
      sendParamProgress(paramReceivedCount, paramTotalCount)
    }
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-status', connection.getStatus())
    }
  })

  connection.on('error', (err) => {
    console.error('[Main] MAVLink connection error:', err)
    sendLogMessage('error', `MAVLink error: ${err.message}`)
  })

  // Auto-connect in Simulink mode
  const config = getConnectionConfig()
  if (config.mode === 'simulink') {
    setTimeout(() => {
      connection.connect(config).catch((err) => {
        console.error('[Main] Auto-connect failed:', err)
      })
    }, 1000) // Wait 1s for window to load
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.davincilabs.gcs')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Allow map tile requests (CORS bypass for external tile servers)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*']
      }
    })
  })

  createWindow()

  if (mainWindow) {
    // Register IPC handlers
    registerTelemetryHandlers(mainWindow)
    registerCommandHandlers()
    registerParameterHandlers(mainWindow)

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
