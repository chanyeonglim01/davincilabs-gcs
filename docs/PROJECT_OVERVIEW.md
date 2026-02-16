# DavinciLabs GCS - Advanced Air Mobility Ground Control System

## 프로젝트 개요

Simulink 기반 UAM 시뮬레이션 및 실제 드론과 MAVLink 프로토콜을 통해 통신하는 **Electron 데스크톱** Ground Control Station.

### 핵심 특징
- **Electron 기반**: 크로스 플랫폼 데스크톱 앱 (macOS, Windows, Linux)
- **두 가지 모드**: Simulink 시뮬레이션 ↔ 실제 드론/PX4 SITL 전환 가능
- **현대적 UI**: React + Tailwind CSS로 깔끔하고 직관적인 인터페이스
- **실시간 통신**: MAVLink.js로 고속 텔레메트리 처리

## 목표

1. **실시간 텔레메트리 대시보드**: 드론 상태 실시간 모니터링
2. **파라미터 빌더**: PX4/Simulink 파라미터를 그래프 기반 에디터로 관리
3. **듀얼 모드**: 시뮬레이션과 실제 드론 제어를 하나의 앱에서

## 주요 기능

### Phase 1: 실시간 대시보드 (우선순위 순)

#### 1. 자세 차트 (Roll/Pitch/Yaw)
- Recharts로 실시간 그래프
- 시간대별 데이터 표시
- 목표값 vs 실제값 비교

#### 2. Avionics Display + 명령 버튼
- 현재 비행 모드 표시 (STABILIZE, LOITER, AUTO 등)
- ARM, TAKEOFF, HOLD, LAND 버튼
- 안전 확인 대화상자

#### 3. Compass + 게이지
- D3.js로 커스텀 Compass
- Airspeed, Altitude, Vertical Speed 게이지
- 애니메이션 효과

#### 4. 맵 뷰 + 드론 위치
- Leaflet으로 2D 맵 (위성/지형)
- 실시간 GPS 트래킹
- 비행 경로 히스토리
- Home 위치 표시

#### 5. Status Console
- 시스템 로그 스트림
- 에러/경고/정보 레벨 필터링
- 자동 스크롤

### Phase 2: 파라미터 빌더

#### PX4/Simulink 파라미터 관리
- **React Flow 노드 에디터**:
  - PID 게인 (Roll, Pitch, Yaw)
  - 제한값 (최대 속도, 가속도)
  - 센서 캘리브레이션
- **그룹화**: Flight Control, Navigation, Safety
- **실시간 검증**: 범위 체크, 의존성 체크
- **저장/불러오기**: JSON 파일로 템플릿 관리
- **MAVLink PARAM 프로토콜**: 실시간 업로드/다운로드

### Phase 3: 미션 플래닝 (추후)
- Waypoint 편집기
- 미션 시뮬레이션
- 자동 경로 생성

## 기술 스택

### Desktop Framework
- **Electron**: 크로스 플랫폼 데스크톱 (v32+)
- **Electron-Vite**: 빠른 빌드 및 HMR
- **electron-builder**: 패키징 및 배포

### Frontend (Renderer Process)
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**:
  - Tailwind CSS (스타일링)
  - shadcn/ui (컴포넌트)
  - Framer Motion (애니메이션)
- **맵**: Leaflet + react-leaflet
- **실시간 차트**: Recharts (간단), D3.js (커스텀)
- **그래프 에디터**: React Flow
- **상태 관리**: Zustand
- **IPC 통신**: electron IPC (contextBridge)

### Backend (Main Process)
- **Runtime**: Node.js (Electron 내장)
- **MAVLink**: mavlink.js (node-mavlink)
- **통신**:
  - UDP Socket (Simulink/드론과 통신)
  - IPC (Renderer ↔ Main)
- **데이터 저장**: electron-store (설정, 로그)

### Preload Script
- **contextBridge**: 보안 IPC 브리지
- **타입 안정성**: TypeScript

