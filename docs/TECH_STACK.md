# 기술 스택 상세

## 왜 Electron인가?

### 장점
- **크로스 플랫폼**: macOS, Windows, Linux 한 번에 지원
- **웹 기술 활용**: React, Tailwind 등 modern frontend stack
- **Node.js 통합**: UDP 소켓, MAVLink 라이브러리 직접 사용 가능
- **풍부한 생태계**: electron-builder, electron-store 등

### 단점 및 대안
- **메모리 사용량**: Chromium 기반이라 무거움
  - 대안: Tauri (Rust + 시스템 WebView) - 하지만 Node.js 라이브러리 사용 불가
- **보안**: Renderer에서 직접 Node.js API 접근 불가
  - 해결: contextBridge로 안전한 IPC

---

## Electron-Vite

### 선택 이유
- Vite의 빠른 HMR (Hot Module Replacement)
- Main/Preload/Renderer 자동 분리 빌드
- TypeScript 네이티브 지원
- Electron 재시작 없이 Main Process 수정 가능 (watch mode)

### 대안
- **Electron-Forge + Webpack**: 전통적, 느림
- **Electron-React-Boilerplate**: 설정 복잡
- **직접 구성**: 시간 소요, 오류 가능성

---

## Frontend (Renderer Process)

### React 18 + TypeScript

**선택 이유:**
- 대규모 커뮤니티 및 라이브러리
- Leaflet, Recharts, React Flow 모두 React 우선 지원
- TypeScript로 타입 안전성

**설정:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true
  }
}
```

---

### Tailwind CSS + shadcn/ui

**Tailwind CSS:**
- 유틸리티 우선 CSS
- 빠른 프로토타이핑
- 일관된 디자인 시스템 (spacing, colors)
- PurgeCSS로 프로덕션 파일 크기 최소화

**shadcn/ui:**
- Radix UI 기반 (접근성 A11y 우수)
- 복사-붙여넣기 방식 (종속성 최소화)
- Tailwind와 완벽 통합
- 다크 모드 네이티브 지원

**컴포넌트:**
- Dialog (명령 확인)
- Select (설정)
- Tabs (Dashboard ↔ Builder 전환)
- Toast (알림)

**대안:**
- Material-UI: 너무 무겁고, Google 디자인 강제
- Ant Design: 중국 기반, 커스터마이징 어려움
- 순수 CSS: 개발 시간 오래 걸림

---

### Leaflet + react-leaflet

**선택 이유:**
- 가볍고 빠른 2D 맵 (50KB gzipped)
- 무료 (Mapbox는 월 50,000 뷰 제한)
- OpenStreetMap 타일 사용
- 플러그인 풍부 (실시간 마커, 경로)

**기능:**
- 드론 위치 마커 (실시간 업데이트)
- 비행 경로 히스토리 (Polyline)
- Home 위치 (별도 아이콘)
- 줌/팬 제어

**대안:**
- Mapbox GL JS: 더 화려하지만 유료
- OpenLayers: 기능 많지만 API 복잡
- Google Maps: 유료, API 키 필요

---

### Recharts + D3.js

**Recharts:**
- React 네이티브, 선언적 API
- Roll/Pitch/Yaw 시간 차트
- 실시간 업데이트 쉬움

**D3.js:**
- 커스텀 시각화 (Compass, 게이지)
- SVG 완벽 제어
- 애니메이션 및 인터랙션

**조합 이유:**
- Recharts: 간단한 차트 (빠른 구현)
- D3: 복잡한 시각화 (유연성)

**대안:**
- Chart.js: React 통합 약함
- ApexCharts: 상업용 라이선스
- Victory: 파일 크기 큼

---

### React Flow

**선택 이유:**
- 파라미터 빌더에 완벽
- 노드 추가/삭제/연결 드래그앤드롭
- 커스텀 노드 타입 정의 가능
- 레이아웃 자동 계산 (Dagre)

**기능:**
- PID 게인 노드
- 제한값 노드
- 연결 관계 표시
- 실시간 검증 시각화

**대안:**
- Cytoscape.js: 복잡한 그래프 분석, UI는 React Flow가 더 나음
- D3 Force Layout: 직접 구현 필요
- GoJS: 상업용 라이선스 필요

---

### Zustand

**선택 이유:**
- Redux보다 간단한 API (보일러플레이트 적음)
- TypeScript 지원 우수
- 미들웨어 (persist, devtools)
- React 외부에서도 사용 가능 (IPC 데이터 저장)

**스토어 구성:**
```typescript
// telemetryStore.ts
interface TelemetryStore {
  attitude: { roll: number; pitch: number; yaw: number }
  position: { lat: number; lon: number; alt: number }
  status: { armed: boolean; flightMode: string }
  updateAttitude: (data) => void
}

