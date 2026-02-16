# 팀 에이전트 태스크 분배

## 병렬 개발 전략

4개 에이전트가 독립적으로 작업하며, **Agent 1**이 기본 구조를 만든 후 나머지 에이전트가 병렬로 개발합니다.

## Agent 1: 문서 및 아키텍처 (Foundation)

**담당**: 프로젝트 초기 구조 및 문서화
**우선순위**: 최고 (다른 에이전트가 의존)

### 태스크
1. ✅ 프로젝트 문서 작성 (PROJECT_OVERVIEW.md, TECH_STACK.md)
2. Electron-Vite 프로젝트 초기화
3. 디렉토리 구조 생성 (`src/main`, `src/preload`, `src/renderer`)
4. Git 저장소 초기화 및 `.gitignore` 설정
5. TypeScript 공통 타입 정의 (`src/renderer/src/types/`)
   - MAVLink 메시지 타입
   - IPC 프로토콜 인터페이스
   - 텔레메트리 데이터 타입
6. pnpm workspace 구성
7. ESLint + Prettier 설정
8. 기본 Electron 앱 실행 확인

### 산출물
- `docs/PROJECT_OVERVIEW.md` ✅
- `docs/TECH_STACK.md`
- `docs/AGENT_TASKS.md` ✅
- `electron.vite.config.ts`
- `package.json`, `pnpm-workspace.yaml`
- `src/renderer/src/types/mavlink.ts`
- `src/renderer/src/types/ipc.ts`
- `.gitignore`, `README.md`
- 실행 가능한 기본 Electron 앱

### 블로킹 의존성
없음 (최우선 실행)

---

## Agent 2: MAVLink 통신 (Main Process)

**담당**: Electron Main Process - MAVLink UDP 통신 및 IPC 브리지
**우선순위**: 높음

### 태스크
1. `src/main/mavlink/` 구현:
   - **connection.ts**: UDP 소켓 생성 및 관리
     - Simulink 모드 (localhost:14551)
     - 실제 드론 모드 (설정 가능)
     - 연결 상태 관리
   - **parser.ts**: mavlink.js로 메시지 파싱
     - HEARTBEAT, ATTITUDE, GLOBAL_POSITION_INT
     - VFR_HUD, SYS_STATUS, PARAM_VALUE
   - **commander.ts**: 명령 전송
     - ARM/DISARM (COMMAND_LONG)
     - TAKEOFF, LAND
     - PARAM_REQUEST_LIST, PARAM_SET
2. `src/main/ipc/` IPC 핸들러:
   - **telemetry.ts**: 텔레메트리 브로드캐스트
   - **commands.ts**: 명령 수신 및 MAVLink 전송
   - **parameters.ts**: 파라미터 CRUD
3. `src/preload/index.ts`: contextBridge 구성
   - `window.mavlink` API 노출
   - 타입 안전 IPC 래퍼
4. electron-store 설정 저장
5. 모드 전환 로직

### 산출물
- `src/main/index.ts`
- `src/main/mavlink/connection.ts`
- `src/main/mavlink/parser.ts`
- `src/main/mavlink/commander.ts`
- `src/main/ipc/telemetry.ts`
- `src/main/ipc/commands.ts`
- `src/main/ipc/parameters.ts`
- `src/preload/index.ts`
- `src/main/store.ts`

### 블로킹 의존성
- Agent 1의 타입 정의 완료 필요

### 테스트
- Simulink `mavlink_mission_test.m` 실행
- Main Process가 메시지 수신 확인
- IPC로 Renderer에 데이터 전송 확인 (콘솔 로그)

---

## Agent 3: Frontend Dashboard (Renderer)

**담당**: React UI - 실시간 텔레메트리 대시보드
**우선순위**: 높음 (Agent 2와 병렬 가능)

### 태스크 (우선순위 순)

#### 1. 프로젝트 초기화
- `src/renderer/` React + Vite 설정
- Tailwind CSS + shadcn/ui 설치
- 레이아웃 구성 (헤더, 사이드바, 메인)
- Zustand 스토어 초기화

