/**
 * MissionDownloader unit tests.
 *
 * The downloader pulls items from a (fake) connection using the standard
 * MAVLink mission download handshake. Tests use a stub MavlinkConnection
 * and a stub MavlinkParser EventEmitter to drive the state machine without
 * any real UDP I/O.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import {
  MissionDownloader,
  MISSION_DOWNLOAD_TIMEOUTS,
  decodeMissionItems
} from '../../../src/main/mavlink/missionDownloader'
import type { MissionItemInt } from '../../../src/main/mavlink/parser'

// ─── Stubs ────────────────────────────────────────────────────────────────────
class StubConnection {
  isConnected = true
  sent: Buffer[] = []
  sendMessage(buf: Buffer): void {
    this.sent.push(buf)
  }
}

/** Returns msgid extracted from a MAVLink v2 packet. */
function msgIdOf(buf: Buffer): number {
  return buf.readUInt8(7) | (buf.readUInt8(8) << 8) | (buf.readUInt8(9) << 16)
}

function makeItem(seq: number): MissionItemInt {
  return {
    seq,
    command: 16, // MAV_CMD_NAV_WAYPOINT
    frame: 3,
    current: seq === 0 ? 1 : 0,
    autocontinue: 1,
    param1: 0,
    param2: 5,
    param3: 0,
    param4: 0,
    lat: Math.round((37.5 + seq * 0.0001) * 1e7),
    lon: Math.round((127.0 + seq * 0.0001) * 1e7),
    alt: 50 + seq
  }
}

