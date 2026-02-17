# DavinciLabs GCS

<div align="center">

**Advanced Air Mobility Ground Control System**

Electron 기반 크로스 플랫폼 Ground Control Station for UAM Simulation & Real Drone

[Getting Started](docs/USER_GUIDE.md) • [MAVLink Protocol](docs/MAVLINK_PROTOCOL.md) • [Developer Guide](docs/DEVELOPER_GUIDE.md)

</div>

## Features

### Real-time Telemetry Dashboard
- **자세 차트**: Roll/Pitch/Yaw 실시간 Recharts 그래프 (리사이즈 가능)
- **Avionics Display**: 인공수평선 + ARM/DISARM/TAKEOFF/LAND/RTL/HOLD
- **Instruments**: 속도계/고도계/나침반/VSI 커스텀 SVG 계기판
- **Map View**: Leaflet 기반 위성/다크 타일 + 드론 VTOL 마커 + 헤딩 표시
- **Log Console**: INFO/WARN/ERROR 레벨 실시간 로그

### Mission Planning
- 지도 클릭으로 웨이포인트 추가/삭제/드래그 재정렬
- 고도 프로파일 차트 (Recharts)
- MAVLink Mission Protocol 업로드 (CLEAR→COUNT→ITEM_INT→ACK 상태머신)
- 지원 액션: VTOL_TAKEOFF, WAYPOINT, LOITER, VTOL_TRANSITION, VTOL_LAND, RTL, LAND 등

### Visual Parameter Builder
- **React Flow 노드 그래프**: PX4 제어 구조 시각화
- **6열 레이아웃**: AIRFRAME → XY/Z POS → XY/Z VEL → ATT P (Roll/Pitch/Yaw) → RATE PID → LIMITS
- 노드 클릭 → 우측 패널에서 파라미터 편집
- `PARAM_SET` MAVLink 전송으로 드론에 업로드

### Dual Mode Support
- **Simulink 시뮬레이션**: UAM_Flight_control.slx, UDP 14550↔14551
- **PX4 SITL / 실제 드론**: UDP 14550↔14580, remotePort 설정 가능

## Tech Stack

| 영역 | 기술 |
|------|------|
| Desktop | Electron 32 + Electron-Vite |
| Frontend | React 18 + TypeScript |
| UI | Tailwind CSS |
| Map | Leaflet + react-leaflet |
| Charts | Recharts |
| Graph | React Flow (@xyflow/react) |
| State | Zustand |
| Protocol | MAVLink v2 (수동 인코딩/디코딩, CRC-16/MCRF4XX) |
| Socket | Node.js dgram (UDP) |
| Storage | electron-store |
| Package | pnpm |

## Quick Start

```bash
cd davincilabs_GCS
pnpm install
pnpm dev
```

### Prerequisites
- Node.js 20+ LTS
- pnpm 9+

### Build & Package

```bash
pnpm build        # 개발 빌드
pnpm package:mac  # macOS DMG
pnpm package:win  # Windows NSIS
```

## Project Structure

```
davincilabs_GCS/
├── src/
│   ├── main/                      # Electron Main Process
│   │   ├── index.ts               # 앱 진입점, IPC 와이어링
│   │   ├── store.ts               # electron-store 설정
│   │   ├── mavlink/
│   │   │   ├── connection.ts      # UDP 소켓 관리
│   │   │   ├── parser.ts          # MAVLink v2 파싱 + EventEmitter
│   │   │   ├── commander.ts       # COMMAND_LONG 빌더
│   │   │   └── mission.ts         # 미션 업로드 상태머신
│   │   └── ipc/
│   │       ├── commands.ts        # mavlink:* IPC 핸들러
│   │       ├── parameters.ts      # PARAM_REQUEST_LIST / PARAM_SET
│   │       └── telemetry.ts       # 텔레메트리 브로드캐스트
│   ├── preload/
│   │   └── index.ts               # contextBridge (window.mavlink API)
│   └── renderer/src/
│       ├── components/
│       │   ├── MapOverlay.tsx     # Main 뷰 루트 (지도 + 패널 오버레이)
│       │   ├── MissionView.tsx    # Mission 뷰
│       │   ├── Header.tsx         # 탭 전환 + 연결 설정
│       │   └── panels/            # 드래그 가능 패널들
│       ├── features/builder/
│       │   └── ParameterView.tsx  # React Flow 파라미터 에디터
│       ├── store/                 # Zustand 스토어
│       └── types/                 # TypeScript 타입 정의
├── test/
│   └── mission_simulator.mjs     # 미션 업로드 테스트 시뮬레이터
└── docs/                         # 프로젝트 문서
```

