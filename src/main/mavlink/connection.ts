/**
 * MAVLink UDP Socket Connection Manager
 * Handles UDP communication with Simulink or real drones
 */

import dgram from 'dgram'
import { SerialPort } from 'serialport'
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

const HEARTBEAT_TIMEOUT_MS = 10000

export class MavlinkConnection extends EventEmitter {
  private socket: dgram.Socket | null = null
  /** Serial transport (텔레메트리 라디오 COM 포트). UDP 와 배타적으로 사용. */
  private serial: SerialPort | null = null
  /** 현재 활성 트랜스포트. sendMessage/disconnect 분기에 사용. */
  private transport: 'udp' | 'serial' = 'udp'
  private config: ConnectionConfig | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  /** [2026-08-18] GCS→기체 1 Hz HEARTBEAT 송신 타이머.
   *  이 GCS 는 지금까지 HEARTBEAT 을 **받기만** 하고 보내지 않았다. 보드 FailsafeMgr 의
   *  링크 페일세이프 조건이 (rc_link==0 && gcs_link==0) 인데, RC 수신기 없이 비행하면
   *  gcs_link 를 세울 근거가 GCS 하트비트뿐이라 아밍 1 s 뒤 Emergency 로 떨어졌다
   *  (보드 flight_log_5/6 실측). MAVLink 표준 GCS 는 원래 1 Hz 로 송신한다. */
  private gcsHbTxTimer: NodeJS.Timeout | null = null
  private gcsHbSeq: number = 0
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
    this.transport = 'udp'
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
        this.startGcsHeartbeatTx()
        this.setLinkState('WAITING_HEARTBEAT')
        this.emit('connected')
        resolve()
      })

      // Handle incoming MAVLink messages
      this.socket.on('message', (msg) => {
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
        this.stopGcsHeartbeatTx() // [세션A §315-3] close 경로 타이머 누수 수정
        // Only transition to DISCONNECTED if we did not already enter ERROR.
        if (this._linkState !== 'ERROR') {
          this.setLinkState('DISCONNECTED')
        }
        this.emit('disconnected')
      })
    })
  }

  /**
   * Connect over a serial transport (텔레메트리 라디오 COM 포트).
   * MAVLink 바이트 스트림을 그대로 'data' 이벤트로 흘려 parser 가 소비한다(UDP 와 동일).
   */
  async connectSerial(path: string, baud: number): Promise<void> {
    if (this._isConnected) {
      throw new Error('Already connected. Call disconnect() first.')
    }

    this._lastError = undefined
    this.transport = 'serial'
    // 상태 표시용 최소 config (host=포트경로, port=baud 로 재활용)
    this.config = {
      mode: 'real-drone',
      host: path,
      port: baud,
      remotePort: baud,
      sysid: 1,
      compid: 1
    }

    return new Promise((resolve, reject) => {
      const sp = new SerialPort({ path, baudRate: baud, autoOpen: false })
      this.serial = sp

      sp.open((err) => {
        if (err) {
          console.error('[MAVLink] Serial open failed:', err.message)
          this._lastError = err.message
          this._isConnected = false
          this.stopHeartbeatMonitor()
          this.setLinkState('ERROR')
          this.serial = null
          this.emit('error', err)
          reject(err)
          return
        }
        console.log(`[MAVLink] Serial open ${path} @ ${baud} (real-drone telemetry)`)
        this._isConnected = true
        this._heartbeatActive = false
        this.lastHeartbeat = 0
        this.startHeartbeatMonitor()
        this.startGcsHeartbeatTx()
        this.setLinkState('WAITING_HEARTBEAT')
        this.emit('connected')
        resolve()
      })

      // 시리얼 바이트 청크 → parser 로 (스트리밍, 프레임 경계 무관)
      sp.on('data', (chunk: Buffer) => {
        this.emit('data', chunk)
      })

      sp.on('error', (err: Error) => {
        console.error('[MAVLink] Serial error:', err.message)
        this._lastError = err.message
        this.emit('error', err)
      })

      sp.on('close', () => {
        console.log('[MAVLink] Serial closed')
        this._isConnected = false
        this._heartbeatActive = false
        this.stopHeartbeatMonitor()
        this.stopGcsHeartbeatTx() // [세션A §315-3] close 경로 타이머 누수 수정
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
      remotePort: prevConfig?.remotePort ?? 14561,
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
    if (this.serial) {
      try {
        if (this.serial.isOpen) this.serial.close()
      } catch (e) {
        console.error('[MAVLink] Serial close error:', e)
      }
      this.serial = null
    }
    this.transport = 'udp'
    this.stopHeartbeatMonitor()
    this.stopGcsHeartbeatTx()
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
    // 시리얼 트랜스포트: 라디오 COM 포트로 그대로 write
    if (this.transport === 'serial') {
      if (!this.serial || !this.serial.isOpen) {
        console.warn('[MAVLink] Cannot send: serial not open')
        return
      }
      this.serial.write(buffer, (err) => {
        if (err) {
          console.error('[MAVLink] Serial send error:', err.message)
          this.emit('error', err)
        }
      })
      return
    }

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
          console.warn(`[MAVLink] Heartbeat timeout (>${HEARTBEAT_TIMEOUT_MS}ms)`)
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

  /** [2026-08-18] GCS HEARTBEAT(msgid 0) 1 Hz 송신 시작. 보드가 gcs_link 판정에 사용. */
  private startGcsHeartbeatTx(): void {
    this.stopGcsHeartbeatTx()
    this.gcsHbTxTimer = setInterval(() => {
      if (!this._isConnected) return
      try {
        this.sendMessage(this.buildGcsHeartbeat())
      } catch (e) {
        console.error('[MAVLink] GCS heartbeat send error:', e)
      }
    }, 1000)
  }

  private stopGcsHeartbeatTx(): void {
    if (this.gcsHbTxTimer) {
      clearInterval(this.gcsHbTxTimer)
      this.gcsHbTxTimer = null
    }
  }

  /** MAVLink v2 HEARTBEAT 인코딩. 와이어 순서는 크기 내림차순:
   *  custom_mode(u32) · type(u8) · autopilot(u8) · base_mode(u8) · system_status(u8) · version(u8).
   *  CRC_EXTRA = 50 (CLAUDE.md Pitfalls 표와 일치). sysid 255 / compid 190 (GCS 식별자 규칙). */
  private buildGcsHeartbeat(): Buffer {
    const PAYLOAD_LEN = 9
    const buf = Buffer.alloc(10 + PAYLOAD_LEN + 2)
    buf.writeUInt8(0xfd, 0) // Magic byte v2
    buf.writeUInt8(PAYLOAD_LEN, 1)
    buf.writeUInt8(0, 2) // Incompat flags
    buf.writeUInt8(0, 3) // Compat flags
    buf.writeUInt8(this.gcsHbSeq & 0xff, 4)
    this.gcsHbSeq = (this.gcsHbSeq + 1) & 0xff
    buf.writeUInt8(255, 5) // sysid: GCS
    buf.writeUInt8(190, 6) // compid: MAV_COMP_ID_MISSIONPLANNER
    buf.writeUInt8(0, 7) // msgid 0 (HEARTBEAT)
    buf.writeUInt8(0, 8)
    buf.writeUInt8(0, 9)
    buf.writeUInt32LE(0, 10) // custom_mode
    buf.writeUInt8(6, 14) // type: MAV_TYPE_GCS
    buf.writeUInt8(8, 15) // autopilot: MAV_AUTOPILOT_INVALID
    buf.writeUInt8(0, 16) // base_mode
    buf.writeUInt8(4, 17) // system_status: MAV_STATE_ACTIVE
    buf.writeUInt8(3, 18) // mavlink_version
    // CRC-16/MCRF4XX over [len..payload] + CRC_EXTRA(50)
    let crc = 0xffff
    const upd = (b: number): void => {
      const tmp = b ^ (crc & 0xff)
      const tmpShifted = (tmp ^ (tmp << 4)) & 0xff
      crc = ((crc >> 8) ^ (tmpShifted << 8) ^ (tmpShifted << 3) ^ (tmpShifted >> 4)) & 0xffff
    }
    for (let i = 1; i < 10 + PAYLOAD_LEN; i++) upd(buf[i])
    upd(50)
    buf.writeUInt16LE(crc, 10 + PAYLOAD_LEN)
    return buf
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
