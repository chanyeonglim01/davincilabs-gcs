# DavinciLabs GCS

**Advanced Air Mobility Ground Control Station**

UAM 드론의 시뮬레이션 개발 및 실제 비행 테스트를 위한 Electron 기반 데스크탑 GCS.
Simulink UAM 모델과 PX4 기반 실제 드론을 하나의 인터페이스로 관제한다.

---

## 주요 기능

### 실시간 텔레메트리 대시보드

MAVLink v2를 통해 수신한 드론 상태를 실시간으로 시각화한다.

- **계기판 패널**: 속도계 / 고도계 / 나침반 / 수직속도계 (커스텀 SVG)
- **Avionics 패널**: 인공수평선 + ARM/DISARM/TAKEOFF/LAND/RTL/HOLD 명령 버튼
- **차트 패널**: Roll/Pitch/Yaw 실시간 그래프 (리사이즈 가능)
- **로그 패널**: INFO / WARN / ERROR 레벨 시스템 메시지
- **Status 패널**: 위치, 속도, 배터리, 비행 모드 수치 표시

모든 패널은 드래그로 위치 조정, 버튼으로 접기/펼치기 가능.

### 지도

- Leaflet 기반 전체화면 지도
- ESRI 위성 / CartoDB 다크 타일 전환
- 드론 위치 마커 (VTOL 아이콘, 헤딩 방향 표시)

### Mission Planning

웨이포인트를 편집하고 MAVLink Mission Protocol로 드론에 업로드한다.

- 지도 클릭으로 웨이포인트 추가
- 목록에서 드래그로 순서 변경, X버튼으로 삭제
- 고도 프로파일 차트 (Recharts)
- 지원 액션: VTOL_TAKEOFF, FW_TAKEOFF, WAYPOINT, LOITER, VTOL_TRANSITION, VTOL_LAND, LAND, RTL
- 업로드: CLEAR_ALL → COUNT → ITEM_INT × N → ACK 상태머신

### Parameter Builder

PX4 제어 구조를 React Flow 노드 그래프로 시각화하고 파라미터를 편집한다.

```
AIRFRAME → XY/Z POS(P) → XY/Z VEL(PID) → ATT P Roll/Pitch/Yaw → RATE PID Roll/Pitch/Yaw → LIMITS
```

- 노드 클릭 → 우측 패널에서 파라미터 값 편집
- 드래그로 노드 이동, 연결선으로 제어 의존성 표시
- PARAM_SET으로 드론에 직접 업로드

### 연결 관리

- Header에서 host / listen port / remote port 실시간 변경
- CONNECT 버튼으로 즉시 재연결
- Heartbeat 3초 타임아웃 감지 → 연결 상태 표시

---

## 아키텍처

```
[드론 / Simulink / PX4 SITL]
         │  MAVLink v2 / UDP
         ▼
[Electron Main Process]
  connection.ts  ← UDP 소켓 바인딩
  parser.ts      ← 패킷 파싱 + EventEmitter
  commander.ts   ← COMMAND_LONG 빌더
  mission.ts     ← 미션 업로드 상태머신
  ipc/           ← IPC 핸들러
         │  contextBridge (window.mavlink)
         ▼
[Electron Renderer — React]
  Zustand stores ← 상태 관리
  Components     ← UI 렌더링
```

IPC 흐름:
- Main → Renderer: `webContents.send('telemetry-update' | 'connection-status' | ...)`
- Renderer → Main: `window.mavlink.sendCommand()` / `uploadMission()` / `setParam()` 등

---

## 연결 설정

| 모드 | GCS listen port | GCS send port (remotePort) |
|------|----------------|--------------------------|
| Simulink | 14550 | 14551 |
| PX4 SITL | 14550 | 14580 |
| 실제 드론 | 14550 | 14550 |

---

## 실행

```bash
cd davincilabs_GCS
pnpm install
pnpm dev
```

**요구사항**: Node.js 20+ LTS, pnpm 9+

```bash
pnpm build         # 빌드
pnpm package:mac   # macOS DMG
pnpm package:win   # Windows NSIS
```

---

## 프로젝트 구조

```
davincilabs_GCS/
├── src/
│   ├── main/                    # Electron Main Process
│   │   ├── index.ts             # 앱 진입점
│   │   ├── store.ts             # 설정 영속화
│   │   ├── mavlink/             # MAVLink 통신 레이어
│   │   └── ipc/                 # IPC 핸들러
│   ├── preload/index.ts         # contextBridge
│   └── renderer/src/
│       ├── components/          # UI 컴포넌트
│       ├── features/builder/    # Parameter 뷰
│       ├── store/               # Zustand 스토어
│       └── types/               # 공유 타입 정의
├── test/
│   └── mission_simulator.mjs   # 미션 업로드 테스트 시뮬레이터
└── docs/                        # 상세 문서
```

---

## 테스트

```bash
# 미션 업로드 프로토콜 테스트 (드론 없이)
node test/mission_simulator.mjs
# → 14551 listen, HEARTBEAT 1Hz 전송
# → GCS에서 UPLOAD MISSION 시 프로토콜 처리 결과 출력
```

---

## 관련 문서

- [진행 현황](PROGRESS.md)
- [MAVLink 프로토콜 명세](docs/MAVLINK_PROTOCOL.md)
- [사용자 가이드](docs/USER_GUIDE.md)
- [개발자 가이드](docs/DEVELOPER_GUIDE.md)

---

MIT © DavinciLabs
