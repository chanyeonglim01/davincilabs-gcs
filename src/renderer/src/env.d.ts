/// <reference types="vite/client" />

import type {
  TelemetryData,
  ConnectionStatus,
  ConnectionConfig,
  Command,
  CommandResult,
  ParamEntry,
  ParamProgress,
  LogEntry,
  HomePosition
} from './types'

declare global {
  interface Window {
    mavlink?: {
      // Invoke (Renderer -> Main, returns Promise)
      connect(config: ConnectionConfig): Promise<void>
      reconnect(config: { host: string; port: number }): Promise<{ success: boolean; error?: string }>
      disconnect(): Promise<void>
      sendCommand(command: Command): Promise<CommandResult>
      requestParams(): Promise<void>
      setParam(param: ParamEntry): Promise<void>
      getConnectionStatus(): Promise<ConnectionStatus>
      uploadMission(waypoints: { action: string; lat: number; lon: number; alt: number; acceptRadius: number; loiterRadius: number }[]): Promise<{ success: boolean; count: number; error?: string }>

      // Listen (Main -> Renderer, callback)
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
