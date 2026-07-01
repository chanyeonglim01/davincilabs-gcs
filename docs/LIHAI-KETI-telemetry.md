# LIHAI / KETI 텔레메트리 — 인수인계 문서

FCC(DavinciFC) → GCS(davincilabs_GCS)로 **LIHAI 서브시스템 에러**와 **KETI 전방 장애물** 정보를
커스텀 MAVLink v2 메시지 2개로 전송·표시하는 기능. 작업 브랜치: GCS `iitp`.

---

## 1. 개요 / 데이터 출처

- **LIHAI**: 리하이 보드가 시리얼(`/dev/ttyUSB1`)로 주는 서브시스템 에러 7종. FCC의 `g_state_err`(`fcc.h`)에 저장.
- **KETI**: KETI 장애물 탐지 모듈이 TCP로 주는 최근접 객체 정보. FCC의 `g_fcc.keti_*`(`fcc.h`)에 저장.
- **출처는 Simulink 모델이 아니라 C++ FCC(`fcc.h` 전역)**. 모델은 LIHAI/KETI를 전혀 모른다.
- 전송 경로: 기존 **시리얼 텔레메트리 라디오**(모델 MAVLink가 나가는 그 링크)에 프레임을 얹음. 새 링크·새 포트 없음.

---

## 2. 와이어 계약 (단일 소스 — 양쪽이 바이트 단위로 일치해야 함)

공통: MAVLink v2, `sysid=1 / compid=1`, little-endian, `incompat=0 / compat=0`,
CRC = CRC-16/MCRF4XX(seed 0xFFFF) + CRC_EXTRA. target 필드 없음(브로드캐스트).

### LIHAI_STATUS — msgid `42001`, CRC_EXTRA `103`, payload 8B
| off | 필드 | 타입 | 의미 |
|----|------|------|------|
| 0 | link | u8 | 1 = LIHAI 프레임 최근 수신(연결), 0 = stale |
| 1 | bat_error | u8 | 배터리 |
| 2 | gps_error | u8 | GPS |
| 3 | imu_error | u8 | IMU |
| 4 | barometer_error | u8 | 기압계 |
| 5 | rc_error | u8 | RC |
| 6 | angle_control_error | u8 | 자세 제어 |
| 7 | position_control_error | u8 | 위치 제어 |

### KETI_OBSTACLE — msgid `42002`, CRC_EXTRA `104`, payload 24B
| off | 필드 | 타입 | 의미 |
|----|------|------|------|
| 0 | distance | f32 | 최근접 거리(m) |
| 4 | obj_x | f32 | 상대 x(m) |
| 8 | obj_y | f32 | 상대 y(m) |
| 12 | obj_z | f32 | 상대 z(m) |
| 16 | size | f32 | 크기 |
| 20 | valid | u8 | 1 = 탐지 유효, 0 = stale(500ms 무수신) |
| 21 | count | u8 | 전체 객체 수 |
| 22 | id | u8 | 최근접 객체 class(TYPE) |
| 23 | reserved | u8 | 0 |

> `fcc.h`의 keti_distance/size/obj_* 는 `double` → wire에서는 `float32`로 캐스팅.

---

## 3. FCC 측 변경 (DavinciFC, C++) — 전부 `[ADDED]` 주석 표시, 추가 전용

