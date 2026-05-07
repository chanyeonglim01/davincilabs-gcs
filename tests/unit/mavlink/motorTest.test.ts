/**
 * MOTOR_TEST encoder unit tests
 *
 * Validates that commandToBuffer(MOTOR_TEST) produces a well-formed MAVLink
 * v2 COMMAND_LONG packet with MAV_CMD_DO_MOTOR_TEST (cmd 209) and the right
 * param ordering as documented in commander.ts.
 *
 * COMMAND_LONG payload (30 bytes) layout in v2:
 *   offset 10..13   param1 (float LE)
 *   offset 14..17   param2 (float LE)
 *   offset 18..21   param3 (float LE)
 *   offset 22..25   param4 (float LE)
 *   offset 26..29   param5 (float LE)
 *   offset 30..33   param6 (float LE)
 *   offset 34..37   param7 (float LE)
 *   offset 38..39   command (uint16 LE)
 *   offset 40       target_system
 *   offset 41       target_component
 *   offset 42       confirmation
 */
import { describe, it, expect } from 'vitest'
import { commandToBuffer, getCommandDescription } from '../../../src/main/mavlink/commander'
import type { Command } from '../../../src/renderer/src/types'

const MAV_CMD_DO_MOTOR_TEST = 209

interface DecodedCommandLong {
  magic: number
  payloadLen: number
  msgid: number
  command: number
  param1: number
  param2: number
  param3: number
  param4: number
  param5: number
  param6: number
  param7: number
}

function decode(buf: Buffer): DecodedCommandLong {
  return {
    magic: buf.readUInt8(0),
    payloadLen: buf.readUInt8(1),
    msgid: buf.readUInt8(7) | (buf.readUInt8(8) << 8) | (buf.readUInt8(9) << 16),
    param1: buf.readFloatLE(10),
    param2: buf.readFloatLE(14),
    param3: buf.readFloatLE(18),
    param4: buf.readFloatLE(22),
    param5: buf.readFloatLE(26),
    param6: buf.readFloatLE(30),
    param7: buf.readFloatLE(34),
    command: buf.readUInt16LE(38)
  }
}

describe('commander · MOTOR_TEST', () => {
  it('encodes M1 @ 30% for 2s with default percent throttle type', () => {
    const cmd: Command = {
      type: 'MOTOR_TEST',
      params: { motor: 1, throttle: 30, duration: 2 }
    }
    const buf = commandToBuffer(cmd)
    expect(buf.length).toBe(45) // 10 header + 33 payload + 2 CRC
    const d = decode(buf)
    expect(d.magic).toBe(0xfd)
    expect(d.payloadLen).toBe(33)
    expect(d.msgid).toBe(76) // COMMAND_LONG
    expect(d.command).toBe(MAV_CMD_DO_MOTOR_TEST)
    expect(d.param1).toBe(1) // motor instance (1-based)
    expect(d.param2).toBe(0) // throttle type 0 = percent
    expect(d.param3).toBe(30) // throttle value
    expect(d.param4).toBe(2) // duration seconds
    expect(d.param5).toBe(0) // motor count irrelevant for single motor
    expect(d.param6).toBe(0) // test order
    expect(d.param7).toBe(0) // reserved
  })

  it('encodes ALL @ 50% for 1s with default 6-motor sequential count', () => {
    const cmd: Command = {
      type: 'MOTOR_TEST',
      params: { motor: 0, throttle: 50, duration: 1 }
    }
    const buf = commandToBuffer(cmd)
    const d = decode(buf)
    expect(d.command).toBe(MAV_CMD_DO_MOTOR_TEST)
    expect(d.param1).toBe(0) // motor 0 = ALL/sequential
    expect(d.param2).toBe(0) // percent
    expect(d.param3).toBe(50) // throttle
    expect(d.param4).toBe(1) // duration
    expect(d.param5).toBe(6) // sequential motor count default
  })

  it('encodes STOP via M0 @ 0% / 0s and respects PWM throttle type override', () => {
    // STOP semantics: motor=0, throttle=0, duration=0 → board side will halt all spinning motors.
    const stop: Command = {
      type: 'MOTOR_TEST',
      params: { motor: 0, throttle: 0, duration: 0, throttleType: 'pwm' }
    }
    const buf = commandToBuffer(stop)
    const d = decode(buf)
    expect(d.command).toBe(MAV_CMD_DO_MOTOR_TEST)
    expect(d.param1).toBe(0)
    expect(d.param2).toBe(1) // throttle type 1 = PWM
    expect(d.param3).toBe(0)
    expect(d.param4).toBe(0)
    expect(d.param5).toBe(6) // ALL implies default sequential count

    // Description should mention motor target + units
    expect(getCommandDescription(stop)).toBe('Motor test ALL @ 0µs for 0s')
  })

  it('produces a description that surfaces target / value / duration', () => {
    const cmd: Command = {
      type: 'MOTOR_TEST',
      params: { motor: 3, throttle: 25, duration: 1.5 }
    }
    expect(getCommandDescription(cmd)).toBe('Motor test M3 @ 25% for 1.5s')
  })
})
