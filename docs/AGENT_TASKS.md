# 팀 에이전트 태스크 분배 (v2)

## 에이전트 구성 (6명)

### 모델 선택 전략
- **Opus 4.6**: 계획 및 아키텍처 (복잡한 사고)
- **Sonnet 4.5**: 코드 구현, 문서 작성 (기본, 가성비)
- **Haiku 4.5**: 빠른 검증, 테스트 실행

### 병렬 실행 방법
- **Claude Code Task 도구**: 한 메시지에 여러 Task 호출하면 병렬 실행
- **tmux**: 개발 서버 관리용 (선택 사항, 에이전트와 무관)
- **EXPERIMENTAL_AGENT_TEAMS**: 불필요 (Task 도구로 충분)

---

## Agent 1: Architect (Foundation) - Opus

**모델**: `opus`
**담당**: 프로젝트 아키텍처 설계 및 초기 구조
**우선순위**: 최고 (모든 에이전트가 의존)

### 태스크
1. ✅ 프로젝트 문서 작성 (이미 완료)
2. Electron-Vite 프로젝트 초기화
   - `pnpm create @quick-start/electron` 실행
   - 디렉토리 구조 생성 (`src/main`, `src/preload`, `src/renderer`)
3. TypeScript 타입 정의:
   - `src/renderer/src/types/mavlink.ts` (MAVLink 메시지)
   - `src/renderer/src/types/ipc.ts` (IPC 프로토콜)
   - `src/renderer/src/types/telemetry.ts` (텔레메트리 데이터)
4. IPC 계약 (Contract) 문서 작성
   - API 명세 (요청/응답 타입)
5. pnpm workspace 구성
6. ESLint + Prettier 설정
7. 기본 Electron 앱 실행 확인

### 산출물
- `electron.vite.config.ts`
- `package.json`, `tsconfig.json`
- `src/renderer/src/types/*.ts`
- `docs/IPC_API.md` (IPC 계약 문서)
- 실행 가능한 기본 Electron 앱

### 완료 조건
- `pnpm dev` 실행 시 Electron 창 열림
- TypeScript 컴파일 에러 없음
- 다른 에이전트가 타입 import 가능

---

## Agent 2: Backend Engineer (MAVLink) - Sonnet

**모델**: `sonnet`
**담당**: Electron Main Process - MAVLink 통신 및 IPC
**우선순위**: 높음

### 태스크
1. `src/main/mavlink/connection.ts`:
   - UDP 소켓 생성 (dgram 모듈)
   - Simulink 모드 (localhost:14551)
   - 실제 드론 모드 (설정 가능)
   - 연결 상태 관리
2. `src/main/mavlink/parser.ts`:
   - mavlink.js MavLinkPacketSplitter, Parser
   - 메시지 파싱 (HEARTBEAT, ATTITUDE, GLOBAL_POSITION_INT, VFR_HUD, SYS_STATUS)
3. `src/main/mavlink/commander.ts`:
   - 명령 전송 (COMMAND_LONG)
   - ARM/DISARM, TAKEOFF, LAND
4. `src/main/ipc/` 핸들러:
   - **telemetry.ts**: Renderer로 브로드캐스트 (`webContents.send`)
   - **commands.ts**: Renderer에서 명령 수신 (`ipcMain.handle`)
   - **parameters.ts**: PARAM_REQUEST_LIST/SET
5. `src/preload/index.ts`:
   - contextBridge로 `window.mavlink` API 노출
   - 타입 안전 IPC 래퍼
6. electron-store 설정 저장
7. 모드 전환 로직

### 산출물
- `src/main/index.ts`
- `src/main/mavlink/*.ts`
- `src/main/ipc/*.ts`
- `src/preload/index.ts`
- `src/main/store.ts`

### 블로킹 의존성
- Agent 1의 타입 정의 완료 필요

### 테스트
- Simulink `mavlink_mission_test.m` 실행
- Main Process 콘솔에 수신 메시지 로그
- Renderer로 IPC 데이터 전송 확인

---

## Agent 3: Frontend Engineer (Dashboard) - Sonnet

**모델**: `sonnet`
**담당**: React UI - 실시간 텔레메트리 대시보드
**우선순위**: 높음 (Agent 2와 병렬 가능)

### 태스크 (우선순위 순)

#### 1. 프로젝트 초기화
- React + Vite 설정 (이미 electron-vite에 포함)
- Tailwind CSS 설치 및 설정
- shadcn/ui 컴포넌트 설치
- 레이아웃 구성 (헤더, 사이드바, 메인)
- Zustand 스토어 초기화

#### 2. 자세 차트 (Roll/Pitch/Yaw) - **우선순위 1**
- `components/telemetry/AttitudeCharts.tsx`
- Recharts LineChart
- 실시간 업데이트 (30Hz throttle)
- 시간 윈도우 (최근 10초)
- 목표값 vs 실제값 비교

