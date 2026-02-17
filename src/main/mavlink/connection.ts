/**
 * MAVLink UDP Socket Connection Manager
 * Handles UDP communication with Simulink or real drones
 */

import dgram from 'dgram'
import { EventEmitter } from 'events'
import type { ConnectionConfig, ConnectionStatus } from '../../renderer/src/types'

export interface MavlinkConnectionEvents {
  data: (buffer: Buffer) => void
  connected: () => void
  disconnected: () => void
  error: (error: Error) => void
  heartbeatTimeout: () => void
}

export declare interface MavlinkConnection {
  on<U extends keyof MavlinkConnectionEvents>(
    event: U,
    listener: MavlinkConnectionEvents[U]
  ): this
  emit<U extends keyof MavlinkConnectionEvents>(
    event: U,
    ...args: Parameters<MavlinkConnectionEvents[U]>
  ): boolean
}

export class MavlinkConnection extends EventEmitter {
  private socket: dgram.Socket | null = null
  private config: ConnectionConfig | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private lastHeartbeat: number = 0
  private _isConnected: boolean = false

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
    this.socket = dgram.createSocket('udp4')

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket creation failed'))
        return
      }

      // Bind to local port
      this.socket.bind(config.port, () => {
        console.log(
          `[MAVLink] Listening on UDP ${config.host}:${config.port} (${config.mode} mode)`
        )
        this._isConnected = true
        this.startHeartbeatMonitor()
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
        this.emit('error', err)
        reject(err)
      })

      // Socket closed
      this.socket.on('close', () => {
        console.log('[MAVLink] Socket closed')
        this._isConnected = false
        this.stopHeartbeatMonitor()
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
    this.config = null
    this.lastHeartbeat = 0
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
   * Update last heartbeat timestamp
   * Called by parser when HEARTBEAT message received
   */
  updateHeartbeat(): void {
    this.lastHeartbeat = Date.now()
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return {
      connected: this._isConnected,
      mode: this.config?.mode || 'simulink',
      host: this.config?.host || '',
      port: this.config?.port || 0,
      lastHeartbeat: this.lastHeartbeat
    }
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this._isConnected
  }

  /**
   * Start monitoring heartbeat timeout (3s threshold)
   */
  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor()
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now()
      if (this.lastHeartbeat > 0 && now - this.lastHeartbeat > 3000) {
        console.warn('[MAVLink] Heartbeat timeout (>3s)')
        this.emit('heartbeatTimeout')
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
