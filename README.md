# DavinciLabs GCS

<div align="center">

**Advanced Air Mobility Ground Control System**

Electron 기반 크로스 플랫폼 Ground Control Station for UAM Simulation & Real Drone

[Getting Started](docs/USER_GUIDE.md) • [MAVLink Protocol](docs/MAVLINK_PROTOCOL.md) • [Developer Guide](docs/DEVELOPER_GUIDE.md) • [Architecture](docs/PROJECT_OVERVIEW.md) • [Tech Stack](docs/TECH_STACK.md)

</div>

## ✨ Features

### 🎯 Real-time Telemetry Dashboard

- **자세 차트**: Roll/Pitch/Yaw 실시간 그래프
- **Avionics Display**: 비행 모드 표시 + ARM/TAKEOFF/LAND 명령
- **Compass & 게이지**: D3.js 커스텀 시각화
- **맵 뷰**: Leaflet 기반 GPS 트래킹
- **Status Console**: 시스템 로그 스트림

### 🔧 Visual Parameter Builder

- **React Flow 노드 에디터**: 파라미터 관계 시각화
- **PX4/Simulink 파라미터**: PID 게인, 제한값 관리
- **실시간 검증**: 범위 체크 및 의존성 검사
- **저장/불러오기**: JSON 템플릿

### 🚁 Dual Mode Support

- **Simulink 시뮬레이션**: UAM_Flight_control.slx와 통신
- **실제 드론/PX4 SITL**: UDP/TCP/Serial 연결

## 🛠 Tech Stack

**Desktop**: Electron + Electron-Vite
**Frontend**: React 18 + TypeScript + Vite
**UI**: Tailwind CSS + shadcn/ui
**Map**: Leaflet + react-leaflet
**Charts**: Recharts + D3.js
**Graph Editor**: React Flow
**State**: Zustand

**Backend**: Node.js (Electron Main Process)
**MAVLink**: mavlink.js (node-mavlink)
**Storage**: electron-store

**Package Manager**: pnpm

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ LTS
- pnpm 9+
- MATLAB/Simulink (시뮬레이션 모드)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd davincilabs_GCS

# Install dependencies
pnpm install

# Start development
pnpm dev
```

### Development

```bash
# 모든 프로세스 동시 실행 (권장)
pnpm dev

# 개별 실행 (디버깅)
pnpm dev:main     # Main Process (watch)
pnpm dev:renderer # Renderer (Vite dev server)
pnpm dev:electron # Electron 시작
```

### Build & Package

```bash
# Development build
pnpm build

# Production packaging
pnpm package        # 현재 플랫폼
pnpm package:mac    # macOS (DMG)
pnpm package:win    # Windows (NSIS)
pnpm package:linux  # Linux (AppImage)
```

## 📁 Project Structure

```
davincilabs_GCS/
├── docs/                           # 프로젝트 문서
├── src/
│   ├── main/                       # Electron Main Process
│   │   ├── index.ts
│   │   ├── mavlink/               # MAVLink 통신
│   │   └── ipc/                   # IPC 핸들러
│   ├── preload/                    # Preload Script
│   │   └── index.ts               # contextBridge
│   └── renderer/                   # React UI
│       ├── src/
│       │   ├── components/        # UI 컴포넌트
│       │   ├── features/          # 기능 모듈
│       │   ├── hooks/             # 커스텀 훅
│       │   ├── store/             # Zustand 스토어
│       │   └── types/             # TypeScript 타입
│       └── index.html
├── resources/                      # 앱 리소스
├── electron.vite.config.ts        # Electron-Vite 설정
└── package.json
```

## 🔌 Communication

### Simulink Mode

- **Protocol**: MAVLink v2
- **Connection**: UDP 14551 (localhost)
- **System ID**: 1, **Component ID**: 1

### Real Drone Mode

- **Protocol**: MAVLink v2
- **Connection**: UDP/TCP/Serial (설정 가능)
- **System/Component ID**: 사용자 지정

## 🏗 Architecture

```
┌─────────────────┐                 ┌─────────────────┐
│   Simulink      │ MAVLink v2      │  실제 드론/     │
│ (UAM_Flight)    │ UDP 14551       │  PX4 SITL       │
└────────┬────────┘                 └────────┬────────┘
         │                                   │
         └───────────────┬───────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Electron Main       │
              │  - MAVLink Parser    │
              │  - UDP Socket        │
              └──────────┬───────────┘
                         │ IPC
                         ▼
              ┌──────────────────────┐
              │  Electron Renderer   │
              │  - Dashboard         │
              │  - Parameter Builder │
              └──────────────────────┘