| 파일 | 변경 |
|------|------|
| `comms/custom_msgs.h` | 🆕 헤더온리 인코더. `encode_lihai_status()`, `encode_keti_obstacle()`. 0xFD 프레이밍 + CRC + CRC_EXTRA. 상수 `MSGID/CRC_EXTRA/LEN`, `FRAME_MAX=36` |
| `comms/telemetry.h` | `submit_aux(frame,len)` 추가(L188). 완결 프레임을 기존 시리얼 TX 큐(`g_tx_q`)에 저율(prio=1)로 주입 → io_thread가 원자적으로 송신, 모델 슬롯과 안전하게 인터리브 |
| `main.cpp` | L65 `#include custom_msgs.h` / L152 `g_lihai_last_rx_ns` atomic / L306-310 emit 설정(250ms≈4Hz, LIHAI 링크 타임아웃 500ms) / L388-413 제어루프: **기존 `g_in_mtx` 락 재사용**해 `g_state_err`+`g_fcc` 스냅샷 → 락 밖에서 인코딩 → `submit_aux` ×2 |
| `app_globals.h` | L28 `extern std::atomic<uint64_t> g_lihai_last_rx_ns;` |
| `lihai/lihai.h` | L527-531 `lihai_rx_thread_fn` 수신 성공 시 `CLOCK_MONOTONIC` 시각 저장(link 판정용) |

- 200Hz 제어루프에서 **~4Hz만 emit**, 스냅샷은 기존 락 1회 재사용 → 제어 성능 영향 없음.
- 시리얼 텔레메트리 경로가 꺼져 있으면(`g_fd<0`) `submit_aux`가 no-op → 안전.

---

## 4. GCS 측 변경 (davincilabs_GCS, `iitp`) — Pattern A(기존 `telemetry-update`에 합승, preload/IPC 무변경)

