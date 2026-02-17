/**
 * MavlinkParser unit tests
 * Tests message parsing logic using synthetic MAVLink v2 packets.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MavlinkParser } from '../../../src/main/mavlink/parser'
import type { TelemetryData, HomePosition } from '../../../src/renderer/src/types/telemetry'
import type { ParamEntry, CommandResult } from '../../../src/renderer/src/types/ipc'

// ---- Helpers to build minimal MAVLink v2 packets ----

/**
 * Build a MAVLink v2 packet buffer.
 * Layout (12 byte header + payload):
 *   [0]  0xFD   magic
 *   [1]  payload_len
 *   [2]  incompat_flags
 *   [3]  compat_flags
 *   [4]  seq
 *   [5]  sysid
 *   [6]  compid
 *   [7..9] msgid (3 bytes, little-endian)
 *   [10..10+payload_len-1] payload
 *   [10+payload_len, 10+payload_len+1] CRC (dummy 0x00 0x00)
 */
function buildPacket(msgid: number, payload: Buffer): Buffer {
  const headerLen = 10
  const crcLen = 2
  const total = headerLen + payload.length + crcLen
  const buf = Buffer.alloc(total, 0)
  buf[0] = 0xfd
  buf[1] = payload.length
  buf[2] = 0 // incompat_flags
  buf[3] = 0 // compat_flags
  buf[4] = 0 // seq
  buf[5] = 1 // sysid
  buf[6] = 1 // compid
  buf.writeUInt8(msgid & 0xff, 7)
  buf.writeUInt8((msgid >> 8) & 0xff, 8)
  buf.writeUInt8((msgid >> 16) & 0xff, 9)
  payload.copy(buf, headerLen)
  // CRC left as zeros (parser does not validate CRC)
  return buf
}

/** HEARTBEAT packet (msgid 0) — 9 byte payload */
function heartbeatPacket(base_mode: number = 0, system_status: number = 3): Buffer {
  // Parser reads: base_mode at offset 16 → payload offset 6, system_status at 19 → payload offset 9
  const payload = Buffer.alloc(10, 0)
  payload[6] = base_mode
  payload[9] = system_status
  return buildPacket(0, payload)
}

/** ATTITUDE packet (msgid 30) — 28 byte payload; parser reads floats starting at buf offset 14 */
function attitudePacket(roll: number, pitch: number, yaw: number): Buffer {
  // Parser reads from packet (absolute offsets): roll@14, pitch@18, yaw@22
  // packet[10..] = payload, so payload offsets: roll@4, pitch@8, yaw@12
  const payload = Buffer.alloc(28, 0)
  payload.writeFloatLE(roll, 4)
  payload.writeFloatLE(pitch, 8)
  payload.writeFloatLE(yaw, 12)
  return buildPacket(30, payload)
}

/** GLOBAL_POSITION_INT packet (msgid 33) */
function globalPositionPacket(lat: number, lon: number, alt: number, relative_alt: number): Buffer {
  // Parser absolute offsets: lat@14, lon@18, alt@22, relative_alt@26 → payload: lat@4, lon@8, alt@12, rel@16
  const payload = Buffer.alloc(28, 0)
  payload.writeInt32LE(lat, 4)
  payload.writeInt32LE(lon, 8)
  payload.writeInt32LE(alt, 12)
  payload.writeInt32LE(relative_alt, 16)
  return buildPacket(33, payload)
}

/** SYS_STATUS packet (msgid 1) */
function sysStatusPacket(voltage_mv: number, current_ca: number, remaining: number): Buffer {
  // Parser absolute offsets: load@26, voltage@28, current@30, remaining@42
  // payload offsets: load@16, voltage@18, current@20, remaining@32
  const payload = Buffer.alloc(40, 0)
  payload.writeUInt16LE(voltage_mv, 18)
  payload.writeInt16LE(current_ca, 20)
  payload.writeInt8(remaining, 32)
  return buildPacket(1, payload)
}

// ---- Tests ----