#### 3. Avionics Display + 명령 버튼 - **우선순위 2**
- `components/avionics/FlightModeDisplay.tsx`
- 비행 모드 표시 (STABILIZE, LOITER, AUTO 등)
- `components/avionics/CommandButtons.tsx`
- ARM, DISARM, TAKEOFF, LAND 버튼
- 안전 확인 대화상자 (shadcn Dialog)
- IPC 명령 전송 (`window.mavlink.sendCommand`)

#### 4. Compass + 게이지 - **우선순위 3**
- `components/telemetry/Compass.tsx`
- D3.js 커스텀 Compass (SVG)
- 방향 표시 및 애니메이션
- `components/telemetry/Gauges.tsx`
- Airspeed, Altitude, Vertical Speed 게이지

#### 5. 맵 뷰 - **우선순위 4**
- `components/map/MapView.tsx`
- Leaflet 맵 초기화
- 드론 위치 마커 (실시간 업데이트)
- 비행 경로 히스토리 (Polyline)
- Home 위치 표시

#### 6. Status Console - **우선순위 5**
- `components/console/StatusConsole.tsx`
- 로그 스트림 (가상 스크롤)
- 레벨 필터링 (ERROR, WARN, INFO)

### 산출물
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/**/*.tsx`
- `src/renderer/src/store/telemetryStore.ts`
- `src/renderer/src/hooks/useMavlink.ts`
- Tailwind 설정

### 블로킹 의존성
- Agent 1의 타입 정의 필요
- Agent 2의 IPC API 필요 (통합 테스트)

### 디자인 참고
- 첫 번째 이미지 (다크 테마, 네온 블루/그린)

---

## Agent 4: Frontend Engineer (Builder) - Sonnet

**모델**: `sonnet`
**담당**: React Flow 기반 파라미터 에디터
**우선순위**: 중간 (Dashboard 이후)

### 태스크

#### 1. React Flow 설정
- `features/builder/ParameterBuilder.tsx`
- React Flow 초기화
- 노드 추가/삭제/연결
- Dagre 레이아웃

#### 2. 노드 타입 정의
- `features/builder/nodes/ParameterNode.tsx`
- PID 게인 노드 (Roll_P, Roll_I, Roll_D)
- 제한값 노드 (Max_Speed, Max_Accel)
- 센서 캘리브레이션 노드

#### 3. 컴포넌트 팔레트
- `features/builder/Palette.tsx`
- 드래그앤드롭으로 노드 추가
- 그룹 분류 (Flight Control, Navigation, Safety)

#### 4. 속성 패널
- `features/builder/PropertyPanel.tsx`
- 선택 노드 파라미터 편집
- 실시간 유효성 검사 (범위 체크)

#### 5. 저장/불러오기
- JSON 직렬화
- electron API로 파일 저장

#### 6. MAVLink PARAM 프로토콜
- PARAM_REQUEST_LIST로 드론에서 읽기
- PARAM_SET으로 업로드
- 진행률 표시

### 산출물
- `src/renderer/src/features/builder/**/*.tsx`
- `src/renderer/src/store/builderStore.ts`
- PX4 파라미터 스키마 JSON

### 블로킹 의존성
- Agent 1 타입 정의
- Agent 2 PARAM IPC API

### 디자인 참고
- 두 번째 이미지 (노드 그래프)

---

## Agent 5: Documentation Engineer - Sonnet/Haiku

**모델**: `sonnet` (상세 문서) 또는 `haiku` (빠른 생성)
**담당**: API 문서, 개발 가이드 작성
**우선순위**: 중간

### 태스크

#### 1. IPC API 문서
- `docs/IPC_API.md`
- 모든 IPC 채널 명세
- 요청/응답 예시
- 에러 처리

#### 2. MAVLink 통신 문서
- `docs/MAVLINK_PROTOCOL.md`
- 지원 메시지 목록
- 파싱 로직 설명
- 시퀀스 다이어그램

#### 3. 사용자 가이드
- `docs/USER_GUIDE.md`
- 설치 및 실행
- 기본 사용법
- 트러블슈팅

#### 4. 개발자 가이드
- `docs/DEVELOPER_GUIDE.md`
- 개발 환경 설정
- 코드 구조 설명
- 기여 방법

#### 5. 컴포넌트 API 문서
- `docs/COMPONENT_API.md`
- React 컴포넌트 Props
- 사용 예시

### 산출물
- `docs/IPC_API.md`
- `docs/MAVLINK_PROTOCOL.md`
- `docs/USER_GUIDE.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/COMPONENT_API.md`

### 블로킹 의존성
- Agent 2, 3, 4 코드 완료 후 문서화 가능

---

## Agent 6: QA Engineer (Code Verification) - Sonnet

**모델**: `sonnet`
**담당**: 코드 검증, 테스트, 통합
**우선순위**: 중간~낮음

### 태스크

#### 1. 린트 및 타입 체크
- ESLint 실행 및 에러 수정
- TypeScript 타입 체크
- Prettier 포맷팅

#### 2. 유닛 테스트
- Vitest 설정
- MAVLink 파서 테스트
- IPC 핸들러 테스트
- React 컴포넌트 테스트 (React Testing Library)

#### 3. 통합 테스트
- Simulink → Main → Renderer 전체 플로우
- 명령 전송 테스트 (ARM, TAKEOFF)
- 파라미터 업로드/다운로드

#### 4. E2E 테스트
- Playwright 설정
- 실제 Electron 앱 실행
- UI 인터랙션 테스트
- 스크린샷 비교

#### 5. 성능 프로파일링
- 텔레메트리 업데이트 레이트 측정
- 메모리 누수 확인
- CPU 사용률 모니터링

#### 6. 보안 검증
- electron-builder security 체크
- nodeIntegration: false 확인
- contextIsolation: true 확인

### 산출물
- `tests/unit/**/*.test.ts`
- `tests/integration/**/*.test.ts`
- `tests/e2e/**/*.spec.ts`
- `docs/TEST_REPORT.md`

### 블로킹 의존성
- Agent 2, 3, 4 코드 완료 필요

---

## 타임라인 (6 Agents)

```
Week 1: Foundation & Core
├─ Day 1-2: Agent 1 (Architect) → Electron 초기화 + 타입 정의 [Opus]
├─ Day 3-5: Agent 2 (Backend) + Agent 3 (Dashboard) 병렬 [Sonnet]
│           Agent 5 (Docs) 시작 (IPC API 문서) [Sonnet/Haiku]
└─ Day 6-7: Agent 3 계속, Agent 2 Simulink 테스트
            Agent 6 (QA) 시작 (린트, 타입 체크) [Sonnet/Haiku]