### 개발 도구
- **모노레포**: pnpm workspace
- **코드 품질**: ESLint + Prettier
- **테스트**: Vitest + Playwright
- **Git Hooks**: Husky + lint-staged

## 아키텍처

### 전체 구조

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
              │  (Node.js Process)   │
              │  - MAVLink Parser    │
              │  - UDP Socket        │
              │  - State Manager     │
              └──────────┬───────────┘
                         │ IPC (contextBridge)
                         ▼
              ┌──────────────────────┐
              │  Electron Renderer   │
              │  (React UI)          │
              │  - Dashboard         │
              │  - Parameter Builder │
              │  - Mission Planner   │
              └──────────────────────┘
```

### Electron IPC 통신

```typescript
// Main Process
ipcMain.handle('mavlink:send-command', async (event, command) => {
  // MAVLink 명령 전송
})

ipcMain.on('mavlink:telemetry', (event, data) => {
  // Renderer로 텔레메트리 전송
  mainWindow.webContents.send('telemetry-update', data)
})

// Preload Script (contextBridge)
contextBridge.exposeInMainWorld('mavlink', {
  sendCommand: (cmd) => ipcRenderer.invoke('mavlink:send-command', cmd),
  onTelemetry: (callback) => ipcRenderer.on('telemetry-update', callback)
})