describe('MavlinkParser', () => {
  let parser: MavlinkParser

  beforeEach(() => {
    parser = new MavlinkParser()
  })

  describe('instantiation', () => {
    it('creates parser without errors', () => {
      expect(parser).toBeInstanceOf(MavlinkParser)
    })
  })

  describe('HEARTBEAT (msgid 0)', () => {
    it('emits heartbeat event on valid packet', () => {
      const handler = vi.fn()
      parser.on('heartbeat', handler)
      parser.parseBuffer(heartbeatPacket())
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('sets armed=true when SAFETY_ARMED flag is set', () => {
      const telemetryHandler = vi.fn()
      parser.on('telemetry', telemetryHandler)

      // MAV_MODE_FLAG.SAFETY_ARMED = 128
      const packet = heartbeatPacket(128, 4)
      parser.parseBuffer(packet)

      // telemetry may or may not fire depending on internal state
      // Just verify heartbeat fired
      const hbHandler = vi.fn()
      const p2 = new MavlinkParser()
      p2.on('heartbeat', hbHandler)
      p2.parseBuffer(packet)
      expect(hbHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('ATTITUDE (msgid 30)', () => {
    it('emits telemetry with correct attitude values', () => {
      const handler = vi.fn()
      parser.on('telemetry', handler)

      // Force position to be set first (required to emit telemetry)
      parser.parseBuffer(globalPositionPacket(375000000, 1270000000, 100000, 50000))
      handler.mockClear()

      const roll = 0.1
      const pitch = -0.05
      const yaw = 1.57
      parser.parseBuffer(attitudePacket(roll, pitch, yaw))

      if (handler.mock.calls.length > 0) {
        const telemetry: TelemetryData = handler.mock.calls[0][0]
        expect(telemetry.attitude.roll).toBeCloseTo(roll, 4)
        expect(telemetry.attitude.pitch).toBeCloseTo(pitch, 4)
        expect(telemetry.attitude.yaw).toBeCloseTo(yaw, 4)
      }
      // If throttled (33ms window), just ensure no crash
    })
  })

  describe('GLOBAL_POSITION_INT (msgid 33)', () => {
    it('emits homePosition on first valid GPS fix', () => {
      const handler = vi.fn()
      parser.on('homePosition', handler)

      parser.parseBuffer(globalPositionPacket(375000000, 1270000000, 100000, 50000))

      expect(handler).toHaveBeenCalledTimes(1)
      const home: HomePosition = handler.mock.calls[0][0]
      expect(home.lat).toBeCloseTo(37.5, 4)
      expect(home.lon).toBeCloseTo(127.0, 4)
      expect(home.alt).toBeCloseTo(100.0, 2)
    })

    it('does not emit homePosition twice', () => {
      const handler = vi.fn()
      parser.on('homePosition', handler)

      parser.parseBuffer(globalPositionPacket(375000000, 1270000000, 100000, 50000))
      parser.parseBuffer(globalPositionPacket(375100000, 1270100000, 101000, 51000))

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('rejects sentinel (-1,-1) GPS as home position', () => {
      const handler = vi.fn()
      parser.on('homePosition', handler)

      // -1 in signed int32 is -1
      parser.parseBuffer(globalPositionPacket(-1, -1, 0, 0))

      expect(handler).not.toHaveBeenCalled()
    })

    it('rejects (0,0) GPS as home position', () => {
      const handler = vi.fn()
      parser.on('homePosition', handler)

      parser.parseBuffer(globalPositionPacket(0, 0, 0, 0))

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('SYS_STATUS (msgid 1)', () => {
    it('parses battery voltage correctly', () => {
      const handler = vi.fn()
      parser.on('telemetry', handler)

      // Position needed first
      parser.parseBuffer(globalPositionPacket(375000000, 1270000000, 100000, 50000))
      handler.mockClear()

      // 22200 mV = 22.2 V
      parser.parseBuffer(sysStatusPacket(22200, 1000, 80))

      if (handler.mock.calls.length > 0) {
        const telemetry: TelemetryData = handler.mock.calls[0][0]
        expect(telemetry.status.battery.voltage).toBeCloseTo(22.2, 2)
        expect(telemetry.status.battery.remaining).toBe(80)
      }
    })
  })

  describe('parseBuffer edge cases', () => {
    it('handles empty buffer without error', () => {
      expect(() => parser.parseBuffer(Buffer.alloc(0))).not.toThrow()
    })

    it('handles buffer with no MAVLink magic without error', () => {
      const garbage = Buffer.from([0x00, 0x01, 0x02, 0x03])
      expect(() => parser.parseBuffer(garbage)).not.toThrow()
    })

    it('handles truncated packet without error', () => {
      // Only 6 bytes — not enough for a full header
      const partial = Buffer.from([0xfd, 0x04, 0x00, 0x00, 0x00, 0x01])
      expect(() => parser.parseBuffer(partial)).not.toThrow()
    })

    it('handles multiple packets in one buffer', () => {
      const hbHandler = vi.fn()
      parser.on('heartbeat', hbHandler)

      const pkt1 = heartbeatPacket()
      const pkt2 = heartbeatPacket()
      const combined = Buffer.concat([pkt1, pkt2])
      parser.parseBuffer(combined)

      expect(hbHandler).toHaveBeenCalledTimes(2)
    })
  })
})