#### 2. 자세 차트 (Roll/Pitch/Yaw) - 우선순위 1
- `components/telemetry/AttitudeCharts.tsx`
- Recharts LineChart
- 실시간 업데이트 (30Hz)
- 시간 윈도우 (최근 10초)
- 목표값 vs 실제값 비교

#### 3. Avionics Display + 명령 버튼 - 우선순위 2
- `components/avionics/FlightModeDisplay.tsx`
- 비행 모드 표시 (STABILIZE, LOITER, AUTO 등)
- `components/avionics/CommandButtons.tsx`
- ARM, DISARM, TAKEOFF, LAND 버튼
- 안전 확인 대화상자 (shadcn/ui Dialog)
- IPC 명령 전송

#### 4. Compass + 게이지 - 우선순위 3
- `components/telemetry/Compass.tsx`
- D3.js 커스텀 Compass (SVG)
- 방향 표시 및 애니메이션
- `components/telemetry/Gauges.tsx`
- Airspeed, Altitude, Vertical Speed 게이지
- 반응형 디자인

#### 5. 맵 뷰 - 우선순위 4
- `components/map/MapView.tsx`
- Leaflet 맵 초기화
- 드론 위치 마커 (실시간 업데이트)
- 비행 경로 히스토리 (Polyline)
- Home 위치 표시
- 맵 타일: OpenStreetMap (무료)

#### 6. Status Console - 우선순위 5
- `components/console/StatusConsole.tsx`
- 로그 스트림 (가상 스크롤)
- 레벨 필터링 (ERROR, WARN, INFO)
- 자동 스크롤 토글

### 산출물
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/layout/Layout.tsx`
- `src/renderer/src/components/telemetry/AttitudeCharts.tsx`
- `src/renderer/src/components/avionics/FlightModeDisplay.tsx`
- `src/renderer/src/components/avionics/CommandButtons.tsx`
- `src/renderer/src/components/telemetry/Compass.tsx`
- `src/renderer/src/components/telemetry/Gauges.tsx`
- `src/renderer/src/components/map/MapView.tsx`
- `src/renderer/src/components/console/StatusConsole.tsx`
- `src/renderer/src/store/telemetryStore.ts`
- `src/renderer/src/hooks/useMavlink.ts`
- Tailwind 설정 파일

### 블로킹 의존성
- Agent 1의 타입 정의 완료 필요
- Agent 2의 IPC API 완료 필요 (통합 테스트)

### 디자인 참고
- 첫 번째 이미지 (DavinciLabs GCS Dashboard)
- 다크 테마, 네온 블루/그린 컬러

---

## Agent 4: Parameter Builder (Renderer)

**담당**: React Flow 기반 파라미터 에디터
**우선순위**: 중간 (Dashboard 이후 시작 가능)

### 태스크

#### 1. React Flow 설정
- `features/builder/ParameterBuilder.tsx`
- React Flow 초기화
- 노드 추가/삭제/연결 로직
- 레이아웃 자동 정렬 (Dagre)

#### 2. 노드 타입 정의
- `features/builder/nodes/ParameterNode.tsx`
- PID 게인 노드 (Roll, Pitch, Yaw)
- 제한값 노드 (속도, 가속도)
- 센서 캘리브레이션 노드
- 커스텀 핸들 (입력/출력)

#### 3. 컴포넌트 팔레트
- `features/builder/Palette.tsx`
- 드래그앤드롭으로 노드 추가
- 그룹별 분류 (Flight Control, Navigation, Safety)
- 검색 기능

#### 4. 속성 패널
- `features/builder/PropertyPanel.tsx`
- 선택된 노드의 파라미터 편집
- 실시간 유효성 검사
- 범위 체크 (min/max)

#### 5. 저장/불러오기
- JSON 직렬화
- 파일 시스템 저장 (electron API)
- 템플릿 라이브러리

#### 6. MAVLink PARAM 프로토콜
- PARAM_REQUEST_LIST로 드론에서 읽기
- PARAM_SET으로 업로드
- 진행률 표시

### 산출물
- `src/renderer/src/features/builder/ParameterBuilder.tsx`
- `src/renderer/src/features/builder/nodes/ParameterNode.tsx`
- `src/renderer/src/features/builder/Palette.tsx`
- `src/renderer/src/features/builder/PropertyPanel.tsx`
- `src/renderer/src/features/builder/validation.ts`
- `src/renderer/src/store/builderStore.ts`
- PX4 파라미터 스키마 JSON

### 블로킹 의존성
- Agent 1의 타입 정의 완료
- Agent 2의 PARAM IPC API 완료

### 디자인 참고
- 두 번째 이미지 (노드 그래프 에디터)
- 다크 테마, 컬러풀한 노드

---

## 타임라인

```
Week 1: Setup & Foundation
├─ Day 1-2: Agent 1 (문서 + Electron 프로젝트 초기화) → 완료 후 다른 에이전트 시작
├─ Day 3-5: Agent 2 (MAVLink Main Process) + Agent 3 (Dashboard UI) 병렬
└─ Day 6-7: Agent 3 계속, Agent 2 Simulink 테스트

