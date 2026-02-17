/**
 * Preload Script
 * Exposes MAVLink API to Renderer via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  TelemetryData,
  Command,
  CommandResult,
  ConnectionStatus,
  ConnectionConfig,
  HomePosition,
  ParamEntry,
  ParamProgress,
  LogEntry
} from '../renderer/src/types'

// Custom MAVLink API for renderer
const mavlinkAPI = {
  // Invoke (Renderer -> Main)
  connect: (config: ConnectionConfig): Promise<void> => ipcRenderer.invoke('mavlink:connect', config),
  disconnect: (): Promise<void> => ipcRenderer.invoke('mavlink:disconnect'),
  sendCommand: (command: Command): Promise<CommandResult> => ipcRenderer.invoke('mavlink:send-command', command),
  requestParams: (): Promise<void> => ipcRenderer.invoke('mavlink:request-params'),
  setParam: (param: ParamEntry): Promise<void> => ipcRenderer.invoke('mavlink:set-param', param),
  getConnectionStatus: (): Promise<ConnectionStatus> => ipcRenderer.invoke('mavlink:get-connection-status'),

  // Listen (Main -> Renderer)
  onTelemetryUpdate: (callback: (data: TelemetryData) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: TelemetryData) => callback(data)
    ipcRenderer.on('telemetry-update', listener)
    return () => ipcRenderer.removeListener('telemetry-update', listener)
  },

  onConnectionStatus: (callback: (status: ConnectionStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: ConnectionStatus) => callback(status)
    ipcRenderer.on('connection-status', listener)
    return () => ipcRenderer.removeListener('connection-status', listener)
  },

  onHomePosition: (callback: (home: HomePosition) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, home: HomePosition) => callback(home)
    ipcRenderer.on('home-position', listener)
    return () => ipcRenderer.removeListener('home-position', listener)
  },

  onParamValue: (callback: (param: ParamEntry) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, param: ParamEntry) => callback(param)
    ipcRenderer.on('param-value', listener)
    return () => ipcRenderer.removeListener('param-value', listener)
  },

  onParamProgress: (callback: (progress: ParamProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ParamProgress) => callback(progress)
    ipcRenderer.on('param-progress', listener)
    return () => ipcRenderer.removeListener('param-progress', listener)
  },

  onCommandAck: (callback: (result: CommandResult) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: CommandResult) => callback(result)
    ipcRenderer.on('command-ack', listener)
    return () => ipcRenderer.removeListener('command-ack', listener)
  },

  onLogMessage: (callback: (entry: LogEntry) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry) => callback(entry)
    ipcRenderer.on('log-message', listener)
    return () => ipcRenderer.removeListener('log-message', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('mavlink', mavlinkAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.mavlink = mavlinkAPI
}