describe('MissionDownloader', () => {
  let conn: StubConnection
  let parser: EventEmitter

  beforeEach(() => {
    vi.useFakeTimers()
    conn = new StubConnection()
    parser = new EventEmitter()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns error when not connected', async () => {
    conn.isConnected = false
    const dl = new MissionDownloader(conn, parser as never)
    const r = await dl.download()
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/not connected/i)
  })

  it('completes a 3-item download (REQUEST_LIST → COUNT → ITEMS → ACK)', async () => {
    const dl = new MissionDownloader(conn, parser as never)
    const promise = dl.download()

    // Step 0: GCS sends MISSION_REQUEST_LIST (msgid 43)
    expect(conn.sent.length).toBe(1)
    expect(msgIdOf(conn.sent[0])).toBe(43)

    // Drone replies MISSION_COUNT(3)
    parser.emit('missionCount', 3)

    // GCS should now send MISSION_REQUEST_INT(0) (msgid 51)
    expect(conn.sent.length).toBe(2)
    expect(msgIdOf(conn.sent[1])).toBe(51)
    expect(conn.sent[1].readUInt16LE(10)).toBe(0)

    parser.emit('missionItemInt', makeItem(0))

    expect(conn.sent.length).toBe(3)
    expect(msgIdOf(conn.sent[2])).toBe(51)
    expect(conn.sent[2].readUInt16LE(10)).toBe(1)

    parser.emit('missionItemInt', makeItem(1))

    expect(msgIdOf(conn.sent[3])).toBe(51)
    expect(conn.sent[3].readUInt16LE(10)).toBe(2)

    parser.emit('missionItemInt', makeItem(2))

    // Last sent: MISSION_ACK (msgid 47), payload[2] = 0 (ACCEPTED)
    const ack = conn.sent[conn.sent.length - 1]
    expect(msgIdOf(ack)).toBe(47)
    expect(ack.readUInt8(12)).toBe(0)

    const result = await promise
    expect(result.success).toBe(true)
    expect(result.items.length).toBe(3)
    expect(result.items[0].seq).toBe(0)
    expect(result.items[2].seq).toBe(2)
  })

  it('ignores out-of-order MISSION_ITEM_INT for unexpected seq', async () => {
    const dl = new MissionDownloader(conn, parser as never)
    const promise = dl.download()
    parser.emit('missionCount', 2)

    // Drone (incorrectly) emits seq=5 first → must be ignored, no progression.
    const sentBefore = conn.sent.length
    parser.emit('missionItemInt', makeItem(5))
    expect(conn.sent.length).toBe(sentBefore)

    // Correct seq arrives.
    parser.emit('missionItemInt', makeItem(0))
    parser.emit('missionItemInt', makeItem(1))

    const result = await promise
    expect(result.success).toBe(true)
    expect(result.items.length).toBe(2)
  })

  it('retries MISSION_REQUEST_LIST on COUNT timeout up to MAX_RETRIES', async () => {
    const dl = new MissionDownloader(conn, parser as never)
    const promise = dl.download()
    expect(msgIdOf(conn.sent[0])).toBe(43)

    // Each step timeout triggers another MISSION_REQUEST_LIST.
    for (let i = 1; i <= MISSION_DOWNLOAD_TIMEOUTS.MAX_RETRIES; i++) {
      vi.advanceTimersByTime(MISSION_DOWNLOAD_TIMEOUTS.STEP_MS)
      // i-th retry should have been sent
      expect(conn.sent.length).toBe(i + 1)
      expect(msgIdOf(conn.sent[i])).toBe(43)
    }

    // One more timeout should fail the download.
    vi.advanceTimersByTime(MISSION_DOWNLOAD_TIMEOUTS.STEP_MS)
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/MISSION_COUNT/)
  })

  it('retries MISSION_REQUEST_INT when an item never arrives', async () => {
    const dl = new MissionDownloader(conn, parser as never)
    const promise = dl.download()
    parser.emit('missionCount', 1)

    // First REQUEST_INT(0) sent (sent[1])
    expect(msgIdOf(conn.sent[1])).toBe(51)
    expect(conn.sent[1].readUInt16LE(10)).toBe(0)

    // Each timeout retransmits REQUEST_INT(0)
    for (let i = 0; i < MISSION_DOWNLOAD_TIMEOUTS.MAX_RETRIES; i++) {
      vi.advanceTimersByTime(MISSION_DOWNLOAD_TIMEOUTS.STEP_MS)
    }

    // Eventually item arrives — should still complete after a retry.
    parser.emit('missionItemInt', makeItem(0))
    const result = await promise
    expect(result.success).toBe(true)
    expect(result.items.length).toBe(1)
  })

  it('reports progress events as items arrive', async () => {
    const progress = vi.fn()
    const dl = new MissionDownloader(conn, parser as never, progress)
    const promise = dl.download()
    parser.emit('missionCount', 2)
    parser.emit('missionItemInt', makeItem(0))
    parser.emit('missionItemInt', makeItem(1))
    await promise

    // Initial {seq:0, total:2}, then after item 0 → {seq:1,total:2}, after item 1 → {seq:2,total:2}.
    expect(progress).toHaveBeenCalledWith({ seq: 0, total: 2 })
    expect(progress).toHaveBeenCalledWith({ seq: 1, total: 2 })
    expect(progress).toHaveBeenCalledWith({ seq: 2, total: 2 })
  })

  it('handles MISSION_COUNT(0) by sending ACK and resolving immediately', async () => {
    const dl = new MissionDownloader(conn, parser as never)
    const promise = dl.download()
    parser.emit('missionCount', 0)

    const result = await promise
    expect(result.success).toBe(true)
    expect(result.items.length).toBe(0)

    const ack = conn.sent[conn.sent.length - 1]
    expect(msgIdOf(ack)).toBe(47)
  })

  it('rejects a second concurrent download', async () => {
    const dl = new MissionDownloader(conn, parser as never)
    const p1 = dl.download()
    const p2 = await dl.download()
    expect(p2.success).toBe(false)
    expect(p2.error).toMatch(/already running/i)

    // Cleanup so we do not leak a fake-timer-bound promise.
    parser.emit('missionCount', 0)
    await p1
  })
})

describe('decodeMissionItems', () => {
  it('converts lat/lon from 1e7-scaled int to degrees', () => {
    const decoded = decodeMissionItems([makeItem(0), makeItem(1)])
    expect(decoded.length).toBe(2)
    expect(decoded[0].lat).toBeCloseTo(37.5, 4)
    expect(decoded[0].lon).toBeCloseTo(127.0, 4)
    expect(decoded[1].lat).toBeCloseTo(37.5001, 4)
  })
})
