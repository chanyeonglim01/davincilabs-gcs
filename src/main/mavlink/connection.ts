/**
 * MAVLink UDP Socket Connection Manager
 * Handles UDP communication with Simulink or real drones
 */

import dgram from 'dgram'
import { EventEmitter } from 'events'
import type { ConnectionConfig, ConnectionStatus, LinkState } from '../../renderer/src/types'

export interface MavlinkConnectionEvents {
  data: (buffer: Buffer) => void
  connected: () => void
  disconnected: () => void
  error: (error: Error) => void
  heartbeatTimeout: () => void
  heartbeatRecovered: () => void
  /** Fires whenever the derived 5-state link lifecycle transitions. */
  linkStateChanged: (state: LinkState) => void
}

export declare interface MavlinkConnection {
  on<U extends keyof MavlinkConnectionEvents>(event: U, listener: MavlinkConnectionEvents[U]): this
  emit<U extends keyof MavlinkConnectionEvents>(
    event: U,
    ...args: Parameters<MavlinkConnectionEvents[U]>
  ): boolean
}

const HEARTBEAT_TIMEOUT_MS = 3000

export class MavlinkConnection extends EventEmitter {
  private socket: dgram.Socket | null = null
  private config: ConnectionConfig | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private lastHeartbeat: number = 0
  private _isConnected: boolean = false
  private _heartbeatActive: boolean = false
  private _linkState: LinkState = 'DISCONNECTED'
  private _lastError: string | undefined

  constructor() {
    super()
  }

  /**
   * Connect to MAVLink endpoint
   */
  async connect(config: ConnectionConfig): Promise<void> {
    if (this._isConnected) {
      throw new Error('Already connected. Call disconnect() first.')
    }

    this.config = config
    this._lastError = undefined
    this.socket = dgram.createSocket('udp4')

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket creation failed'))
        return
      }

      let bindResolved = false

      // Bind to local port
      this.socket.bind(config.port, () => {
        console.log(
          `[MAVLink] Listening on UDP ${config.host}:${config.port} (${config.mode} mode)`
        )
        bindResolved = true
        this._isConnected = true
        this._heartbeatActive = false
        this.lastHeartbeat = 0
        this.startHeartbeatMonitor()
        this.setLinkState('WAITING_HEARTBEAT')
        this.emit('connected')
        resolve()
      })

      // Handle incoming MAVLink messages
      this.socket.on('message', (msg) => {
        // console.log(`[MAVLink] Received ${msg.length} bytes`)
        this.emit('data', msg)
      })

      // Error handling
      this.socket.on('error', (err) => {
        console.error('[MAVLink] Socket error:', err.message)
        this._lastError = err.message
        // If bind failed before resolution, transition into ERROR state.
        if (!bindResolved) {
          this._isConnected = false
          this.stopHeartbeatMonitor()
          this.setLinkState('ERROR')
        }
        this.emit('error', err)
        if (!bindResolved) {
          reject(err)
        }
      })

      // Socket closed
      this.socket.on('close', () => {
        console.log('[MAVLink] Socket closed')
        this._isConnected = false
        this._heartbeatActive = false
        this.stopHeartbeatMonitor()
        // Only transition to DISCONNECTED if we did not already enter ERROR.
        if (this._linkState !== 'ERROR') {
          this.setLinkState('DISCONNECTED')
        }
        this.emit('disconnected')
      })
    })
  }

  /**
   * Reconnect to a new host:port, preserving other config fields
   */
  async reconnect(host: string, port: number): Promise<void> {
    // Snapshot config before disconnect clears it
    const prevConfig = this.config

    if (this._isConnected) {
      this.disconnect()
      // Give socket time to fully close
      await new Promise<void>((resolve) => setTimeout(resolve, 200))
    }

    const config: ConnectionConfig = {
      mode: prevConfig?.mode ?? 'simulink',
      host,
      port,
      sysid: prevConfig?.sysid ?? 1,
      compid: prevConfig?.compid ?? 1
    }

    await this.connect(config)
  }

  /**
   * Disconnect from MAVLink endpoint
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.stopHeartbeatMonitor()
    this._isConnected = false
    this._heartbeatActive = false
    this.config = null
    this.lastHeartbeat = 0
    this._lastError = undefined
    this.setLinkState('DISCONNECTED')
  }

  /**
   * Send MAVLink message buffer to remote endpoint
   */
  sendMessage(buffer: Buffer, remoteHost?: string, remotePort?: number): void {
    if (!this.socket || !this.config) {
      console.warn('[MAVLink] Cannot send: not connected')
      return
    }

    const host = remoteHost || this.config.host
    const port = remotePort || this.config.remotePort || this.config.port

    this.socket.send(buffer, port, host, (err) => {
      if (err) {
        console.error('[MAVLink] Send error:', err.message)
        this.emit('error', err)
      }
    })
  }

  /**
   * Update last heartbeat timestamp.
   * Called by parser when HEARTBEAT message received.
   * Drives transitions WAITING_HEARTBEAT/STALE -> LINKED.
   */
  updateHeartbeat(): void {
    this.lastHeartbeat = Date.now()
    if (!this._heartbeatActive) {
      this._heartbeatActive = true
      this.emit('heartbeatRecovered')
    }
    if (this._isConnected && this._linkState !== 'LINKED') {
      this.setLinkState('LINKED')
    }
  }

  /**
   * Get current connection status (snapshot for IPC broadcast).
   */
  getStatus(): ConnectionStatus {
    return {
      connected: this._isConnected,
      linkState: this._linkState,
      mode: this.config?.mode || 'simulink',
      host: this.config?.host || '',
      port: this.config?.port || 0,
      lastHeartbeat: this.lastHeartbeat,
      error: this._linkState === 'ERROR' ? this._lastError : undefined
    }
  }

  /**
   * Check if the underlying transport is open.
   */
  get isConnected(): boolean {
    return this._isConnected
  }

  /**
   * Current 5-state link lifecycle.
   */
  get linkState(): LinkState {
    return this._linkState
  }

  /**
   * Update the derived link state and emit a change event when it transitions.
   */
  private setLinkState(next: LinkState): void {
    if (this._linkState === next) return
    this._linkState = next
    this.emit('linkStateChanged', next)
  }

  /**
   * Start monitoring heartbeat timeout (3s threshold)
   */
  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor()
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now()
      if (this.lastHeartbeat > 0 && now - this.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
        if (this._heartbeatActive) {
          console.warn('[MAVLink] Heartbeat timeout (>3s)')
          this._heartbeatActive = false
          this.setLinkState('STALE')
          this.emit('heartbeatTimeout')
        }
      }
    }, 1000)
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

// Singleton instance
let connection: MavlinkConnection | null = null

export function getMavlinkConnection(): MavlinkConnection {
  if (!connection) {
    connection = new MavlinkConnection()
  }
  return connection
}