// Renderer Process (React)
window.mavlink.sendCommand({ type: 'ARM' })
window.mavlink.onTelemetry((data) => store.setTelemetry(data))
```

## 두 가지 모드 지원

### 모드 1: Simulink 시뮬레이션
- Simulink `mavlinkGCS_sfunc.m`과 UDP 14551로 통신
- 시뮬레이션 데이터 수신 및 명령 전송
- 개발 및 테스트 용도

### 모드 2: 실제 드론/PX4 SITL
- PX4 SITL, 실제 드론, 또는 다른 MAVLink 시스템과 통신
- UDP/TCP/Serial 포트 지원
- 실제 운용 환경

### 모드 전환
- 설정 메뉴에서 연결 타입 선택
- Main Process에서 UDP 소켓 재초기화
- 연결 상태 UI에 표시

## 디렉토리 구조

```
davincilabs_GCS/
├── docs/                           # 문서
│   ├── PROJECT_OVERVIEW.md
│   ├── TECH_STACK.md
│   ├── AGENT_TASKS.md
│   └── API.md
├── src/
│   ├── main/                       # Electron Main Process
│   │   ├── index.ts               # 앱 진입점
│   │   ├── mavlink/               # MAVLink 통신
│   │   │   ├── connection.ts     # UDP 소켓 관리
│   │   │   ├── parser.ts         # 메시지 파싱
│   │   │   └── commander.ts      # 명령 전송
│   │   ├── ipc/                   # IPC 핸들러
│   │   │   ├── telemetry.ts
│   │   │   ├── parameters.ts
│   │   │   └── commands.ts
│   │   └── store.ts               # electron-store 설정
│   ├── preload/                    # Preload Script
│   │   └── index.ts               # contextBridge
│   └── renderer/                   # React UI
│       ├── src/
│       │   ├── components/        # UI 컴포넌트
│       │   │   ├── map/
│       │   │   ├── telemetry/
│       │   │   ├── avionics/
│       │   │   ├── console/
│       │   │   └── builder/
│       │   ├── features/          # 기능 모듈
│       │   ├── hooks/             # 커스텀 훅
│       │   ├── store/             # Zustand 스토어
│       │   ├── types/             # TypeScript 타입
│       │   ├── utils/             # 유틸리티
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── index.html
│       └── vite.config.ts
├── resources/                      # 앱 리소스
│   ├── icon.png                   # 앱 아이콘
│   └── assets/                    # 이미지, 폰트 등
├── electron.vite.config.ts        # Electron-Vite 설정
├── package.json
├── pnpm-workspace.yaml
└── .gitignore
```

## MAVLink 통신 사양

### Simulink 모드
- **프로토콜**: MAVLink v2
- **연결**: UDP 14551 (localhost)
- **System ID**: 1
- **Component ID**: 1

### 실제 드론 모드
- **프로토콜**: MAVLink v2
- **연결**: UDP/TCP/Serial (설정 가능)
- **System ID**: 사용자 지정
- **Component ID**: 사용자 지정

### 주요 메시지
- **수신**: HEARTBEAT, ATTITUDE, GLOBAL_POSITION_INT, VFR_HUD, SYS_STATUS
- **전송**: COMMAND_LONG (ARM, TAKEOFF, LAND), PARAM_REQUEST_LIST, PARAM_SET

## 개발 로드맵

### Week 1: 프로젝트 셋업
- [ ] 프로젝트 구조 생성 (Electron-Vite)
- [ ] Electron Main + Renderer 분리
- [ ] Preload contextBridge 구성
- [ ] MAVLink UDP 소켓 연결 (기본)
- [ ] IPC 통신 테스트

### Week 2-3: 실시간 대시보드
- [ ] 자세 차트 (Roll/Pitch/Yaw)
- [ ] Avionics Display + 명령 버튼
- [ ] Compass + 게이지 (D3.js)
- [ ] 맵 뷰 (Leaflet)
- [ ] Status Console
- [ ] Simulink 연동 테스트

### Week 4-5: 파라미터 빌더
- [ ] React Flow 노드 에디터
- [ ] PX4 파라미터 목록
- [ ] PARAM_REQUEST_LIST/SET 구현
- [ ] 저장/불러오기
- [ ] 실시간 검증

### Week 6: 듀얼 모드 및 배포
- [ ] 모드 전환 설정 UI
- [ ] 실제 드론/SITL 테스트
- [ ] Electron-builder 패키징
- [ ] macOS/Windows 빌드
- [ ] 문서화

## 팀 에이전트 구성

### Agent 1: 문서 및 아키텍처
- 프로젝트 문서 작성
- Electron-Vite 프로젝트 초기화
- 디렉토리 구조 생성
- Git 저장소 초기화
- TypeScript 타입 정의

### Agent 2: MAVLink 통신 (Main Process)
- MAVLink.js UDP 소켓
- 메시지 파싱 및 라우팅
- 두 가지 모드 지원 (Simulink/실제)
- IPC 브리지 (Main → Renderer)
- 상태 관리 및 캐싱

### Agent 3: Frontend Dashboard (Renderer)
- React + Tailwind CSS 초기화
- 자세 차트 (우선순위 1)
- Avionics + 명령 버튼 (우선순위 2)
- Compass + 게이지 (우선순위 3)
- 맵 뷰 (우선순위 4)
- Status Console
- Zustand 스토어 및 IPC 통신

### Agent 4: Parameter Builder (Renderer)
- React Flow 노드 에디터
- PX4 파라미터 스키마
- CRUD UI
- 저장/불러오기
- 실시간 검증

## 개발 환경 실행

### 개발 모드
```bash
# 모든 프로세스 동시 실행 (권장)
pnpm dev

# 또는 개별 실행
pnpm dev:main     # Main Process (watch)
pnpm dev:renderer # Renderer (Vite dev server)
pnpm dev:electron # Electron 시작
```

### 빌드
```bash
# 개발 빌드
pnpm build

# 프로덕션 패키징
pnpm package:mac
pnpm package:win
pnpm package:linux
```

## 참고 자료

- [Electron 공식 문서](https://www.electronjs.org/docs)
- [Electron-Vite](https://electron-vite.org/)
- [MAVLink Protocol](https://mavlink.io/en/)
- [mavlink.js](https://github.com/mavlink/mavlink-javascript)
- [QGroundControl](https://github.com/mavlink/qgroundcontrol)