| 파일 | 변경 |
|------|------|
| `src/main/mavlink/customMessages.ts` | 🆕 **단일 소스**. `CUSTOM_MSG`(id/crcExtra), 타입 `LihaiStatus`/`KetiObstacle`, 디코더 `decodeLihaiStatus`/`decodeKetiObstacle` |
| `src/main/mavlink/parser.ts` | CRC_EXTRA 42001:103/42002:104, `isAddressedToUs` no-target 그룹에 추가, switch case 2개 → `handleLihaiStatus`/`handleKetiObstacle`(payload=`safe.subarray(10)` → 디코더 → `telemetryState.status.*`) |
| `src/renderer/src/types/telemetry.ts` | `StatusData`에 `lihaiLink`, `lihaiErrors{bat,gps,imu,baro,rc,angle,pos}`, `ketiValid`, `ketiCount`, `ketiId`, `ketiDistance`, `ketiObjX/Y/Z`, `ketiSize` 추가 |
| `src/renderer/src/components/panels/AvionicsPanel.tsx` | 상태부에 `LIHAI`·`KETI` 연결 줄 추가(ARM/RC/GPS 아래) |
| `src/renderer/src/components/panels/LihaiPanel.tsx` | 🆕 드래그/최소화 패널. 헤더 점(에러 없으면 초록 `#A5D6A7` / 있으면 노랑 `#f5c842`) + 7개 에러 목록 |
| `src/renderer/src/components/panels/KetiPanel.tsx` | 🆕 드래그/최소화 패널. `OBJECTS`(개수) + 최근접 객체 그리드(DIST/SIZE/OBJ X·Y·Z/**TYPE**) |
| `src/renderer/src/components/MapOverlay.tsx` | 두 패널 등록(collapsed 상태 + DraggablePanel), 우측 안쪽 열 |

- KETI **TYPE**은 클래스 번호(숫자) 그대로 표시(이름 매핑 표 없음).

---

## 5. 엔드투엔드 흐름

```
LIHAI 보드 ──시리얼──▶ g_state_err ┐
KETI 모듈  ──TCP────▶ g_fcc.keti_* ┘
                         │ (main.cpp 제어루프 ~4Hz, g_in_mtx 스냅샷)
                         ▼
      custom_msgs 인코딩(42001/42002) ─ submit_aux ─▶ 시리얼 텔레메트리 라디오(57600)
                         │
                         ▼
   GCS parser.ts (case 42001/42002 → decode) ─▶ TelemetryData.status
                         │ (기존 telemetry-update IPC 30Hz)
                         ▼
   AvionicsPanel(LIHAI/KETI 줄) · LihaiPanel(에러) · KetiPanel(장애물)
```

---

## 6. 활성화 / 테스트

**FCC**
- `davinci.env`: `DVFC_MAVLINK_GCS_ENABLE=1` (시리얼 GCS 경로 ON), 시리얼 `/dev/ttyUSB1 @57600`.
- 타겟에서 컴파일/실행 필요(이 워크스페이스에선 Simulink 생성 헤더가 없어 컴파일 미검증).

**GCS**
- `pnpm dev` 실행 → Header에서 시리얼(COM) 또는 UDP 연결.
- 프레임 수신 시: AvionicsPanel의 LIHAI/KETI 줄 + LihaiPanel/KetiPanel에 값 표시.

**하드웨어 없이 검증하려면**: 42001/42002를 GCS 리슨 포트로 쏘는 UDP 에미터 스크립트가 필요(현재 미작성 — 요청 시 `tests/manual/`에 추가 가능).

---

## 7. 상태 (2026-07-01 기준)

| 구분 | 상태 |
|------|------|
| FCC 인코더/배선 | ✅ 코드 완료, CRC 자체검증(양쪽 프레임 바이트 일치) / ⚠️ 타겟 컴파일 미검증 |
| GCS 파서/타입/패널 | ✅ 코드 완료, `pnpm typecheck` PASS |
| 계약 일치(FCC↔GCS) | ✅ 검수자 바이트 단위 확인(msgid/CRC_EXTRA/오프셋/엔디안/CRC 동일) |
| 라이브 왕복 테스트 | ⛔ 미실시(실 하드웨어 또는 에미터 필요) |
| 커밋 | ⛔ 미커밋(GCS `iitp` 워킹트리 / DavinciFC는 git repo 아님) |

**결론(“GCS 됐나?”)**: 코드·타입체크·계약 일치까지 **완료**. 단 **실데이터 왕복 테스트는 아직** — 연결해서 값이 실제로 뜨는지는 확인 전.

---

## 8. 알려진 주의점

1. **FCC 동시성**: `g_state_err`는 lihai 스레드에서 락 없이 write / 제어루프는 `g_in_mtx` 잡고 read → 형식상 data race. uint8 독립 필드라 실무상 무해(상태 표시용). 엄격히 하려면 write에도 `g_in_mtx`.
2. **디자인 팔레트**: LihaiPanel/KetiPanel·상태 dot이 심각도 색(red `#ff5555` / amber `#f5c842` / green `#A5D6A7`)을 사용 — 엄격한 3색 규칙(#181C14/#3C3D37/#ECDFCC) 밖이나 기존 LogPanel/AvionicsPanel 관례를 따름.
3. **KETI TYPE**: 클래스 번호(숫자)만 표시. id→이름 표가 생기면 매핑 가능.

---

## 부록 A — FCC 실제 추가 코드 (DavinciFC, git 미추적)

> DavinciFC는 git 저장소가 아니라 diff가 없다. 인수인계용으로 실제 추가/변경된 코드를 아래에 박아둔다.
> 모든 편집은 소스에 `[ADDED]` 주석 표시됨. **`fcc.h`는 수정하지 않음** — `State_Error_t g_state_err`,
> `FCCData_t g_fcc`(keti_* 포함) 정의는 원래부터 존재하며 여기서는 read만 한다.

### A-1. `comms/custom_msgs.h` — 신규 파일 (전체)

```cpp
#ifndef CUSTOM_MSGS_H
#define CUSTOM_MSGS_H
// GCS 커스텀 MAVLink v2 인코더 — LIHAI_STATUS(42001) / KETI_OBSTACLE(42002)
// SoT: davincilabs_GCS/src/main/mavlink/customMessages.ts 와 byte-for-byte 일치.
#include <cstdint>
#include <cstring>
#include "../fcc.h"   // State_Error_t, FCCData_t

namespace custom_msgs {
static_assert(sizeof(float) == 4, "float must be IEEE-754 32-bit");

static constexpr uint8_t  MAV_SYSID  = 1;   // FCC(드론). GCS 는 255/190
static constexpr uint8_t  MAV_COMPID = 1;
static constexpr uint32_t MSGID_LIHAI_STATUS  = 42001;
static constexpr uint8_t  CRC_EXTRA_LIHAI     = 103;
static constexpr uint8_t  LEN_LIHAI           = 8;
static constexpr uint32_t MSGID_KETI_OBSTACLE = 42002;
static constexpr uint8_t  CRC_EXTRA_KETI      = 104;
static constexpr uint8_t  LEN_KETI            = 24;
static constexpr size_t   FRAME_MAX = 10 + 24 + 2;   // 36

// CRC-16/MCRF4XX (MAVLink). GCS parser.ts calculateCrc 와 동일.
static inline void crc_accumulate(uint8_t data, uint16_t* crc) {
    uint8_t tmp = (uint8_t)(data ^ (uint8_t)(*crc & 0xFF));
    tmp = (uint8_t)(tmp ^ (uint8_t)(tmp << 4));
    *crc = (uint16_t)(((*crc >> 8) ^ ((uint16_t)tmp << 8)
                       ^ ((uint16_t)tmp << 3) ^ ((uint16_t)tmp >> 4)) & 0xFFFF);
}
static inline void put_f32(uint8_t* p, float v) { std::memcpy(p, &v, sizeof(v)); }

// 헤더(seq 포함) + CRC 채움. payload 는 호출측이 out+10 에 미리 기록.
static inline size_t finalize_frame(uint8_t* out, uint8_t len,
                                    uint32_t msgid, uint8_t crc_extra) {
    static uint8_t seq = 0;   // 제어루프 단일 스레드
    out[0]=0xFD; out[1]=len; out[2]=0; out[3]=0; out[4]=seq++;
    out[5]=MAV_SYSID; out[6]=MAV_COMPID;
    out[7]=(uint8_t)(msgid & 0xFF);
    out[8]=(uint8_t)((msgid >> 8) & 0xFF);
    out[9]=(uint8_t)((msgid >> 16) & 0xFF);
    uint16_t crc = 0xFFFF;
    for (size_t i = 1; i < (size_t)(10 + len); ++i) crc_accumulate(out[i], &crc);
    crc_accumulate(crc_extra, &crc);
    out[10+len]   = (uint8_t)(crc & 0xFF);
    out[10+len+1] = (uint8_t)((crc >> 8) & 0xFF);
    return (size_t)(10 + len + 2);
}

// MSG 42001 LIHAI_STATUS (8B). link: 1=최근 수신(연결), 0=stale.
static inline size_t encode_lihai_status(uint8_t* out,
                                         const State_Error_t* e, uint8_t link) {
    uint8_t* p = out + 10;
    p[0]=link; p[1]=e->bat_error; p[2]=e->gps_error; p[3]=e->imu_error;
    p[4]=e->barometer_error; p[5]=e->rc_error;
    p[6]=e->angle_control_error; p[7]=e->position_control_error;
    return finalize_frame(out, LEN_LIHAI, MSGID_LIHAI_STATUS, CRC_EXTRA_LIHAI);
}

// MSG 42002 KETI_OBSTACLE (24B). keti_* double → wire float32.
static inline size_t encode_keti_obstacle(uint8_t* out, const FCCData_t* d) {
    uint8_t* p = out + 10;
    put_f32(p+0,(float)d->keti_distance); put_f32(p+4,(float)d->keti_obj_x);
    put_f32(p+8,(float)d->keti_obj_y);    put_f32(p+12,(float)d->keti_obj_z);
    put_f32(p+16,(float)d->keti_size);
    p[20]=d->keti_valid; p[21]=d->keti_count; p[22]=d->keti_id; p[23]=0;
    return finalize_frame(out, LEN_KETI, MSGID_KETI_OBSTACLE, CRC_EXTRA_KETI);
}
} // namespace custom_msgs
#endif
```

### A-2. `comms/telemetry.h` — `submit_aux()` 추가 (기존 TX 큐 재사용, 직접 fd write 안 함)

```cpp
static inline void submit_aux(const uint8_t* frame, size_t len) {
  if (g_fd < 0) return;                 // 시리얼 미기동 → 드롭
  if (frame == nullptr || len == 0) return;
  if (len > TX_FRAME_MAX) return;       // 완성 프레임만
  std::lock_guard<std::mutex> lk(g_tx_mtx);
  if (g_tx_q.size() >= TX_QUEUE_MAX) {  // submit_tx 와 동일 백로그 cap → low-prio 우선 드롭
    auto it = std::find_if(g_tx_q.begin(), g_tx_q.end(),
                           [](const Frame& f){ return f.prio == 1; });
    if (it != g_tx_q.end()) g_tx_q.erase(it); else g_tx_q.pop_front();
    g_tx_dropped.fetch_add(1, std::memory_order_relaxed);
  }
  Frame f; std::memcpy(f.buf, frame, len); f.len=(uint16_t)len; f.prio=1;
  g_tx_q.push_back(f);
}
```

### A-3. `main.cpp` — include / 전역 / 제어루프 emit

```cpp
// L65
#include "comms/custom_msgs.h"

// L152 (g_state_err 정의 근처)
std::atomic<uint64_t> g_lihai_last_rx_ns{0};

// 제어루프 진입 전 (L306-310)
const uint64_t AUX_EMIT_PERIOD_NS    = 250000000ULL;  // 250ms ≈ 4Hz
const uint64_t LIHAI_LINK_TIMEOUT_NS = 500000000ULL;  // 500ms 무수신 → link=0
uint64_t aux_last_emit_ns = 0;

// 제어루프 내 (L388-413) — 기존 g_in_mtx 락 재사용(락 1회)
const bool aux_due = (t_iter_start - aux_last_emit_ns) >= AUX_EMIT_PERIOD_NS;
State_Error_t aux_err{};
FCCData_t     aux_snap;
{
    std::lock_guard<std::mutex> lk(g_in_mtx);
    fcc_to_bus(&g_fcc, &UAM_Flight_control_U);      // 기존 라인
    if (aux_due) { aux_err = g_state_err; aux_snap = g_fcc; }
}
if (aux_due) {
    aux_last_emit_ns = t_iter_start;
    const uint64_t lihai_rx = g_lihai_last_rx_ns.load(std::memory_order_relaxed);
    const uint8_t  lihai_link =
        (lihai_rx != 0 && (t_iter_start - lihai_rx) < LIHAI_LINK_TIMEOUT_NS) ? 1 : 0;
    uint8_t aux_frame[custom_msgs::FRAME_MAX]; size_t aux_len;
    aux_len = custom_msgs::encode_lihai_status(aux_frame, &aux_err, lihai_link);
    telemetry::submit_aux(aux_frame, aux_len);
    aux_len = custom_msgs::encode_keti_obstacle(aux_frame, &aux_snap);
    telemetry::submit_aux(aux_frame, aux_len);
}
```

### A-4. `app_globals.h` (L28)

```cpp
extern std::atomic<uint64_t> g_lihai_last_rx_ns;
```

### A-5. `lihai/lihai.h` — `lihai_rx_thread_fn` 수신 성공 시 (L527-533)

```cpp
if (read_state_errors_packet20(g_lihai_fd, g_state_err, 20)) {
    // [ADDED] LIHAI link 플래그용 마지막 수신 시각
    timespec rx_ts{};
    clock_gettime(CLOCK_MONOTONIC, &rx_ts);
    g_lihai_last_rx_ns.store(
        (uint64_t)rx_ts.tv_sec * 1000000000ull + (uint64_t)rx_ts.tv_nsec,
        std::memory_order_relaxed);
}
```