Week 2: Core Features
├─ Day 8-9: Agent 3 (자세 차트 + Avionics)
├─ Day 10-11: Agent 3 (Compass + 맵)
├─ Day 12: Agent 3 (Status Console)
│           Agent 5 (MAVLink 문서)
└─ Day 13-14: Agent 4 (Builder) 시작
              Agent 6 (유닛 테스트)

Week 3: Builder & Testing
├─ Day 15-18: Agent 4 (React Flow 에디터)
├─ Day 19-20: Agent 4 (MAVLink PARAM 통합)
│             Agent 5 (사용자/개발자 가이드)
└─ Day 21: Agent 6 (통합 테스트)

Week 4: Polish & Packaging
├─ Day 22-24: Agent 2 (모드 전환)
│             Agent 6 (E2E 테스트)
├─ Day 25-26: 실제 드론/SITL 테스트
│             Agent 5 (문서 마무리)
└─ Day 27-28: electron-builder 패키징
              전체 QA 완료
```

---

## 병렬 실행 예시

### Agent 1 먼저 실행 (Opus)

```markdown
Agent 1을 Opus 모델로 실행하여 Electron 프로젝트 초기화
```

### Agent 2, 3 병렬 실행 (Sonnet)

```markdown
Agent 1 완료 후, Agent 2와 3을 동시에 Sonnet 모델로 실행
- Agent 2: MAVLink 통신 구현
- Agent 3: Dashboard UI 구현
```

### tmux 사용 (선택 사항, 개발 서버용)

```bash
# tmux 세션 생성
tmux new -s gcs-dev

# 윈도우 1: Electron 개발 서버
pnpm dev

# Ctrl+B c (새 윈도우 생성)
# 윈도우 2: Simulink
cd ../simulink
matlab -batch "run('UAM_Flight_control')"

# Ctrl+B c (새 윈도우 생성)
# 윈도우 3: 로그 모니터링
tail -f ~/.claude/logs/*.log

# 윈도우 전환: Ctrl+B [숫자]
# 세션 종료: exit
```

---

## 에이전트 역할 요약

| Agent | 모델 | 역할 | 블로킹 의존성 |
|-------|------|------|--------------|
| Agent 1 | Opus | 아키텍처 설계 + 타입 정의 | 없음 (최우선) |
| Agent 2 | Sonnet | MAVLink 통신 (Main) | Agent 1 |
| Agent 3 | Sonnet | Dashboard UI (Renderer) | Agent 1, 2 |
| Agent 4 | Sonnet | Parameter Builder (Renderer) | Agent 1, 2 |
| Agent 5 | Sonnet/Haiku | 문서 작성 | Agent 2, 3, 4 |
| Agent 6 | Sonnet/Haiku | 코드 검증 + 테스트 | Agent 2, 3, 4 |

---

## 다음 단계

1. **Agent 1 (Architect) 실행**: Opus 모델로 Electron 프로젝트 초기화
2. **Agent 2, 3 병렬 실행**: Sonnet 모델로 Backend + Frontend 동시 구현
3. **Agent 4, 5, 6 순차 실행**: Dashboard 완료 후 Builder, 문서, QA 진행
