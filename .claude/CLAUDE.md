# DavinciLabs GCS - Claude Code Instructions

> 모든 에이전트가 자동으로 로드하는 프로젝트 컨텍스트

## 프로젝트 개요

**Electron 기반 크로스 플랫폼 Ground Control Station**

- Simulink UAM 시뮬레이션 및 실제 드론과 MAVLink v2 프로토콜 통신
- React + TypeScript + Tailwind CSS + shadcn/ui
- 실시간 텔레메트리 대시보드 + 파라미터 빌더

## 기술 스택

### Desktop

- Electron 32+ (Main Process + Renderer Process)
- Electron-Vite (빌드 도구)

### Frontend (Renderer)

- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Leaflet (맵), Recharts + D3.js (차트), React Flow (파라미터 빌더)
- Zustand (상태 관리)

### Backend (Main Process)

- Node.js (Electron 내장)
- mavlink.js (node-mavlink) - MAVLink v2 파싱
- UDP Socket (dgram 모듈)
- electron-store (설정 저장)

## 디렉토리 구조

```
davincilabs_GCS/
├── src/
│   ├── main/                  # Electron Main Process (Node.js)
│   │   ├── index.ts           # 앱 진입점
│   │   ├── mavlink/           # MAVLink UDP 통신
│   │   │   ├── connection.ts # UDP 소켓 관리
│   │   │   ├── parser.ts     # 메시지 파싱
│   │   │   └── commander.ts  # 명령 전송
│   │   └── ipc/               # IPC 핸들러
│   │       ├── telemetry.ts  # 텔레메트리 브로드캐스트
│   │       ├── commands.ts   # 명령 수신
│   │       └── parameters.ts # 파라미터 CRUD
│   ├── preload/               # Preload Script
│   │   └── index.ts           # contextBridge (보안 IPC)
│   └── renderer/              # React UI
│       └── src/
│           ├── components/    # UI 컴포넌트
│           ├── features/      # 기능 모듈
│           ├── store/         # Zustand 스토어
│           ├── types/         # TypeScript 타입 정의
│           └── hooks/         # 커스텀 훅
├── docs/                      # 프로젝트 문서
└── resources/                 # 앱 리소스 (아이콘 등)
```

## 에이전트 역할 및 파일 소유권

### Agent 1 (Foundation/Architect) - Opus

**소유 파일**:

- `src/renderer/src/types/**` (모든 TypeScript 타입)
- `docs/IPC_API.md` (IPC 계약 문서)
- `electron.vite.config.ts`, `package.json`

**책임**: 프로젝트 구조, 타입 정의, 다른 에이전트 블로킹 해제

### Agent 2 (MAVLink Backend) - Sonnet

**소유 파일**:

- `src/main/**` (Main Process 전체)
- `src/preload/**` (Preload Script)

**책임**: MAVLink UDP 통신, IPC 핸들러, contextBridge

### Agent 3 (Dashboard Frontend) - Sonnet

**소유 파일**:

- `src/renderer/src/components/**` (Dashboard 컴포넌트)
- `src/renderer/src/store/telemetryStore.ts`
- `src/renderer/src/hooks/useMavlink.ts`

**책임**: 자세 차트, Avionics, Compass, 맵, Status Console

### Agent 4 (Parameter Builder) - Sonnet

**소유 파일**:

- `src/renderer/src/features/builder/**` (Builder 전체)
- `src/renderer/src/store/builderStore.ts`

**책임**: React Flow 노드 에디터, 파라미터 CRUD

### Agent 5 (Documentation) - Haiku

**소유 파일**:

- `docs/**` (IPC_API.md 제외)

**책임**: API 문서, 사용자 가이드, 개발자 가이드

### Agent 6 (QA Engineer) - Sonnet

**소유 파일**:

- `tests/**`
- `.eslintrc.json`, `vitest.config.ts`

**책임**: 린트, 타입 체크, 유닛/통합/E2E 테스트

## MAVLink 통신 사양

### Simulink 모드

- **포트**: UDP 14551 (localhost)
- **System ID**: 1, **Component ID**: 1
- **참조**: `../simulink/utilities/mavlink/mavlinkGCS_sfunc.m`

### 실제 드론 모드

- **포트**: UDP/TCP/Serial (설정 가능)
- **System/Component ID**: 사용자 지정

### 주요 메시지

- **수신**: `HEARTBEAT`, `ATTITUDE`, `GLOBAL_POSITION_INT`, `VFR_HUD`, `SYS_STATUS`, `PARAM_VALUE`
- **전송**: `COMMAND_LONG` (ARM, TAKEOFF, LAND), `PARAM_REQUEST_LIST`, `PARAM_SET`

