/**
 * MAVLink Mission Upload Simulator
 * Acts as a drone (PX4-compatible) to test the GCS mission upload protocol
 *
 * Port setup:
 *   Simulator (drone-side): listens on 14551, sends to GCS at 14550
 *   GCS (our app):          listens on 14550, sends to drone at 14551
 *
 * Run: node test/mission_simulator.mjs
 * Then use the GCS Mission view → UPLOAD MISSION button
 */

import dgram from 'dgram'

const DRONE_PORT = 14551  // simulator listens here
const GCS_PORT   = 14550  // GCS listens here
const GCS_HOST   = '127.0.0.1'

// ─── MAVLink v2 constants ─────────────────────────────────────────────────────
const SYS_ID  = 1
const COMP_ID = 1

const MSGID_HEARTBEAT           = 0
const MSGID_MISSION_REQUEST_INT = 51
const MSGID_MISSION_ACK         = 47

const CRC_EXTRA = {
  0:  50,  // HEARTBEAT
  51: 196, // MISSION_REQUEST_INT
  47: 153, // MISSION_ACK
}

let seq = 0

// ─── CRC-16/MCRF4XX ──────────────────────────────────────────────────────────
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

function buildPacket(msgid, payload) {
  const hdr = Buffer.alloc(10)
  hdr[0] = 0xfd
  hdr[1] = payload.length
  hdr[2] = 0
  hdr[3] = 0
  hdr[4] = seq++ & 0xff
  hdr[5] = SYS_ID
  hdr[6] = COMP_ID
  hdr[7] =  msgid        & 0xff
  hdr[8] = (msgid >> 8)  & 0xff
  hdr[9] = (msgid >> 16) & 0xff

  const crcInput = Buffer.concat([hdr.subarray(1), payload])
  const checksum = crc16(crcInput, CRC_EXTRA[msgid] ?? 0)
  const crcBuf = Buffer.alloc(2)
  crcBuf.writeUInt16LE(checksum, 0)
  return Buffer.concat([hdr, payload, crcBuf])
}

// ─── HEARTBEAT ────────────────────────────────────────────────────────────────
function buildHeartbeat() {
  const p = Buffer.alloc(9)
  p.writeUInt32LE(2, 0)   // custom_mode=2 (PX4 Mission mode)
  p.writeUInt8(1, 4)       // type=1 (MAV_TYPE_FIXED_WING placeholder)
  p.writeUInt8(3, 5)       // autopilot=3 (MAV_AUTOPILOT_ARDUPILOTMEGA placeholder)
  p.writeUInt8(0b11000001, 6) // base_mode: armed + guided + custom
  p.writeUInt8(4, 7)       // system_status=4 (MAV_STATE_ACTIVE)
  p.writeUInt8(3, 8)       // mavlink_version=3
  return buildPacket(MSGID_HEARTBEAT, p)
}

// ─── MISSION_REQUEST_INT ─────────────────────────────────────────────────────
function buildMissionRequestInt(seq, targetSys = 255, targetComp = 190) {
  const p = Buffer.alloc(5)
  p.writeUInt16LE(seq, 0)
  p.writeUInt8(targetSys,  2)
  p.writeUInt8(targetComp, 3)
  p.writeUInt8(0, 4) // MAV_MISSION_TYPE_MISSION
  return buildPacket(MSGID_MISSION_REQUEST_INT, p)
}

// ─── MISSION_ACK ─────────────────────────────────────────────────────────────
function buildMissionAck(type = 0, targetSys = 255, targetComp = 190) {
  const p = Buffer.alloc(4)
  p.writeUInt8(targetSys,  0)
  p.writeUInt8(targetComp, 1)
  p.writeUInt8(type, 2) // MAV_MISSION_RESULT (0=accepted)
  p.writeUInt8(0, 3)    // MAV_MISSION_TYPE_MISSION
  return buildPacket(MSGID_MISSION_ACK, p)
}

// ─── Packet parser ────────────────────────────────────────────────────────────
function parsePackets(buf) {
  const result = []
  let offset = 0
  while (offset < buf.length) {
    const magic = buf.indexOf(0xfd, offset)
    if (magic === -1) break
    if (buf.length < magic + 12) break
    const payloadLen = buf[magic + 1]
    const packetLen = 12 + payloadLen
    if (buf.length < magic + packetLen) break

    const packet = buf.subarray(magic, magic + packetLen)
    const msgid = packet[7] | (packet[8] << 8) | (packet[9] << 16)
    offset = magic + packetLen
    result.push({ msgid, packet })
  }
  return result
}

