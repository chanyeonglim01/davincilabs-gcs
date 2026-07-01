// HEARTBEAT-only sender (does NOT bind 14551 — for use alongside Simulink mt_smoke)
// Sends UAM custom_mode AUTO.MISSION HEARTBEAT to GCS at 127.0.0.1:14550 every 1s
import dgram from 'dgram'

const GCS_PORT = 14550
const GCS_HOST = '127.0.0.1'
const SYS_ID = 1
const COMP_ID = 1
const MSGID_HEARTBEAT = 0
const CRC_EXTRA_HEARTBEAT = 50
let seq = 0

function crc16(data, extra) {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    let tmp = (data[i] ^ crc) & 0xff
    tmp = (tmp ^ (tmp << 4)) & 0xff
    crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff
  }
  let tmp = (extra ^ crc) & 0xff
  tmp = (tmp ^ (tmp << 4)) & 0xff
  crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff
  return crc
}

function buildHeartbeat() {
  const p = Buffer.alloc(9)
  // custom_mode = AUTO(1) | FixedWing(2)<<8 | MISSION(2)<<16 = 0x020201
  p.writeUInt32LE(1 | (2 << 8) | (2 << 16), 0)
  p.writeUInt8(22, 4) // MAV_TYPE_VTOL_QUADROTOR
  p.writeUInt8(0, 5) // MAV_AUTOPILOT_GENERIC
  p.writeUInt8(0b10000001, 6) // base_mode SAFETY_ARMED | CUSTOM_MODE_ENABLED
  p.writeUInt8(4, 7) // MAV_STATE_ACTIVE
  p.writeUInt8(3, 8) // mavlink_version
  const hdr = Buffer.alloc(10)
  hdr[0] = 0xfd
  hdr[1] = p.length
  hdr[2] = 0
  hdr[3] = 0
  hdr[4] = seq++ & 0xff
  hdr[5] = SYS_ID
  hdr[6] = COMP_ID
  hdr[7] = MSGID_HEARTBEAT & 0xff
  hdr[8] = (MSGID_HEARTBEAT >> 8) & 0xff
  hdr[9] = (MSGID_HEARTBEAT >> 16) & 0xff
  const crcInput = Buffer.concat([hdr.subarray(1), p])
  const checksum = crc16(crcInput, CRC_EXTRA_HEARTBEAT)
  const crcBuf = Buffer.alloc(2)
  crcBuf.writeUInt16LE(checksum, 0)
  return Buffer.concat([hdr, p, crcBuf])
}

const socket = dgram.createSocket('udp4')
console.log(`[HB] sending HEARTBEAT 1Hz to ${GCS_HOST}:${GCS_PORT} (no bind on 14551)`)
console.log(`[HB] custom_mode = AUTO.MISSION (0x020201)`)

setInterval(() => {
  const hb = buildHeartbeat()
  socket.send(hb, GCS_PORT, GCS_HOST)
}, 1000)

process.on('SIGINT', () => {
  console.log('\n[HB] Shutting down...')
  socket.close()
  process.exit(0)
})