## 개발 워크플로우

### 개발 서버 실행

```bash
pnpm dev              # 모든 프로세스 동시 실행 (권장)
pnpm dev:main         # Main Process (watch)
pnpm dev:renderer     # Renderer (Vite dev server)
pnpm dev:electron     # Electron 시작
```

### 테스트

```bash
pnpm test             # 모든 테스트 실행
pnpm test:unit        # 유닛 테스트만
pnpm test:e2e         # E2E 테스트만
pnpm typecheck        # TypeScript 타입 체크
pnpm lint             # ESLint 실행
```

### 빌드 및 패키징

```bash
pnpm build            # 개발 빌드
pnpm package          # 현재 플랫폼 패키징
pnpm package:mac      # macOS DMG
pnpm package:win      # Windows NSIS
```

### Simulink 연동 테스트

```bash
# MATLAB에서 실행
cd ../simulink/utilities/mavlink
matlab -batch "mavlink_mission_test"
```

## 코드 스타일 가이드

### TypeScript

- **ES 모듈 사용**: `import/export` (CommonJS `require` 금지)
- **구조 분해 import**: `import { foo } from 'bar'`
- **타입 명시**: 함수 시그니처에 명시적 타입
- **Strict 모드**: `tsconfig.json`의 `strict: true` 준수

### React

- **함수형 컴포넌트**: 클래스 컴포넌트 사용 금지
- **Hooks**: `useState`, `useEffect` 등 적극 활용
- **Props 타입**: 모든 컴포넌트에 명시적 Props 인터페이스

### 명명 규칙

- **파일명**: camelCase (컴포넌트는 PascalCase.tsx)
- **변수/함수**: camelCase
- **타입/인터페이스**: PascalCase
- **상수**: UPPER_SNAKE_CASE

### Tailwind CSS

- **유틸리티 우선**: 인라인 Tailwind 클래스
- **커스텀 CSS 최소화**: 필요시 `@apply` 사용

## 중요한 규칙

### Electron 보안

- **nodeIntegration**: `false` (필수)
- **contextIsolation**: `true` (필수)
- **sandbox**: `true` (가능하면)
- **Renderer에서 Node.js API 직접 접근 금지**: contextBridge만 사용

### IPC 통신

- **Main → Renderer**: `webContents.send('channel', data)`
- **Renderer → Main**: `ipcRenderer.invoke('channel', data)` (양방향)
- **Renderer → Main**: `ipcRenderer.send('channel', data)` (단방향)
- **타입 안전성**: 모든 IPC 채널에 타입 정의 필수

### 에러 처리

- **try-catch**: 모든 비동기 작업 감싸기
- **에러 로깅**: `console.error` 대신 구조화된 로깅
- **사용자 피드백**: 에러 발생 시 Toast 알림

### 테스트

- **단위 테스트**: 모든 함수/컴포넌트에 테스트 작성
- **통합 테스트**: MAVLink → Main → Renderer 플로우 검증
- **E2E 테스트**: 실제 사용자 시나리오 검증

### Git 커밋

- **커밋 메시지**: 명확하고 설명적으로
- **Co-Authored-By**: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>` 추가
- **커밋 전**: `pnpm lint && pnpm typecheck` 통과 확인

## 자주 사용하는 명령어

```bash
# 새로운 컴포넌트 추가 (shadcn/ui)
npx shadcn@latest add [component-name]

# TypeScript 타입 체크
pnpm typecheck

# ESLint 자동 수정
pnpm lint --fix

# 의존성 설치
pnpm install [package-name]

# 개발 서버 재시작
Ctrl+C (종료) → pnpm dev
```

## 함정 (Pitfalls)

### MAVLink

- **메시지 순서**: MAVLink 메시지는 순서가 보장되지 않음
- **타임아웃**: QGC 타임아웃 1500ms, PX4 타임아웃 5s 고려
- **재시도 로직**: 실패 시 자동 재시도 구현

### Electron IPC

- **메모리 누수**: 이벤트 리스너 해제 필수 (`removeListener`)
- **직렬화**: IPC로 전송 가능한 데이터만 (함수, DOM 노드 불가)

### React

- **무한 루프**: `useEffect` 의존성 배열 주의
- **불필요한 리렌더링**: `React.memo`, `useMemo`, `useCallback` 활용

## 참고 문서

- [Electron 공식 문서](https://www.electronjs.org/docs)
- [MAVLink Protocol](https://mavlink.io/en/)
- [React 공식 문서](https://react.dev/)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [shadcn/ui 문서](https://ui.shadcn.com/)

---

**버전**: v1.0.0
**최종 업데이트**: 2026-02-16