## Communication

### 포트 설정

| 모드 | GCS listen | GCS send |
|------|-----------|---------|
| Simulink | 14550 | 14551 |
| PX4 SITL | 14550 | 14580 |
| 실제 드론 | 14550 | 14550 |

Header의 CONNECT 버튼에서 host/port/remotePort 실시간 변경 가능.

### 구현된 MAVLink 메시지

**수신**: HEARTBEAT(0), SYS_STATUS(1), PARAM_VALUE(22), ATTITUDE(30), GLOBAL_POSITION_INT(33), VFR_HUD(74), COMMAND_ACK(77), MISSION_REQUEST(40/51), MISSION_ACK(47)

**송신**: COMMAND_LONG(76) → ARM/DISARM/TAKEOFF/LAND/RTL/HOLD, PARAM_REQUEST_LIST(21), PARAM_SET(23), MISSION_COUNT(44), MISSION_ITEM_INT(73), MISSION_CLEAR_ALL(45)

## 구현 현황 (2026-02-17)

### 완료

| 항목 | 상태 |
|------|------|
| Electron + Vite + TypeScript 기반 | ✅ |
| MAVLink v2 파싱 / COMMAND_LONG 송신 | ✅ |
| UDP 연결 / Heartbeat 모니터링 / 재연결 | ✅ |
| ARM/DISARM/TAKEOFF/LAND/RTL/HOLD | ✅ |
| PARAM_REQUEST_LIST / PARAM_SET | ✅ |
| 미션 업로드 프로토콜 (상태머신) | ✅ |
| IPC contextBridge (window.mavlink) | ✅ |
| Main 뷰 (지도 + 계기판 + 드래그 패널) | ✅ |
| Mission 뷰 (웨이포인트 + 업로드) | ✅ |
| Parameter 뷰 (React Flow 노드 그래프) | ✅ |
| Header CONNECT 버튼 (동적 재연결) | ✅ |

### 미구현 (다음 작업)

| 항목 | 우선순위 |
|------|---------|
| HEARTBEAT custom_mode → flightMode 이름 변환 | 높음 |
| SET_MODE 명령 실제 전송 | 높음 |
| PARAM_VALUE param_count → 다운로드 진행률 표시 | 중간 |
| Connection error → LogPanel 전달 | 중간 |
| PX4 SITL 통합 테스트 | 높음 |

## Mission Simulator (테스트 도구)

```bash
node test/mission_simulator.mjs
# → 드론 역할로 14551 listen, HEARTBEAT 1Hz 송신
# → GCS에서 미션 업로드 시 프로토콜 처리 + 결과 출력
```

## Architecture

```
UDP (14550 listen)
  ↓
[Main Process]
  connection.ts  ← UDP socket
  parser.ts      ← MAVLink v2 decode → EventEmitter
  commander.ts   ← COMMAND_LONG encode
  mission.ts     ← Mission upload state machine
  ipc/           ← IPC handlers
  ↓ contextBridge
[Renderer Process]
  window.mavlink.* API
  Zustand stores → React components
```

## License

MIT License

---

<div align="center">
Made with ❤️ by DavinciLabs
</div>
