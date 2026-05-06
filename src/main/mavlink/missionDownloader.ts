/**
 * MAVLink Mission Download Protocol
 *
 * Implements the standard MAVLink mission download sequence so the GCS can
 * verify what the drone (or Simulink stub) currently has stored:
 *
 *   GCS   → Drone : MISSION_REQUEST_LIST          (msgid 43)
 *   Drone → GCS   : MISSION_COUNT(N)              (msgid 44)
 *   GCS   → Drone : MISSION_REQUEST_INT(seq)      (msgid 51)
 *   Drone → GCS   : MISSION_ITEM_INT(seq, ...)    (msgid 73)
 *   ... repeat for seq = 0 .. N-1 ...
 *   GCS   → Drone : MISSION_ACK(ACCEPTED)         (msgid 47)
 *
 * Reference: https://mavlink.io/en/services/mission.html
 *
 * State machine:
 *   IDLE → REQUEST_LIST → AWAIT_COUNT → REQUEST_ITEM(seq)
 *        → AWAIT_ITEM(seq) → (next seq or) ACK → IDLE
 *
 * Per-step timeout 1 s with up to 3 retries; overall timeout 30 s.
 */

import type { MavlinkConnection } from './connection'
import type { MavlinkParser, MissionItemInt } from './parser'

// ─── Message IDs ───────────────────────────────────────────────────────────────
const MSGID_MISSION_REQUEST_LIST = 43
const MSGID_MISSION_REQUEST_INT = 51
const MSGID_MISSION_ACK = 47

// ─── CRC_EXTRA table ──────────────────────────────────────────────────────────
const CRC_EXTRA: Readonly<Record<number, number>> = {
  43: 132, // MISSION_REQUEST_LIST
  51: 196, // MISSION_REQUEST_INT
  47: 153 // MISSION_ACK
}

// ─── MAV_MISSION_RESULT ────────────────────────────────────────────────────────
const MAV_MISSION_ACCEPTED = 0

// ─── MAVLink v2 packet builder (independent seq counter for download flow) ────
let _seq = 0
const GCS_SYSID = 255
const GCS_COMPID = 190 // MAV_COMP_ID_MISSIONPLANNER

function crc16Mcrf4xx(data: Buffer, crcExtra: number): number {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    let tmp = (data[i] ^ crc) & 0xff
    tmp = (tmp ^ (tmp << 4)) & 0xff
    crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff
  }
  let tmp = (crcExtra ^ crc) & 0xff
  tmp = (tmp ^ (tmp << 4)) & 0xff
  crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff
  return crc
}

function buildPacket(msgid: number, payload: Buffer): Buffer {
  const hdr = Buffer.alloc(10)
  hdr[0] = 0xfd
  hdr[1] = payload.length
  hdr[2] = 0
  hdr[3] = 0
  hdr[4] = _seq++ & 0xff
  hdr[5] = GCS_SYSID
  hdr[6] = GCS_COMPID
  hdr[7] = msgid & 0xff
  hdr[8] = (msgid >> 8) & 0xff
  hdr[9] = (msgid >> 16) & 0xff

  const crcInput = Buffer.concat([hdr.subarray(1), payload])
  const checksum = crc16Mcrf4xx(crcInput, CRC_EXTRA[msgid] ?? 0)
  const crcBuf = Buffer.alloc(2)
  crcBuf.writeUInt16LE(checksum, 0)

  return Buffer.concat([hdr, payload, crcBuf])
}

// ─── Outgoing message builders ────────────────────────────────────────────────
function buildMissionRequestList(targetSystem = 1, targetComponent = 1): Buffer {
  const payload = Buffer.alloc(3)
  payload.writeUInt8(targetSystem, 0)
  payload.writeUInt8(targetComponent, 1)
  payload.writeUInt8(0, 2) // MAV_MISSION_TYPE_MISSION
  return buildPacket(MSGID_MISSION_REQUEST_LIST, payload)
}

function buildMissionRequestInt(seq: number, targetSystem = 1, targetComponent = 1): Buffer {
  const payload = Buffer.alloc(5)
  payload.writeUInt16LE(seq, 0)
  payload.writeUInt8(targetSystem, 2)
  payload.writeUInt8(targetComponent, 3)
  payload.writeUInt8(0, 4) // MAV_MISSION_TYPE_MISSION
  return buildPacket(MSGID_MISSION_REQUEST_INT, payload)
}

