# SETUP — Windows 개발환경 (DavinciLabs GCS)

윈도우에서 이 GCS 소스를 받아 **수정·실행·빌드**하기 위한 빠른 셋업 가이드.
소스는 완전 크로스플랫폼(Electron + React + TypeScript)이라 윈도우에서 그대로 동작한다. Mac 전용 하드코딩 경로 없음.

> ⚠️ 패키지매니저는 **pnpm 전용**. `npm install` / `yarn` 쓰지 말 것 (lockfile = pnpm v9).

---

## 1. 사전 설치 (1회)

| 도구 | 버전 | 비고 |
|------|------|------|
| **Node.js** | **20 LTS 또는 22 LTS** | [nodejs.org](https://nodejs.org/). ⚠️ Node 18은 너무 낮음(Vite 7가 Node 20.19+/22.12+ 요구) |
| **pnpm** | 9+ | 아래 둘 중 하나 |
| **Git** | 최신 | clone용 |
| VS Code | 권장 | ESLint / Prettier 확장 |

**pnpm 설치** (둘 중 하나):
```powershell
corepack enable          # Node에 내장된 corepack 사용 (권장)
# 또는
npm install -g pnpm
```

---

## 2. 소스 받기 + 설치

```powershell
# clone (또는 받은 zip 압축해제 — lockfile 포함돼 있음)
git clone https://github.com/chanyeonglim01/davincilabs-gcs.git
cd davincilabs-gcs

pnpm install
```

`pnpm install`이 끝에 `electron-builder install-app-deps`(postinstall)를 돌려 네이티브 모듈을 Electron용으로 리빌드한다.

### ⚠️ serialport 빌드 실패 시 (윈도우 유일 함정)
이 프로젝트는 시리얼 연결용으로 `serialport` 네이티브 모듈을 쓴다. 보통 **윈도우 x64 prebuilt 바이너리가 있어 그냥 설치**되지만, Electron 버전과 맞는 prebuilt가 없으면 컴파일로 빠진다. 그때만 아래를 설치:

- **Visual Studio Build Tools** — "Desktop development with C++" 워크로드
  ([download](https://visualstudio.microsoft.com/visual-cpp-build-tools/))
- **Python 3** (node-gyp가 사용)

설치 후 `pnpm install` 재실행.
(시리얼을 안 쓰고 UDP만 테스트할 거면 빌드 실패해도 dev 실행 자체엔 큰 지장 없을 수 있으나, 깔끔히 설치해두는 걸 권장.)

---

## 3. 실행 / 검증

```powershell
pnpm dev          # Electron 개발 실행 (핫리로드)
pnpm typecheck    # node + web 타입 체크
pnpm lint         # ESLint
pnpm test         # Vitest 전체
```

### 드론/Simulink 없이 테스트
GCS는 독립 실행 가능. 14551에서 1Hz HEARTBEAT를 쏘는 시뮬레이터로 미션 프로토콜 등을 테스트:
```powershell
node tests/manual/mission_simulator.mjs
```

---

## 4. 윈도우 설치본 빌드

```powershell
pnpm build:win    # NSIS 설치본 생성 → dist/davincilabs-gcs-<ver>-setup.exe
```

> ❗ 기존 `README.md` / `docs/DEVELOPER_GUIDE.md`에는 `pnpm package:win`이라고 적혀 있으나 **실제 스크립트는 `build:win`** 이다(문서가 오래됨). `build:win` / `build:mac` / `build:linux` 사용.

---

## 5. UDP 포트 (연결 모드)

| 모드 | GCS listen | GCS 송신대상 |
|------|-----------|-------------|
| Simulink | 14550 | 14551 |
| PX4 SITL | 14550 | 14580 |
| 실드론 | 14550 | 14550 |

GCS는 시작 1초 후 자동으로 `127.0.0.1:14550`(Simulink 모드)에 연결 시도. 헤더에서 host/listen/remote 포트를 실시간 변경 가능.

---

## 6. 참고
- `.npmrc`(`shamefully-hoist=true`), `pnpm-lock.yaml`, `electron-builder.yml` 모두 repo에 포함 → 추가 설정 불필요.
- 더 자세한 개발 문서: `docs/DEVELOPER_GUIDE.md`, `docs/IPC_API.md`, `docs/MAVLINK_PROTOCOL.md`, `docs/PROJECT_OVERVIEW.md`.
- 코딩 규칙: `.claude/CLAUDE.md` (수정 금지).
