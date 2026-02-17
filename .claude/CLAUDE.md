# DavinciLabs GCS — Claude Code Instructions

Claude Code가 이 프로젝트에서 코드를 작성할 때 반드시 따라야 할 규칙.

---

## 기술 스택 & 버전

| 영역 | 기술 | 버전 |
|------|------|------|
| Desktop | Electron | 32+ |
| 빌드 | Electron-Vite | 최신 |
| Frontend | React | 18 |
| 언어 | TypeScript | strict mode |
| UI | Tailwind CSS | 유틸리티 클래스 직접 사용 |
| Map | Leaflet + react-leaflet | - |
| Charts | Recharts | - |
| Parameter Graph | @xyflow/react (React Flow) | - |
| State | Zustand | - |
| Protocol | MAVLink v2 | 수동 인코딩 (외부 라이브러리 없음) |
| Socket | Node.js `dgram` | - |
| Storage | electron-store | - |
| Package Manager | pnpm | (npm/yarn 사용 금지) |

---

## 디렉토리 구조

```
src/
├── main/                   # Electron Main Process (Node.js 환경)
│   ├── index.ts            # 앱 진입점, IPC 이벤트 와이어링
│   ├── store.ts            # electron-store (설정 영속화)
│   ├── mavlink/
│   │   ├── connection.ts   # UDP 소켓 관리 (MavlinkConnection class)
│   │   ├── parser.ts       # MAVLink v2 파싱 + EventEmitter
│   │   ├── commander.ts    # COMMAND_LONG 패킷 빌더
│   │   └── mission.ts      # 미션 업로드 상태머신 (MissionUploader class)
│   └── ipc/
│       ├── commands.ts     # mavlink:* invoke 핸들러
│       ├── parameters.ts   # 파라미터 GET/SET 핸들러
│       └── telemetry.ts    # 텔레메트리 IPC 브로드캐스트 유틸
├── preload/
│   ├── index.ts            # contextBridge (window.mavlink API 노출)
│   └── index.d.ts          # window.mavlink 타입 선언
└── renderer/src/
    ├── components/
    │   ├── MapOverlay.tsx   # Main 뷰 루트 (지도 + 패널 오버레이)
    │   ├── MissionView.tsx  # Mission 뷰
    │   ├── Header.tsx       # 탭 전환 + 연결 설정
    │   └── panels/          # 드래그 가능 패널 컴포넌트
    ├── features/builder/
    │   └── ParameterView.tsx  # React Flow 파라미터 에디터
    ├── store/               # Zustand 스토어
    ├── types/               # 공유 TypeScript 타입 (ipc.ts, telemetry.ts)
    ├── hooks/               # 커스텀 훅
    └── assets/gcs.css       # 디자인 시스템 CSS 변수
```

---

## 코딩 규칙

### TypeScript
- `any` 타입 사용 금지 — `unknown` 또는 명시적 타입 사용
- 함수 시그니처에 반드시 타입 명시 (추론에 의존하지 않음)
- `strict: true` 모드 준수
- `import/export` ES 모듈만 사용 (`require` 금지)

### React
- 함수형 컴포넌트만 사용 (클래스 컴포넌트 금지)
- 모든 컴포넌트에 명시적 Props 인터페이스 정의
- `useCallback` / `useMemo` — 이벤트 핸들러와 무거운 계산에만 사용, 남용 금지

### 네이밍
- 파일명: `camelCase.ts`, 컴포넌트: `PascalCase.tsx`
- 변수/함수: `camelCase`
- 타입/인터페이스: `PascalCase`
- 상수: `UPPER_SNAKE_CASE`

### 스타일 (디자인 시스템 — 절대 변경 금지)
```
색상:  #181C14 (배경)  #3C3D37 (패널)  #ECDFCC (텍스트/강조)
       이 3가지 외 다른 색상 사용 금지
폰트:  JetBrains Mono — 수치, 데이터, 코드
       Space Grotesk  — 레이블, UI 텍스트
간격:  패널 간 8px 통일
```

---

## Electron 보안 규칙 (위반 금지)

- `nodeIntegration: false` 유지
- `contextIsolation: true` 유지
- Renderer에서 Node.js API 직접 접근 금지 → `window.mavlink.*`만 사용
- IPC: Renderer→Main은 `ipcRenderer.invoke()`, Main→Renderer는 `webContents.send()`
- 새 IPC 채널 추가 시 `preload/index.ts` + `preload/index.d.ts` + `renderer/src/env.d.ts` 셋 다 업데이트

---

## MAVLink 규칙

### 패킷 구조 (v2)
```
[0]     0xFD (magic)
[1]     payload_len
[2]     incompat_flags
[3]     compat_flags
[4]     seq
[5]     sysid
[6]     compid
[7-9]   msgid (3바이트 LE)
[10+]   payload
[-2:]   CRC-16/MCRF4XX (LE), CRC_EXTRA 포함
```

### GCS 식별자
- GCS SysID: `255`, CompID: `190` (MAV_COMP_ID_MISSIONPLANNER)
- 드론 SysID: `1`, CompID: `1`

### 포트 설정
| 모드 | GCS listen | GCS send (remotePort) |
|------|-----------|----------------------|
| Simulink | 14550 | 14551 |
| PX4 SITL | 14550 | 14580 |

### 파서에 메시지 추가 시 순서
1. `parser.ts` — `parsePacket()` switch에 case 추가, payload offset 확인
2. `MavlinkParserEvents` 인터페이스에 이벤트 추가
3. `main/index.ts` — parser 이벤트 구독 + IPC 브로드캐스트 연결
4. `preload/index.ts` — contextBridge에 노출
5. `preload/index.d.ts` + `renderer/src/env.d.ts` — 타입 선언

---

## UI 수정 규칙

- **소규모 수정** (값, 위치, 색상): 바로 Edit
- **신규 컴포넌트 / 대규모 UI 개편**: `frontend-design` skill 먼저 호출
- 지도 관련 수정: `map.invalidateSize()` 필요 여부 확인
- 패널 z-index: 지도 컨트롤이 1000이므로 패널은 반드시 1100 이상

---

## 개발 명령어

```bash
pnpm dev          # 전체 실행 (권장)
pnpm typecheck    # TypeScript 타입 체크
pnpm lint         # ESLint
pnpm lint --fix   # ESLint 자동 수정
pnpm build        # 빌드
```

---

## 주의사항 (Pitfalls)

- **MAVLink payload offset**: header 10바이트 이후부터 payload 시작. offset=10이 payload 첫 번째 바이트
- **CRC_EXTRA**: 메시지별 고유값. 틀리면 드론이 패킷 무시 (HEARTBEAT=50, COMMAND_LONG=152, PARAM_SET=168 등)
- **IPC 직렬화**: 함수, DOM 노드, Buffer는 IPC로 전송 불가. Buffer는 `Uint8Array`로 변환
- **Electron IPC 메모리 누수**: `ipcRenderer.on()` 리스너는 컴포넌트 unmount 시 반드시 `removeListener()`로 해제
- **pnpm 전용**: `npm install` 또는 `yarn add` 사용 금지
- **별도 git repo**: `davincilabs_GCS/`는 `chanyeonglim01/davincilabs-gcs` 독립 repo. 커밋은 이 폴더 안에서
