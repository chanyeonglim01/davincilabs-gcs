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