Week 2: Core Dashboard Features
├─ Day 8-9: Agent 3 (자세 차트 + Avionics)
├─ Day 10-11: Agent 3 (Compass + 맵)
├─ Day 12: Agent 3 (Status Console)
└─ Day 13-14: Agent 4 (Parameter Builder 시작)

Week 3: Parameter Builder & Integration
├─ Day 15-18: Agent 4 (React Flow 노드 에디터)
├─ Day 19-20: Agent 4 (MAVLink PARAM 통합)
└─ Day 21: 전체 통합 테스트 (Simulink + Dashboard + Builder)

Week 4: Dual Mode & Packaging
├─ Day 22-24: Agent 2 (모드 전환 UI 및 로직)
├─ Day 25-26: 실제 드론/SITL 테스트
└─ Day 27-28: Electron-builder 패키징 및 문서화
```

## 에이전트 간 통신 프로토콜

### 인터페이스 합의 (Day 1-2)
- Agent 1이 `src/renderer/src/types/` 작성
- Agent 2, 3, 4는 공통 타입 import

### 코드 리뷰
- 각 에이전트가 PR 생성
- 다른 에이전트가 리뷰 (타입 호환성, API 계약 체크)

### 통합 테스트
- Agent 2와 3이 먼저 통합 (MAVLink → IPC → UI)
- Agent 4는 독립적으로 개발 후 통합

## 개발 환경

### tmux 세션 관리 (선택 사항)

```bash
# tmux 세션 생성
tmux new -s gcs-dev

# 윈도우 분할
Ctrl+B %  # 수평 분할
Ctrl+B "  # 수직 분할

# 레이아웃 예시
# ┌─────────────┬─────────────┐
# │  Electron   │  Agent 2    │
# │  (pnpm dev) │  (Main)     │
# ├─────────────┼─────────────┤
# │  Agent 3    │  Agent 4    │
# │  (Renderer) │  (Builder)  │
# └─────────────┴─────────────┘

# 세션 종료
exit
```

### 개발 서버 실행
```bash
# 메인 터미널
pnpm dev  # Electron-Vite가 모든 프로세스 자동 관리

# 또는 개별 실행 (디버깅 시)
pnpm dev:main     # Main Process watch
pnpm dev:renderer # Vite dev server
pnpm dev:electron # Electron 실행
```

## 마일스톤

### M1: 기본 통신 확인 (Week 1 종료)
- Simulink → Electron Main → Renderer 메시지 흐름 확인
- 콘솔에 텔레메트리 데이터 출력

### M2: Dashboard 완성 (Week 2 종료)
- 모든 위젯 실시간 업데이트
- 명령 전송 (ARM, TAKEOFF) 동작 확인

### M3: Parameter Builder 완성 (Week 3 종료)
- 파라미터 읽기/쓰기
- 저장/불러오기

### M4: 배포 가능 버전 (Week 4 종료)
- 듀얼 모드 전환
- macOS/Windows 실행 파일
- 문서화 완료