const useTelemetryStore = create<TelemetryStore>((set) => ({...}))
```

**대안:**
- Redux Toolkit: 설정 복잡, 오버엔지니어링
- Jotai/Recoil: Atom 기반, 전역 상태 많으면 비효율적
- Context API: 성능 이슈 (많은 업데이트 시)

---

## Backend (Main Process)

### mavlink.js (node-mavlink)

**선택 이유:**
- MAVLink v2 지원
- TypeScript 타입 정의 제공
- UDP/TCP/Serial 모두 지원
- 메시지 파싱 및 생성 간편

**사용 예:**
```typescript
import { MavLinkPacketSplitter, MavLinkPacketParser } from 'node-mavlink'

const splitter = new MavLinkPacketSplitter()
const parser = new MavLinkPacketParser()

socket.on('message', (buffer) => {
  splitter.parseBuffer(buffer)
})

splitter.on('packet', (packet) => {
  const msg = parser.parse(packet)
  console.log(msg.header.msgid, msg.message)
})
```

**대안:**
- pymavlink: Python 전용
- mavlink-router: C++, 복잡
- 직접 구현: 프로토콜 복잡, 시간 소요

---

### electron-store

**선택 이유:**
- 설정 저장 (마지막 연결 모드, 포트 등)
- JSON 기반, 간단한 API
- 암호화 지원 (선택)
- 타입 안전 (TypeScript)

**사용 예:**
```typescript
import Store from 'electron-store'

const store = new Store({
  defaults: {
    connectionMode: 'simulink',
    port: 14551,
    recentFiles: []
  }
})

store.get('connectionMode') // 'simulink'
store.set('connectionMode', 'real-drone')
```

---

## 보안 (Preload Script)

### contextBridge

**왜 필요한가?**
- Electron 보안 모델: Renderer에서 직접 Node.js API 접근 불가
- contextBridge로 안전한 API만 노출

**구조:**
```typescript
// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('mavlink', {
  // 명령 전송 (invoke: 양방향)
  sendCommand: (cmd) => ipcRenderer.invoke('mavlink:send-command', cmd),

  // 텔레메트리 수신 (on: 단방향)
  onTelemetry: (callback) => {
    ipcRenderer.on('telemetry-update', (event, data) => callback(data))
  }
})

// renderer에서 사용
window.mavlink.sendCommand({ type: 'ARM' })
window.mavlink.onTelemetry((data) => console.log(data))
```

**타입 정의:**
```typescript
// renderer/src/types/global.d.ts
declare global {
  interface Window {
    mavlink: {
      sendCommand: (cmd: Command) => Promise<void>
      onTelemetry: (callback: (data: Telemetry) => void) => void
    }
  }
}
```

---

## 개발 도구

### pnpm

**선택 이유:**
- npm보다 2~3배 빠름
- 디스크 공간 절약 (하드링크)
- 엄격한 의존성 관리 (유령 의존성 방지)
- 모노레포 워크스페이스 네이티브

**설정:**
```yaml
# pnpm-workspace.yaml
packages:
  - '.'
```

---

### ESLint + Prettier

**ESLint:**
- TypeScript 린팅
- React 규칙 (hooks, jsx-a11y)
- Electron 보안 규칙

**Prettier:**
- 일관된 코드 포맷
- ESLint와 통합

**설정:**
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ]
}
```

---

### Vitest + Playwright

**Vitest:**
- Vite 네이티브, Jest 호환 API
- TypeScript 네이티브
- 유닛 테스트 (컴포넌트, 유틸)

**Playwright:**
- E2E 테스트 (Electron 앱)
- 브라우저 자동화
- 스크린샷 비교

---

### electron-builder

**선택 이유:**
- 멀티 플랫폼 패키징
- Auto-update 지원
- Code signing (macOS notarization, Windows signature)

**빌드 타겟:**
- macOS: DMG, PKG
- Windows: NSIS installer, portable
- Linux: AppImage, deb, rpm

---

## 성능 최적화

### Frontend
- **React.memo**: 불필요한 리렌더링 방지
- **useMemo/useCallback**: 계산 캐싱
- **Virtual Scrolling**: Status Console (react-window)
- **Web Worker**: 무거운 계산 오프로드 (선택)

### Main Process
- **메시지 필터링**: 불필요한 MAVLink 메시지 무시
- **배칭**: 여러 텔레메트리를 한 번에 IPC 전송
- **Throttle**: 업데이트 빈도 제어 (30Hz)

### IPC
- **구조화된 데이터**: JSON 직렬화 최적화
- **Buffer 사용**: 대용량 데이터 (이미지 등)
- **스트림**: 파일 전송 시

---

## 보안 고려사항

### Electron 보안 체크리스트
- ✅ nodeIntegration: false
- ✅ contextIsolation: true
- ✅ sandbox: true (가능하면)
- ✅ webSecurity: true
- ✅ allowRunningInsecureContent: false

### IPC 검증
- Zod 스키마로 명령 검증
- SQL Injection 방지 (electron-store JSON 기반)
- 파일 경로 검증 (path traversal 방지)

---

## 라이선스

### 오픈소스 라이브러리
- Electron: MIT
- React: MIT
- Tailwind CSS: MIT
- Leaflet: BSD-2-Clause
- Recharts: MIT
- D3.js: ISC
- React Flow: MIT
- mavlink.js: MIT

### 프로젝트 라이선스
- MIT (상업적 사용 가능)