```

## 📊 구현 현황 (2026-02-17)

### 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| **코어 인프라** |  |  |
| Electron + Vite 초기 설정 | ✅ | electron-vite, 자동 빌드 |
| TypeScript 타입 체크 | ✅ | strict mode, 모든 파일 |
| ESLint + Prettier 설정 | ✅ | 자동 포맷팅, pre-commit hooks |
| **MAVLink 통신** |  |  |
| UDP 소켓 연결 | ✅ | dgram 모듈, 자동 재연결 |
| MAVLink v2 파싱 | ✅ | HEARTBEAT, ATTITUDE, GLOBAL_POSITION_INT, VFR_HUD, SYS_STATUS, PARAM_VALUE, COMMAND_ACK |
| COMMAND_LONG 송신 | ✅ | ARM, DISARM, TAKEOFF, LAND, HOLD, RTL, SET_MODE |
| 파라미터 요청 (PARAM_REQUEST_LIST) | ✅ | 목록 다운로드 진행률 표시 |
| Checksum 계산 | ✅ | CRC-16/MCRF4XX with CRC_EXTRA |
| **상태 관리** |  |  |
| Zustand 텔레메트리 스토어 | ✅ | 300 point history, 30Hz throttle |
| UI 상태 스토어 | ✅ | 패널 위치, 열림/닫힘 상태 |
| 파라미터 캐시 스토어 | ✅ | 다운로드 진행률 |
| **UI 컴포넌트** |  |  |
| Header (연결 UI) | ✅ | CONNECT/DISCONNECT, 상태 표시 |
| MapBackground | ✅ | Leaflet, ESRI 위성/CartoDB 다크, 드론 마커, 헤딩 표시 |
| InstrumentsPanel | ✅ | Airspeed / Altitude / Heading / VSI (커스텀 SVG) |
| AvionicsPanel | ✅ | 인공수평선 + ARM/DISARM/TAKEOFF/LAND/RTL/HOLD 버튼 |
| ChartPanel | ✅ | Roll/Pitch/Yaw 3개 차트, 리사이즈, 축 토글 |
| LogPanel | ✅ | INFO/WARN/ERROR 레벨, 컬러 코딩, 리사이즈 |
| TelemetryPanel (STATUS) | ✅ | 위치, 고도, 속도, 배터리, 시스템 상태 |
| 패널 드래그 이동 | ✅ | useDraggable hook, z-index 관리 |
| 패널 리사이즈 | ✅ | 코너 핸들, 최소/최대 크기 제한 |
| 패널 collapse 토글 | ✅ | 모든 패널 |
| **문서** |  |  |
| MAVLINK_PROTOCOL.md | ✅ | 7개 메시지, 7개 명령, 바이너리 구조 상세 |
| USER_GUIDE.md | ✅ | 설치, 실행, 사용법, 8가지 문제 해결 |
| DEVELOPER_GUIDE.md | ✅ | 개발 환경, 구조, 추가 방법, 테스트/디버깅 |
| PROJECT_OVERVIEW.md | ✅ | 기존 |
| TECH_STACK.md | ✅ | 기존 |
| IPC_API.md | ✅ | 기존 |

### 진행 중

| 항목 | 담당 에이전트 | 예정 |
|------|-------------|------|
| CONNECT 버튼 동적 연결 (포트/호스트 변경) | Agent 2 | 2026-02-18 |
| Parameter Builder (React Flow) 기초 | Agent 4 | 2026-02-18 |
| QA: 린트, 타입체크, 테스트 | Agent 6 | 2026-02-18 |

### 미구현 (예정)

| 항목 | 우선순위 | 추정 난도 |
|------|---------|---------|
| COM/Serial 실제 통신 | 중간 | 중간 |
| 지도 비행 궤적 표시 (Polyline) | 중간 | 낮음 |
| Parameter Builder 완성 (PARAM_SET) | 높음 | 중간 |
| 미션 플래닝 / 웨이포인트 업로드 | 중간 | 높음 |
| 경보 시스템 (배터리/신호) | 낮음 | 낮음 |
| macOS/Windows 패키징 | 낮음 | 낮음 |

## 👥 Team Agents

병렬 개발을 위한 4개 에이전트:

- **Agent 1**: 문서 및 아키텍처 (Foundation)
- **Agent 2**: MAVLink 통신 (Main Process)
- **Agent 3**: Frontend Dashboard (Renderer)
- **Agent 4**: Parameter Builder

자세한 내용은 [AGENT_TASKS.md](docs/AGENT_TASKS.md) 참조

## 📝 Roadmap

- [x] 프로젝트 구조 및 문서
- [x] Electron-Vite 프로젝트 초기화
- [x] MAVLink UDP 통신
- [x] Dashboard UI (계기판, Avionics, 차트, 지도, 로그, STATUS)
- [ ] CONNECT 버튼 동적 연결
- [ ] Parameter Builder (React Flow)
- [ ] 미션 플래닝
- [ ] macOS/Windows 패키징

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [QGroundControl](https://github.com/mavlink/qgroundcontrol)
- [MAVLink Protocol](https://mavlink.io/en/)
- [PX4 Autopilot](https://px4.io/)
- [Electron](https://www.electronjs.org/)

---

<div align="center">
Made with ❤️ by DavinciLabs
</div>