function buildMissionAck(type: number, targetSystem = 1, targetComponent = 1): Buffer {
  const payload = Buffer.alloc(3)
  payload.writeUInt8(targetSystem, 0)
  payload.writeUInt8(targetComponent, 1)
  payload.writeUInt8(type, 2)
  return buildPacket(MSGID_MISSION_ACK, payload)
}

// ─── Download result ──────────────────────────────────────────────────────────
export interface MissionDownloadResult {
  success: boolean
  items: MissionItemInt[]
  error?: string
}

export interface MissionDownloadProgress {
  seq: number
  total: number
}

// ─── Subset of EventEmitter we depend on ──────────────────────────────────────
interface DownloaderConnection {
  readonly isConnected: boolean
  sendMessage(buffer: Buffer, host?: string, port?: number): void
}

interface DownloaderParser {
  on(event: 'missionCount', listener: (count: number) => void): unknown
  on(event: 'missionItemInt', listener: (item: MissionItemInt) => void): unknown
  off(event: 'missionCount', listener: (count: number) => void): unknown
  off(event: 'missionItemInt', listener: (item: MissionItemInt) => void): unknown
}

// ─── Tunables (exported for tests) ────────────────────────────────────────────
export const MISSION_DOWNLOAD_TIMEOUTS = {
  /** Per-step timeout (ms): MISSION_REQUEST_LIST→COUNT or REQUEST_INT→ITEM. */
  STEP_MS: 1000,
  /** Maximum retries per step before failing. */
  MAX_RETRIES: 3,
  /** Hard upper bound for an entire download (covers ~64 WPs comfortably). */
  OVERALL_MS: 30000
} as const

type State = 'IDLE' | 'AWAIT_COUNT' | 'AWAIT_ITEM' | 'DONE'

/**
 * MissionDownloader — one-shot state machine.
 * Re-use is not supported; create a new instance per download.
 */
export class MissionDownloader {
  private readonly conn: DownloaderConnection
  private readonly parser: DownloaderParser
  private readonly onProgress: ((p: MissionDownloadProgress) => void) | undefined

  private state: State = 'IDLE'
  private expected = 0
  private nextSeq = 0
  private retries = 0
  private items: MissionItemInt[] = []
  private targetSystem = 1
  private targetComponent = 1

  private stepTimer: NodeJS.Timeout | null = null
  private overallTimer: NodeJS.Timeout | null = null
  private resolve: ((r: MissionDownloadResult) => void) | null = null

  // Bound listeners (so we can detach the exact references)
  private readonly handleCount = (count: number): void => this.onCount(count)
  private readonly handleItem = (item: MissionItemInt): void => this.onItem(item)

  constructor(
    conn: DownloaderConnection,
    parser: DownloaderParser,
    onProgress?: (p: MissionDownloadProgress) => void
  ) {
    this.conn = conn
    this.parser = parser
    this.onProgress = onProgress
  }

  async download(targetSystem = 1, targetComponent = 1): Promise<MissionDownloadResult> {
    if (!this.conn.isConnected) {
      return { success: false, items: [], error: 'Not connected to vehicle' }
    }
    if (this.state !== 'IDLE') {
      return { success: false, items: [], error: 'Downloader already running' }
    }

    this.targetSystem = targetSystem
    this.targetComponent = targetComponent

    this.parser.on('missionCount', this.handleCount)
    this.parser.on('missionItemInt', this.handleItem)

    return new Promise<MissionDownloadResult>((resolve) => {
      this.resolve = resolve

      this.overallTimer = setTimeout(() => {
        this.finish({
          success: false,
          items: [],
          error: `Mission download timeout (${MISSION_DOWNLOAD_TIMEOUTS.OVERALL_MS / 1000}s)`
        })
      }, MISSION_DOWNLOAD_TIMEOUTS.OVERALL_MS)

      this.requestList()
    })
  }

  // ─── State transitions ──────────────────────────────────────────────────────
  private requestList(): void {
    this.state = 'AWAIT_COUNT'
    this.retries = 0
    this.sendList()
  }

  private sendList(): void {
    this.conn.sendMessage(buildMissionRequestList(this.targetSystem, this.targetComponent))
    this.armStepTimer(() => this.onListTimeout())
  }