// ─── Simulator state machine ─────────────────────────────────────────────────
class MissionSimulator {
  constructor(socket) {
    this.socket = socket
    this.state = 'idle'       // idle | clearing | counting | receiving | done
    this.totalCount = 0
    this.nextSeq = 0
    this.receivedItems = []
  }

  handle(msgid, packet) {
    switch (msgid) {
      case 45: // MISSION_CLEAR_ALL
        console.log('[SIM] ← MISSION_CLEAR_ALL received — mission cleared')
        this.state = 'clearing'
        this.totalCount = 0
        this.nextSeq = 0
        this.receivedItems = []
        break

      case 44: { // MISSION_COUNT
        const count = packet.readUInt16LE(10)
        console.log(`[SIM] ← MISSION_COUNT: ${count} items`)
        this.totalCount = count
        this.nextSeq = 0
        this.state = 'receiving'
        this._requestItem(0)
        break
      }

      case 73: { // MISSION_ITEM_INT
        const itemSeq = packet.readUInt16LE(28)
        const cmd     = packet.readUInt16LE(30)
        const frame   = packet.readUInt8(34)
        const lat     = packet.readInt32LE(16) / 1e7
        const lon     = packet.readInt32LE(20) / 1e7
        const alt     = packet.readFloatLE(24)
        console.log(`[SIM] ← ITEM[${itemSeq}] cmd=${cmd} frame=${frame} lat=${lat.toFixed(5)} lon=${lon.toFixed(5)} alt=${alt.toFixed(1)}m`)
        this.receivedItems[itemSeq] = { cmd, frame, lat, lon, alt }

        if (itemSeq < this.totalCount - 1) {
          this._requestItem(itemSeq + 1)
        } else {
          console.log(`[SIM] All ${this.totalCount} items received → sending MISSION_ACK(ACCEPTED)`)
          this._sendAck(0)
          this.state = 'done'
          this._printSummary()
        }
        break
      }
    }
  }

  _requestItem(n) {
    const msg = buildMissionRequestInt(n)
    this.socket.send(msg, GCS_PORT, GCS_HOST, () => {
      console.log(`[SIM] → MISSION_REQUEST_INT[${n}]`)
    })
  }

  _sendAck(type) {
    const msg = buildMissionAck(type)
    this.socket.send(msg, GCS_PORT, GCS_HOST, () => {
      console.log(`[SIM] → MISSION_ACK(${type === 0 ? 'ACCEPTED' : 'REJECTED=' + type})`)
    })
  }

  _printSummary() {
    console.log('\n╔══════════════════════════════════════╗')
    console.log('║      MISSION UPLOAD SUCCESSFUL       ║')
    console.log('╠══════════════════════════════════════╣')
    this.receivedItems.forEach((item, i) => {
      const cmdName = {
        16: 'WAYPOINT', 17: 'LOITER', 20: 'RTL',
        21: 'LAND', 22: 'TAKEOFF', 84: 'VTOL_TAKEOFF',
        85: 'VTOL_LAND', 3000: 'VTOL_TRANSITION'
      }[item.cmd] || `CMD_${item.cmd}`
      console.log(`║  [${String(i).padStart(2)}] ${cmdName.padEnd(18)} alt=${String(item.alt.toFixed(1)).padStart(6)}m ║`)
    })
    console.log('╚══════════════════════════════════════╝\n')
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const socket = dgram.createSocket('udp4')
const sim = new MissionSimulator(socket)

socket.bind(DRONE_PORT, () => {
  console.log(`\n[SIM] Drone simulator listening on UDP ${DRONE_PORT}`)
  console.log(`[SIM] Will respond to GCS at ${GCS_HOST}:${GCS_PORT}`)
  console.log(`[SIM] ─────────────────────────────────────────`)
  console.log(`[SIM] Sending HEARTBEAT every 1s...`)
  console.log(`[SIM] Open GCS → Mission view → Add waypoints → UPLOAD MISSION\n`)

  // Send heartbeat every 1s so GCS shows as "connected"
  setInterval(() => {
    const hb = buildHeartbeat()
    socket.send(hb, GCS_PORT, GCS_HOST)
  }, 1000)
})

socket.on('message', (msg) => {
  for (const { msgid, packet } of parsePackets(msg)) {
    sim.handle(msgid, packet)
  }
})

socket.on('error', (err) => {
  console.error('[SIM] Error:', err.message)
  process.exit(1)
})

process.on('SIGINT', () => {
  console.log('\n[SIM] Shutting down...')
  socket.close()
  process.exit(0)
})
