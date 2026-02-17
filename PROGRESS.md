# DavinciLabs GCS — 개발 진행 현황

> 목표, 완료 항목, 다음 작업을 추적하는 문서.
> 세션 시작 시 `memory/gcs_status.md`도 함께 확인.

---

## 목표

UAM(Urban Air Mobility) 드론 개발을 위한 지상 관제 소프트웨어를 구축한다.

**1단계 목표 (현재)**: Simulink 시뮬레이션 환경에서 드론과 완전한 MAVLink v2 통신
**2단계 목표**: PX4 SITL 연동 검증 및 실제 드론 비행 테스트 지원

---

## 완료

### 인프라
- [x] Electron 32 + Electron-Vite + React 18 + TypeScript 프로젝트 기반
- [x] pnpm 패키지 관리, ESLint, TypeScript strict 모드
- [x] electron-store 설정 영속화

### MAVLink 통신 레이어
- [x] UDP 소켓 연결 / 재연결 / Heartbeat 모니터링 (3초 타임아웃)
- [x] MAVLink v2 파서 — HEARTBEAT, SYS_STATUS, ATTITUDE, GLOBAL_POSITION_INT, VFR_HUD, PARAM_VALUE, COMMAND_ACK
- [x] COMMAND_LONG 빌더 — ARM, DISARM, TAKEOFF, LAND, RTL, HOLD
- [x] 미션 업로드 상태머신 — CLEAR_ALL → COUNT → ITEM_INT × N → ACK
- [x] PARAM_REQUEST_LIST / PARAM_SET 전송
- [x] IPC contextBridge (`window.mavlink.*` API 완전 구현)

### UI — Main 뷰
- [x] 전체화면 Leaflet 지도 (위성/다크 타일 전환, 드론 VTOL 마커 + 헤딩)
- [x] 계기판 패널 — 속도계/고도계/나침반/VSI (커스텀 SVG)
- [x] Avionics 패널 — 인공수평선 + 명령 버튼 (확인 다이얼로그)
- [x] 차트 패널 — Roll/Pitch/Yaw Recharts, 드래그+리사이즈, 접기
- [x] 로그 패널 — INFO/WARN/ERR 레벨, 드래그+리사이즈
- [x] Status 패널 — 위치/속도/배터리/비행모드 수치
- [x] 모든 패널 드래그 이동

### UI — Mission 뷰
- [x] 지도 클릭 웨이포인트 추가
- [x] 드래그 순서 변경, X버튼 삭제
- [x] 고도 프로파일 Recharts 차트
- [x] UPLOAD MISSION → MAVLink 프로토콜 실행

### UI — Parameter 뷰
- [x] React Flow 노드 그래프 (6열 PX4 제어 구조)
- [x] 노드 레이아웃: AIRFRAME/BATTERY → XY/Z POS → XY/Z VEL → ATT P Roll/Pitch/Yaw → RATE PID → LIMITS
- [x] 우측 편집 패널 — 파라미터 값 편집 + PARAM_SET 업로드

### 연결 관리
- [x] Header CONNECT 버튼 — host/port/remotePort 실시간 변경 후 재연결
- [x] remotePort 분리 (GCS listen ≠ GCS send)

---

## 진행 중 / 미완성

### MAVLink 버그

| 항목 | 파일 | 내용 |
|------|------|------|
| HEARTBEAT custom_mode 파싱 | `parser.ts:handleHeartbeat` | offset 10, UInt32LE 미읽음 → flightMode 항상 'UNKNOWN' |
| SET_MODE 명령 | `commander.ts:SET_MODE case` | console.warn만 출력, COMMAND_LONG 미전송 |
| PARAM_VALUE param_count | `parser.ts:handleParamValue` | TODO 주석, 파싱 안 됨 → 다운로드 진행률 표시 안 됨 |
| Connection error → UI | `index.ts:connection.on('error')` | console.error만, LogPanel에 전달 안 됨 |

> 상세 수정 명세: `memory/gcs_status.md` §4 참조

### 테스트

- [ ] PX4 SITL 통합 테스트 (remotePort=14580)
- [ ] Simulink 연동 실전 테스트

---

## 다음 작업 계획

### Phase 1 — MAVLink 버그 수정 (팀 에이전트 병렬)

**Agent A** (flight-mode): HEARTBEAT custom_mode 파싱 + SET_MODE 구현
```
parser.ts: main_mode = (custom_mode>>16)&0xFF, sub_mode = (custom_mode>>24)&0xFF
commander.ts: 모드 이름 → PX4 custom_mode uint32 → MAV_CMD_DO_SET_MODE(176)
```

**Agent B** (param-progress): param_count 활성화 + error UI 전달
```
parser.ts: param_count (offset 14, uint16) 주석 해제
index.ts: sendParamProgress() 호출 + sendLogMessage('error', ...) 추가
```

### Phase 2 — PX4 SITL 통합 테스트

```bash
# PX4 SITL 실행
cd px4 && make px4_sitl jmavsim

# GCS Header에서 remotePort=14580 설정 후 CONNECT
```

검증 시나리오:
- [ ] HEARTBEAT 수신 → 비행 모드 이름 표시
- [ ] ARM/DISARM → COMMAND_ACK 수신 확인
- [ ] SET_MODE → 모드 전환 확인
- [ ] PARAM_REQUEST_LIST → 파라미터 다운로드 진행률 표시
- [ ] 미션 업로드 (5개 웨이포인트) → ACK 성공

### Phase 3 — 추가 기능 (미정)

- [ ] 비행 궤적 폴리라인 (지도에 GPS 트랙 표시)
- [ ] 배터리/신호 경보 시스템
- [ ] Serial 포트 연결 지원
- [ ] macOS / Windows 패키징

---

## 버전 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| v1.0 | 2026-02-16 | UI 기반 구축 (지도, 계기판, 로그, 차트) |
| v1.1 | 2026-02-17 | Mission 뷰, Parameter 뷰, 미션 업로드 IPC |
| v1.2 | 2026-02-17 | Parameter 노드 ATT P 3축 분리, 포트 분리(remotePort) |