  private onListTimeout(): void {
    if (this.state !== 'AWAIT_COUNT') return
    if (this.retries >= MISSION_DOWNLOAD_TIMEOUTS.MAX_RETRIES) {
      this.finish({
        success: false,
        items: [],
        error: 'No MISSION_COUNT received (3 retries)'
      })
      return
    }
    this.retries++
    console.log(`[MissionDL] retry MISSION_REQUEST_LIST (#${this.retries})`)
    this.sendList()
  }

  private onCount(count: number): void {
    if (this.state !== 'AWAIT_COUNT') return
    this.clearStepTimer()
    this.expected = count
    this.items = []
    this.nextSeq = 0
    this.retries = 0
    this.onProgress?.({ seq: 0, total: count })

    if (count === 0) {
      // Nothing to download; ack immediately.
      this.sendAck(MAV_MISSION_ACCEPTED)
      this.finish({ success: true, items: [] })
      return
    }
    this.requestNextItem()
  }

  private requestNextItem(): void {
    this.state = 'AWAIT_ITEM'
    this.retries = 0
    this.sendItemRequest()
  }

  private sendItemRequest(): void {
    this.conn.sendMessage(
      buildMissionRequestInt(this.nextSeq, this.targetSystem, this.targetComponent)
    )
    this.armStepTimer(() => this.onItemTimeout())
  }

  private onItemTimeout(): void {
    if (this.state !== 'AWAIT_ITEM') return
    if (this.retries >= MISSION_DOWNLOAD_TIMEOUTS.MAX_RETRIES) {
      this.finish({
        success: false,
        items: this.items,
        error: `No MISSION_ITEM_INT for seq=${this.nextSeq} (3 retries)`
      })
      return
    }
    this.retries++
    console.log(`[MissionDL] retry MISSION_REQUEST_INT seq=${this.nextSeq} (#${this.retries})`)
    this.sendItemRequest()
  }

  private onItem(item: MissionItemInt): void {
    if (this.state !== 'AWAIT_ITEM') return
    if (item.seq !== this.nextSeq) {
      // Out-of-order item; ignore and keep waiting.
      return
    }
    this.clearStepTimer()
    this.items.push(item)
    this.onProgress?.({ seq: item.seq + 1, total: this.expected })

    if (this.items.length >= this.expected) {
      this.sendAck(MAV_MISSION_ACCEPTED)
      this.finish({ success: true, items: this.items })
      return
    }
    this.nextSeq++
    this.retries = 0
    this.sendItemRequest()
  }

  private sendAck(type: number): void {
    this.conn.sendMessage(buildMissionAck(type, this.targetSystem, this.targetComponent))
  }

  // ─── Timer plumbing ─────────────────────────────────────────────────────────
  private armStepTimer(cb: () => void): void {
    this.clearStepTimer()
    this.stepTimer = setTimeout(cb, MISSION_DOWNLOAD_TIMEOUTS.STEP_MS)
  }

  private clearStepTimer(): void {
    if (this.stepTimer) {
      clearTimeout(this.stepTimer)
      this.stepTimer = null
    }
  }

  private finish(result: MissionDownloadResult): void {
    if (this.state === 'DONE') return
    this.state = 'DONE'
    this.clearStepTimer()
    if (this.overallTimer) {
      clearTimeout(this.overallTimer)
      this.overallTimer = null
    }
    this.parser.off('missionCount', this.handleCount)
    this.parser.off('missionItemInt', this.handleItem)
    const r = this.resolve
    this.resolve = null
    r?.(result)
  }
}

/**
 * Helper: convert a downloaded MISSION_ITEM_INT (with lat/lon as int32 * 1e7)
 * to the renderer-shaped Waypoint-ish object (degrees).
 *
 * Mapping back to ActionKey is intentionally minimal here — the GCS already
 * keeps the original Waypoint[] in `missionStore`, so this helper is mainly
 * intended for diagnostic / verification UIs.
 */
export interface DownloadedMissionItem {
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
}

export function decodeMissionItems(items: MissionItemInt[]): DownloadedMissionItem[] {
  return items.map((it) => ({
    seq: it.seq,
    command: it.command,
    lat: it.lat / 1e7,
    lon: it.lon / 1e7,
    alt: it.alt,
    param1: it.param1,
    param2: it.param2,
    param3: it.param3,
    param4: it.param4,
    current: it.current,
    autocontinue: it.autocontinue,
    frame: it.frame
  }))
}

// Re-export so external code (and the IPC layer) can keep importing from one place.
export type { MavlinkConnection, MavlinkParser }
