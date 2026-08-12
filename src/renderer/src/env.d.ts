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
  HomePosition,
  SerialPortInfo,
  MotorTestPayload,
  MotorTestResult,
  CtrlSurfTestPayload,
  CtrlSurfTestResult,
  RendererErrorReport
} from './types'

declare global {
  interface Window {
    mavlink?: {
      // Invoke (Renderer -> Main, returns Promise)
      connect(config: ConnectionConfig): Promise<void>
      reconnect(config: {
        host: string
        port: number
      }): Promise<{ success: boolean; error?: string }>
      connectSerial(path: string, baud: number): Promise<{ success: boolean; error?: string }>
      disconnect(): Promise<void>
      sendCommand(command: Command): Promise<CommandResult>
      motorTest(payload: MotorTestPayload): Promise<MotorTestResult>
      ctrlSurfTest(payload: CtrlSurfTestPayload): Promise<CtrlSurfTestResult>
      requestParams(): Promise<void>
      setParam(param: ParamEntry): Promise<void>
      readParam(index: number): Promise<void>
      getConnectionStatus(): Promise<ConnectionStatus>
      uploadMission(
        waypoints: {
          action: string
          lat: number
          lon: number
          alt: number
          acceptRadius: number
          loiterRadius: number
        }[]
      ): Promise<{ success: boolean; count: number; error?: string }>
      downloadMission(): Promise<{
        success: boolean
        items: {
          seq: number
          command: number
          lat: number
          lon: number
          alt: number
          param1: number
          param2: number
          param3: number
          param4: number
          current: number
          autocontinue: number
          frame: number
        }[]
        error?: string
      }>
      listSerialPorts(): Promise<SerialPortInfo[]>

      // Diagnostics (Renderer -> Main, fire-and-forget)
      reportRendererError(report: RendererErrorReport): void

      // Listen (Main -> Renderer, callback)
      onTelemetryUpdate(callback: (data: TelemetryData) => void): () => void
      onConnectionStatus(callback: (status: ConnectionStatus) => void): () => void
      onHomePosition(callback: (home: HomePosition) => void): () => void
      onParamValue(callback: (param: ParamEntry) => void): () => void
      onParamProgress(callback: (progress: ParamProgress) => void): () => void
      onCommandAck(callback: (result: CommandResult) => void): () => void
      onLogMessage(callback: (entry: LogEntry) => void): () => void
      onMissionDownloadProgress(
        callback: (progress: { seq: number; total: number }) => void
      ): () => void
    }
  }
}
