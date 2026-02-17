/**
 * Preload Type Definitions
 * Declares window.mavlink API for TypeScript
 */

import { ElectronAPI } from '@electron-toolkit/preload'
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

declare global {
  interface Window {
    electron: ElectronAPI
    mavlink: {
      // Invoke (Renderer -> Main, returns Promise)
      connect(config: ConnectionConfig): Promise<void>
      reconnect(config: { host: string; port: number }): Promise<{ success: boolean; error?: string }>
      disconnect(): Promise<void>
      sendCommand(command: Command): Promise<CommandResult>
      requestParams(): Promise<void>
      setParam(param: ParamEntry): Promise<void>
      getConnectionStatus(): Promise<ConnectionStatus>

      // Listen (Main -> Renderer, callback)
      // Each returns cleanup function
      onTelemetryUpdate(callback: (data: TelemetryData) => void): () => void
      onConnectionStatus(callback: (status: ConnectionStatus) => void): () => void
      onHomePosition(callback: (home: HomePosition) => void): () => void
      onParamValue(callback: (param: ParamEntry) => void): () => void
      onParamProgress(callback: (progress: ParamProgress) => void): () => void
      onCommandAck(callback: (result: CommandResult) => void): () => void
      onLogMessage(callback: (entry: LogEntry) => void): () => void
    }
  }
}
