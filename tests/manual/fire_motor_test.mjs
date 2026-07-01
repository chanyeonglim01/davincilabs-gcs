// Fire a single MAV_CMD_DO_MOTOR_TEST (cmd 209) to 127.0.0.1:14551 (mt_smoke listen)
// Args: motor_idx (default 1), throttle_pct (default 50)
import dgram from 'dgram'

const TARGET_HOST = '127.0.0.1'
const TARGET_PORT = 14551
const SYS_ID = 255
const COMP_ID = 190
const MSGID_COMMAND_LONG = 76
const CRC_EXTRA_COMMAND_LONG = 152

const motorIdx = Number(process.argv[2] || 1)
const throttle = Number(process.argv[3] || 50)
const duration = Number(process.argv[4] || 1)

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

// MAVLink v2 COMMAND_LONG payload: 33 bytes
// param1..7 (float, 28B) + command (uint16) + target_system (u8) + target_component (u8) + confirmation (u8)
const payload = Buffer.alloc(33)
payload.writeFloatLE(motorIdx, 0)    // param1: motor instance (0=ALL, 1-6 individual)
payload.writeFloatLE(0, 4)           // param2: throttle_type
payload.writeFloatLE(throttle, 8)    // param3: throttle pct
payload.writeFloatLE(duration, 12)   // param4: duration sec
payload.writeFloatLE(0, 16)          // param5
payload.writeFloatLE(0, 20)          // param6
payload.writeFloatLE(0, 24)          // param7
payload.writeUInt16LE(209, 28)       // command MAV_CMD_DO_MOTOR_TEST
payload.writeUInt8(1, 30)            // target_system (drone)
payload.writeUInt8(1, 31)            // target_component (drone)
payload.writeUInt8(0, 32)            // confirmation

const hdr = Buffer.alloc(10)
hdr[0] = 0xfd
hdr[1] = payload.length
hdr[2] = 0
hdr[3] = 0
hdr[4] = 0
hdr[5] = SYS_ID
hdr[6] = COMP_ID
hdr[7] = MSGID_COMMAND_LONG & 0xff
hdr[8] = (MSGID_COMMAND_LONG >> 8) & 0xff
hdr[9] = (MSGID_COMMAND_LONG >> 16) & 0xff
const crcInput = Buffer.concat([hdr.subarray(1), payload])
const checksum = crc16(crcInput, CRC_EXTRA_COMMAND_LONG)
const crcBuf = Buffer.alloc(2)
crcBuf.writeUInt16LE(checksum, 0)
const packet = Buffer.concat([hdr, payload, crcBuf])

const socket = dgram.createSocket('udp4')
socket.send(packet, TARGET_PORT, TARGET_HOST, (err) => {
  if (err) {
    console.error('Send error:', err.message)
    process.exit(1)
  }
  console.log(
    `Sent MAV_CMD_DO_MOTOR_TEST: motor=${motorIdx}, throttle=${throttle}%, duration=${duration}s`
  )
  console.log(`Packet ${packet.length}B → ${TARGET_HOST}:${TARGET_PORT}`)
  socket.close()
  process.exit(0)
})
