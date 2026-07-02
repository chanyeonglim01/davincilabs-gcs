// LIHAI/KETI CONNECTED 확인용 테스트 송신기 (보드 불필요)
//
// 127.0.0.1:14550(GCS)로 HEARTBEAT(1Hz) + LIHAI_STATUS(42001, 4Hz) + KETI_OBSTACLE(42002, 4Hz) 송신.
// 실제 FCC가 250ms마다 쏘는 것과 동일 주기/포맷. 와이어 계약 SoT: src/main/mavlink/customMessages.ts
//
// 사용법:
//   1) 다른 터미널에서 GCS 실행:  pnpm dev
//   2) 이 스크립트 실행:          node tests/manual/lihai_keti_test.mjs
//   3) GCS AvionicsPanel 확인:
//        - LIHAI  : NO LINK -> CONNECTED (초록). 주기적으로 ERROR(앰버) 깜빡 -> LihaiPanel 플래그
//        - KETI   : NO LINK -> CONNECTED (초록) <-> OBST x.xm (앰버, 장애물). KetiPanel 값 갱신
//   4) 스크립트를 멈추면(Ctrl+C) 2초 뒤 GCS가 다시 NO LINK 로 (신선도 타임아웃 동작 확인)
import dgram from 'dgram'

const GCS_PORT = 14550
const GCS_HOST = '127.0.0.1'
const SYS_ID = 1
const COMP_ID = 1

const MSGID_HEARTBEAT = 0
const CRC_HEARTBEAT = 50
const MSGID_LIHAI = 42001
const CRC_LIHAI = 103
const MSGID_KETI = 42002
const CRC_KETI = 104

const LIHAI_FLAGS = ['bat', 'gps', 'imu', 'baro', 'rc', 'angle', 'pos'] // payload byte 1..7

let seq = 0

// MAVLink v2 CRC-16/MCRF4XX + CRC_EXTRA (heartbeat_only.mjs와 동일)
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

function frame(msgid, crcExtra, payload) {
  const hdr = Buffer.alloc(10)
  hdr[0] = 0xfd
  hdr[1] = payload.length
  hdr[2] = 0 // incompat_flags
  hdr[3] = 0 // compat_flags
  hdr[4] = seq++ & 0xff
  hdr[5] = SYS_ID
  hdr[6] = COMP_ID
  hdr[7] = msgid & 0xff
  hdr[8] = (msgid >> 8) & 0xff
  hdr[9] = (msgid >> 16) & 0xff
  const checksum = crc16(Buffer.concat([hdr.subarray(1), payload]), crcExtra)
  const crcBuf = Buffer.alloc(2)
  crcBuf.writeUInt16LE(checksum, 0)
  return Buffer.concat([hdr, payload, crcBuf])
}

function heartbeat() {
  const p = Buffer.alloc(9)
  p.writeUInt32LE(1 | (2 << 8) | (2 << 16), 0) // custom_mode = AUTO.FixedWing.MISSION
  p.writeUInt8(22, 4) // MAV_TYPE_VTOL_QUADROTOR
  p.writeUInt8(0, 5) // MAV_AUTOPILOT_GENERIC
  p.writeUInt8(0b10000001, 6) // base_mode: SAFETY_ARMED | CUSTOM_MODE_ENABLED
  p.writeUInt8(4, 7) // MAV_STATE_ACTIVE
  p.writeUInt8(3, 8) // mavlink_version
  return frame(MSGID_HEARTBEAT, CRC_HEARTBEAT, p)
}

// errIndex: 0 = 에러 없음(OK), 1..7 = 해당 서브시스템 에러 플래그 1
function lihaiStatus(errIndex) {
  const p = Buffer.alloc(8)
  p.writeUInt8(1, 0) // [0] link = 1 (LIHAI 시리얼 살아있음)
  if (errIndex >= 1 && errIndex <= 7) p.writeUInt8(1, errIndex)
  return frame(MSGID_LIHAI, CRC_LIHAI, p)
}

function ketiObstacle(valid, distance) {
  const p = Buffer.alloc(24)
  p.writeFloatLE(distance, 0) // [0]  distance
  p.writeFloatLE(0.5, 4) // [4]  obj_x
  p.writeFloatLE(-0.3, 8) // [8]  obj_y
  p.writeFloatLE(1.2, 12) // [12] obj_z
  p.writeFloatLE(0.8, 16) // [16] size
  p.writeUInt8(valid ? 1 : 0, 20) // [20] valid
  p.writeUInt8(valid ? 1 : 0, 21) // [21] count
  p.writeUInt8(7, 22) // [22] id (class)
  p.writeUInt8(0, 23) // [23] reserved
  return frame(MSGID_KETI, CRC_KETI, p)
}

const socket = dgram.createSocket('udp4')
console.log(`[LIHAI/KETI TEST] -> ${GCS_HOST}:${GCS_PORT}`)
console.log('  HEARTBEAT 1Hz + LIHAI_STATUS(42001)/KETI_OBSTACLE(42002) 4Hz')
console.log('  GCS AvionicsPanel 에서 LIHAI/KETI 가 CONNECTED 로 바뀌면 성공. Ctrl+C 로 종료.\n')

setInterval(() => socket.send(heartbeat(), GCS_PORT, GCS_HOST), 1000)

let tick = 0
setInterval(() => {
  tick++

  // LIHAI: 평소 OK, 24틱(6s)마다 앞 6틱(1.5s) 동안 에러 플래그 하나 회전 점등
  const phase = tick % 24
  const errIndex = phase < 6 ? ((Math.floor(tick / 24) % 7) + 1) : 0
  socket.send(lihaiStatus(errIndex), GCS_PORT, GCS_HOST)

  // KETI: 40틱(10s) 주기로 앞 20틱 clear(valid=0 -> CONNECTED), 뒤 20틱 obstacle(valid=1, 거리 이동)
  const valid = tick % 40 >= 20
  const distance = valid ? 3 + 6 * (1 + Math.sin(tick / 4)) : 0
  socket.send(ketiObstacle(valid, distance), GCS_PORT, GCS_HOST)

  // 1초에 한 번 현재 송신 상태 로그
  if (tick % 4 === 0) {
    const lihai = errIndex === 0 ? 'OK' : `ERROR(${LIHAI_FLAGS[errIndex - 1]})`
    const keti = valid ? `OBST ${distance.toFixed(1)}m` : 'CLEAR'
    console.log(`[tx] LIHAI=CONNECTED/${lihai}  KETI=CONNECTED/${keti}`)
  }
}, 250)

process.on('SIGINT', () => {
  console.log('\n[LIHAI/KETI TEST] 종료 — 2초 뒤 GCS가 NO LINK 로 돌아가면 신선도 타임아웃 정상')
  socket.close()
  process.exit(0)
})
