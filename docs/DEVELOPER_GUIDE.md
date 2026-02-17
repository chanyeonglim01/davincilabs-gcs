# DavinciLabs GCS - Developer Guide

> Technical guide for developers contributing to DavinciLabs Ground Control Station

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Structure](#project-structure)
3. [Architecture Overview](#architecture-overview)
4. [Development Workflow](#development-workflow)
5. [Adding New MAVLink Messages](#adding-new-mavlink-messages)
6. [Adding New Commands](#adding-new-commands)
7. [Adding UI Components](#adding-ui-components)
8. [Testing](#testing)
9. [Debugging](#debugging)
10. [Performance Optimization](#performance-optimization)

---

## Development Environment Setup

### Prerequisites

- **Node.js**: v18+ (download from [nodejs.org](https://nodejs.org/))
- **Code Editor**: VS Code recommended with:
  - Extension: `ES7+ React/Redux/React-Native snippets`
  - Extension: `Prettier - Code formatter`
  - Extension: `ESLint`
- **Git**: For version control
- **pnpm**: Modern package manager

### Initial Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd davincilabs_GCS

# 2. Install pnpm globally
npm install -g pnpm

# 3. Install dependencies
pnpm install

# 4. Verify setup
pnpm typecheck  # TypeScript check
pnpm lint       # ESLint check
pnpm dev        # Start dev server
```

### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

---

## Project Structure

### Directory Tree

```
davincilabs_GCS/
├── src/
│   ├── main/                          # Electron Main Process (Node.js)
│   │   ├── index.ts                  # App entry point, window creation
│   │   ├── mavlink/                  # MAVLink protocol layer
│   │   │   ├── connection.ts        # UDP socket, reconnection logic
│   │   │   ├── parser.ts            # Message parsing (HEARTBEAT, ATTITUDE, etc.)
│   │   │   └── commander.ts         # Command generation (ARM, TAKEOFF, etc.)
│   │   └── ipc/                      # IPC handlers (Main ← → Renderer)
│   │       ├── telemetry.ts         # Telemetry broadcast
│   │       ├── commands.ts          # Command execution
│   │       └── parameters.ts        # Parameter CRUD
│   │
│   ├── preload/                       # Preload Script (security bridge)
│   │   └── index.ts                 # contextBridge: exposes window.mavlink
│   │
│   └── renderer/                      # React UI (Renderer Process)
│       └── src/
│           ├── components/           # React components
│           │   ├── MapOverlay.tsx   # Main layout + map background
│           │   ├── panels/          # Draggable/fixed panels
│           │   │   ├── InstrumentsPanel.tsx
│           │   │   ├── AvionicsPanel.tsx
│           │   │   ├── ChartPanel.tsx
│           │   │   ├── LogPanel.tsx
│           │   │   └── TelemetryPanel.tsx
│           │   ├── map/             # Map components
│           │   │   ├── MapBackground.tsx
│           │   │   └── DroneMarker.tsx
│           │   ├── instruments/     # SVG gauges
│           │   │   ├── AirspeedIndicator.tsx
│           │   │   ├── AltimeterIndicator.tsx
│           │   │   ├── HeadingDial.tsx
│           │   │   ├── VsiIndicator.tsx
│           │   │   └── HorizonIndicator.tsx
│           │   └── builder/         # Parameter builder (React Flow)
│           │       ├── ParameterEditor.tsx
│           │       └── NodeEditor.tsx
│           │
│           ├── hooks/                # Custom React hooks
│           │   ├── useMavlink.ts    # MAVLink IPC hook
│           │   ├── useDraggable.ts  # Draggable panel logic
│           │   └── useCharts.ts     # Chart state
│           │
│           ├── store/                # Zustand state management
│           │   ├── telemetryStore.ts   # Telemetry state
│           │   ├── uiStore.ts         # UI state (panel positions)
│           │   ├── parameterStore.ts   # Parameter cache
│           │   └── logStore.ts        # Log messages
│           │
│           ├── types/                 # TypeScript type definitions
│           │   ├── index.ts          # Main types export
│           │   ├── mavlink.ts        # MAVLink enums (MAV_MODE_FLAG, etc.)
│           │   └── ipc.ts            # IPC channel types
│           │
│           ├── utils/                 # Utility functions
│           │   ├── formatters.ts     # Number/unit formatting
│           │   ├── conversions.ts    # Radian ↔ degree, etc.
│           │   └── validators.ts     # Input validation
│           │
│           ├── assets/                # CSS, images, fonts
│           │   └── gcs.css           # Design system (colors, spacing)
│           │
│           ├── App.tsx               # React root component
│           └── main.tsx              # React entry point
│
├── docs/                              # Documentation
│   ├── PROJECT_OVERVIEW.md           # High-level description
│   ├── TECH_STACK.md                 # Technology choices
│   ├── MAVLINK_PROTOCOL.md           # Protocol reference
│   ├── USER_GUIDE.md                 # End-user documentation
│   ├── IPC_API.md                    # Internal IPC specification
│   └── DEVELOPER_GUIDE.md            # This file
│
├── resources/                         # App resources
│   └── icon.png                      # App icon
│
├── electron.vite.config.ts           # Electron-Vite build config
├── package.json                      # Dependencies, scripts
├── pnpm-workspace.yaml               # Monorepo (single package)
├── tsconfig.json                     # TypeScript config
├── .eslintrc.json                    # ESLint config
└── .gitignore                        # Git ignore rules
```

### Key Files and Their Purposes

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Electron main process entry, window creation, IPC setup |
| `src/main/mavlink/parser.ts` | Parse incoming MAVLink buffers into telemetry/params |
| `src/main/mavlink/commander.ts` | Generate outgoing MAVLink COMMAND_LONG buffers |
| `src/preload/index.ts` | Expose safe API to Renderer via contextBridge |
| `src/renderer/src/App.tsx` | React root component, hooks global listeners |
| `src/renderer/src/components/MapOverlay.tsx` | Main layout, map background, panel orchestration |
| `src/renderer/src/store/telemetryStore.ts` | Zustand store for telemetry state |
| `src/renderer/src/types/index.ts` | TypeScript types (TelemetryData, Command, etc.) |

---

## Architecture Overview

### IPC Communication Flow

```
┌─────────────────────────────────────────────────────────┐
│ Simulink / Real Drone / PX4 SITL (UDP 14551/14550)     │
└──────────────────────┬──────────────────────────────────┘
                       │ MAVLink packets
                       ▼
        ┌──────────────────────────────┐
        │  Main Process (Node.js)      │
        │  - UDP Socket (dgram)        │
        │  - MavlinkParser             │
        │  - MavlinkCommander          │
        │  - IPC Handlers              │
        └────────────────┬─────────────┘
                         │ Electron IPC (contextBridge)
                         ▼
        ┌──────────────────────────────┐
        │  Renderer Process (React UI) │
        │  - Zustand stores            │
        │  - Component tree            │
        │  - Real-time chart updates   │
        └──────────────────────────────┘
```

### State Management

**Zustand stores** (in `src/renderer/src/store/`):

1. **telemetryStore**: `{ attitude, position, velocity, status, heading, throttle }`
2. **uiStore**: `{ panelPositions, visiblePanels }`
3. **parameterStore**: `{ parameters[], paramProgress }`
4. **logStore**: `{ logEntries[], addLog() }`

**Flow**:
```
Main Process MAVLink parser
    ↓
    emit('telemetry', data)
    ↓
IPC channel: 'telemetry-update'
    ↓
React listener (useMavlink hook)
    ↓
Zustand action: telemetryStore.setTelemetry(data)
    ↓
Component rerender (React.memo optimized)
```

### Security Model

- ✅ **Renderer isolation**: No direct Node.js/fs/process access
- ✅ **contextBridge**: Only expose safe IPC methods
- ✅ **Zod validation**: Validate command/param data
- ✅ **No eval()**: TypeScript strict mode prevents unsafe patterns

---

## Development Workflow

### Starting Development

```bash
# Terminal 1: Start development server
pnpm dev

# This starts:
# - Main Process watcher (HMR)
# - Renderer Vite dev server
# - Electron app window
```

### File Watching

- **Main Process** (`src/main/`): Auto-restarts on save
- **Renderer** (`src/renderer/src/`): Hot reload (preserves state)
- **Preload** (`src/preload/`): Requires app reload

### Making Changes

#### Example: Adding a new telemetry field

1. **Type definition** (`src/renderer/src/types/index.ts`):
```typescript
export interface TelemetryData {
  // ... existing fields
  windSpeed?: number  // Add new field
}
```

2. **Parser** (`src/main/mavlink/parser.ts`):
```typescript
private handleSomeNewMessage(packet: Buffer): void {
  const windSpeed = packet.readFloatLE(10)
  this.telemetryState.windSpeed = windSpeed
  this.tryEmitTelemetry()
}
```

3. **Store** (`src/renderer/src/store/telemetryStore.ts`):
```typescript
interface TelemetryStore {
  // ... existing
  windSpeed: number
  setTelemetry: (data: TelemetryData) => void
}
```

4. **Component** (`src/renderer/src/components/panels/TelemetryPanel.tsx`):
```typescript
const windSpeed = useTelemetryStore((s) => s.windSpeed)
return <div>Wind: {windSpeed.toFixed(1)} m/s</div>
```

### Building for Production

```bash
# Full build
pnpm build

# Creates dist/ with optimized output

# Package for platform
pnpm package:mac    # macOS DMG
pnpm package:win    # Windows NSIS
pnpm package:linux  # Linux AppImage
```

---

## Adding New MAVLink Messages

### Step 1: Define Message ID and Structure

Reference [MAVLink specification](https://mavlink.io/en/messages/common.html).

Example: Adding `BATTERY_STATUS` (msgid 147):

```typescript
// In MAVLinkParser.parsePacket()
case 147: // BATTERY_STATUS
  this.handleBatteryStatus(packet)
  break
```

### Step 2: Implement Handler

```typescript
private handleBatteryStatus(packet: Buffer): void {
  const battery_id = packet.readUInt8(10)
  const temperature = packet.readInt16LE(11)  // 0.01°C
  const voltages = []
  for (let i = 0; i < 10; i++) {
    const v = packet.readUInt16LE(13 + i * 2)
    if (v !== 0xFFFF) voltages.push(v / 1000)  // mV → V
  }
  const current = packet.readInt16LE(32)  // cA
  const consumed = packet.readInt32LE(34) // mAh
  const remaining = packet.readInt8(38)   // percent

  // Store in telemetry state
  if (this.telemetryState.status?.battery) {
    this.telemetryState.status.battery.temperature = temperature * 0.01
    this.telemetryState.status.battery.remaining = remaining
  }

  this.tryEmitTelemetry()
}
```

### Step 3: Update Type Definition

```typescript
// src/renderer/src/types/index.ts
export interface BatteryStatus {
  voltage: number      // V
  current: number      // A
  remaining: number    // percent
  temperature?: number // °C
}

export interface TelemetryData {
  // ... existing
  battery?: BatteryStatus
}
```

### Step 4: Update Zustand Store

```typescript
// src/renderer/src/store/telemetryStore.ts
interface TelemetryStore {
  battery: BatteryStatus
  // ...
  setTelemetry: (data: Partial<TelemetryData>) => void
}

const useTelemetryStore = create<TelemetryStore>((set) => ({
  // ...
  setTelemetry: (data) => set((state) => ({
    battery: data.battery || state.battery,
    // ...
  }))
}))
```

### Step 5: Use in Component

```typescript
// src/renderer/src/components/panels/BatteryPanel.tsx
const battery = useTelemetryStore((s) => s.battery)

return (
  <div className="bg-slate-900 p-4 rounded">
    <h3>Battery</h3>
    <p>Voltage: {battery.voltage.toFixed(1)}V</p>
    <p>Current: {battery.current.toFixed(1)}A</p>
    <p>Remaining: {battery.remaining}%</p>
  </div>
)
```

---

## Adding New Commands

### Step 1: Define Command Type

```typescript
// src/renderer/src/types/index.ts
export type CommandType =
  | 'ARM'
  | 'DISARM'
  | 'TAKEOFF'
  | 'LAND'
  | 'RTL'
  | 'HOLD'
  | 'SET_MODE'
  | 'PREFLIGHT_CALIBRATION'  // NEW

export interface Command {
  type: CommandType
  params?: Record<string, unknown>
}
```

### Step 2: Implement Command Handler

```typescript
// src/main/mavlink/commander.ts
case 'PREFLIGHT_CALIBRATION': {
  // MAV_CMD_PREFLIGHT_CALIBRATION = 241
  // param1: Gyro calibration (1 = calibrate)
  const gyroCalib = command.params?.gyro ? 1 : 0
  return createCommandLong(241, gyroCalib, 0, 0, 0, 0, 0, 0)
}
```

### Step 3: Add Command Description

```typescript
// src/main/mavlink/commander.ts
case 'PREFLIGHT_CALIBRATION':
  return 'Preflight calibration'
```

### Step 4: Add UI Button (Optional)

```typescript
// src/renderer/src/components/panels/CommandsPanel.tsx
const handleCalibration = async () => {
  try {
    const result = await window.mavlink.sendCommand({
      type: 'PREFLIGHT_CALIBRATION',
      params: { gyro: true }
    })
    // Show result in UI
  } catch (err) {
    console.error('Command failed:', err)
  }
}

return (
  <button onClick={handleCalibration} className="...">
    Calibrate
  </button>
)
```

---

## Adding UI Components

### Creating a New Panel

Example: Adding a `WindPanel` showing wind vector.

### Step 1: Create Component

```typescript
// src/renderer/src/components/panels/WindPanel.tsx
import React from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

export const WindPanel: React.FC = () => {
  const windSpeed = useTelemetryStore((s) => s.windSpeed)
  const windDirection = useTelemetryStore((s) => s.windDirection)

  return (
    <div className="bg-slate-900 text-gray-100 p-4 rounded shadow-lg">
      <h3 className="text-sm font-bold mb-3">Wind</h3>
      <div className="space-y-2 text-xs">
        <div>Speed: {windSpeed.toFixed(1)} m/s</div>
        <div>Direction: {windDirection.toFixed(0)}°</div>
      </div>
    </div>
  )
}
```

### Step 2: Integrate into MapOverlay

```typescript
// src/renderer/src/components/MapOverlay.tsx
import { WindPanel } from './panels/WindPanel'

export const MapOverlay: React.FC = () => {
  return (
    <div>
      {/* Existing panels */}

      {/* Add WindPanel to left side */}
      <div className="absolute left-2 top-32 z-40">
        <WindPanel />
      </div>
    </div>
  )
}
```

### Step 3: Add Drag Handle (Optional)

For draggable panels, wrap with `useDraggable` hook:

```typescript
import { useDraggable } from '@renderer/hooks/useDraggable'

export const WindPanel: React.FC = () => {
  const { position, ref, isDragging } = useDraggable({
    initialX: 16,
    initialY: 400,
    minX: 0,
    maxX: window.innerWidth - 200
  })

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: position.x, top: position.y }}
      className={`bg-slate-900 text-gray-100 p-4 rounded shadow-lg
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      {/* Content */}
    </div>
  )
}
```

### Style Guidelines

Follow the design system in `src/renderer/src/assets/gcs.css`:

- **Colors**: `#181C14` (bg), `#3C3D37` (border), `#ECDFCC` (text)
- **Fonts**: JetBrains Mono (data), Space Grotesk (labels)
- **Spacing**: 8px grid
- **Shadows**: `shadow-lg` from Tailwind

```typescript
// Example component with design system
<div className="
  bg-[#181C14]           // Primary background
  border border-[#3C3D37] // Border color
  text-[#ECDFCC]         // Primary text
  p-2 m-1                // 8px padding/margin
  rounded shadow-lg      // Corner radius + shadow
  font-mono text-xs      // Monospace, small text
">
  Data Display
</div>
```

---

## Testing

### Unit Tests

```bash
pnpm test:unit
```

**Example test** (`src/main/mavlink/parser.test.ts`):

```typescript
import { MavlinkParser } from './parser'

describe('MavlinkParser', () => {
  it('should parse HEARTBEAT message', () => {
    const parser = new MavlinkParser()

    let heartbeatReceived = false
    parser.on('heartbeat', () => {
      heartbeatReceived = true
    })

    // Construct minimal HEARTBEAT buffer
    const buffer = Buffer.alloc(16)
    buffer.writeUInt8(0xfd, 0)        // Magic
    buffer.writeUInt8(9, 1)            // Payload len
    buffer.writeUInt8(0, 2)            // Incompat flags
    buffer.writeUInt8(0, 3)            // Compat flags
    buffer.writeUInt8(0, 4)            // Seq
    buffer.writeUInt8(1, 5)            // System ID
    buffer.writeUInt8(1, 6)            // Component ID
    buffer.writeUInt8(0, 7)            // Message ID (low)
    buffer.writeUInt8(0, 8)            // Message ID (mid)
    buffer.writeUInt8(0, 9)            // Message ID (high)
    buffer.writeUInt8(0x80, 16)        // Base mode (armed)
    buffer.writeUInt16LE(0, 17)        // Checksum

    parser.parseBuffer(buffer)
    expect(heartbeatReceived).toBe(true)
  })
})
```

### Integration Tests

Test Main ↔ Renderer communication:

```typescript
// tests/integration/ipc.test.ts
describe('IPC Integration', () => {
  it('should send command and receive ACK', async () => {
    // Mock UDP socket
    // Send ARM command via IPC
    // Verify COMMAND_LONG buffer constructed correctly
    // Simulate COMMAND_ACK response
    // Verify UI receives event
  })
})
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/mavlink.test.ts
import { test, expect } from '@playwright/test'

test('full flight sequence', async ({ page }) => {
  await page.goto('http://localhost:5173')

  // Click CONNECT
  await page.click('button:has-text("CONNECT")')

  // Wait for connection
  await expect(page.locator('text=Connected')).toBeVisible()

  // Click ARM
  await page.click('button:has-text("ARM")')
  await expect(page.locator('text=Armed: YES')).toBeVisible()

  // Click TAKEOFF
  await page.click('button:has-text("TAKEOFF")')
  // ... verify altitude increases
})
```

### Running Tests

```bash
pnpm test              # All tests
pnpm test:unit         # Unit only
pnpm test:e2e          # E2E only
pnpm test --watch      # Watch mode
```

---

## Debugging

### VS Code Debugger

**Configuration** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron Main",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
      "args": ["."],
      "cwd": "${workspaceFolder}",
      "outFiles": ["${workspaceFolder}/dist/main/**/*.js"]
    }
  ]
}
```

**Debugging**:
1. Set breakpoints in Main Process code
2. Press F5 to start debugger
3. Debugger pauses at breakpoints

### Console Logging

**Main Process** (`src/main/`):
```typescript
console.log('[MAVLink Parser] Received HEARTBEAT, armed:', armed)
```

**Renderer** (`src/renderer/src/`):
```typescript
console.log('[UI] Telemetry updated:', telemetryData)
```

**View logs**:
- Main: Terminal running `pnpm dev`
- Renderer: DevTools (Ctrl+Shift+I)

### DevTools

Open Electron DevTools:
```
Ctrl+Shift+I (Windows/Linux)
Cmd+Option+I (macOS)
```

**Inspect**:
- React component tree: React DevTools extension
- IPC messages: Network tab (simulated)
- State: Zustand devtools extension

### Debugging MAVLink Protocol

```typescript
// Enable verbose logging in parser.ts
private parsePacket(packet: Buffer): void {
  const msgid = packet.readUInt8(7) | (packet.readUInt8(8) << 8) | (packet.readUInt8(9) << 16)

  console.log(`[MAVLink Debug] msgid=${msgid}, len=${packet.length}`)

  switch (msgid) {
    // ...
  }
}
```

**Packet Inspector** (UDP sniffer):
```bash
# macOS/Linux (requires sudo)
sudo tcpdump -i lo -A 'udp port 14551'

# Windows (requires Wireshark or similar)
```

---

## Performance Optimization

### 1. React Rendering

**Problem**: Components re-render too frequently

**Solution**: Use `React.memo` + memoized selectors

```typescript
// src/renderer/src/components/instruments/AirspeedIndicator.tsx
import React from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

const AirspeedIndicatorComponent: React.FC = () => {
  const airspeed = useTelemetryStore(
    (state) => state.velocity.airspeed,
    // Memoize: only re-render if airspeed changes
    (a, b) => a === b
  )
  return <div>{airspeed.toFixed(1)}</div>
}

export const AirspeedIndicator = React.memo(AirspeedIndicatorComponent)
```

### 2. MAVLink Parsing

**Problem**: Parser spends 30% CPU on every message

**Solution**: Skip unnecessary messages

```typescript
// src/main/mavlink/parser.ts
parsePacket(packet: Buffer): void {
  const msgid = this.extractMessageId(packet)

  // Skip low-priority messages
  if (msgid === DEPRECATED_MSG_ID) {
    this.buffer = this.buffer.subarray(packetLen)
    return
  }

  // Process high-priority messages
  switch (msgid) { /* ... */ }
}
```

### 3. Chart Updates

**Problem**: Charts redraw 60fps even at 30Hz data

**Solution**: Throttle chart refresh

```typescript
// src/renderer/src/hooks/useCharts.ts
import { throttle } from 'lodash-es'

export const useCharts = () => {
  const updateChart = useMemo(
    () => throttle((data) => {
      // Update only every 33ms (30Hz)
      // Even if telemetry updates faster
    }, 33),
    []
  )

  return { updateChart }
}
```

### 4. Panel Rendering

**Problem**: All panels re-render when any data changes

**Solution**: Isolate panel state

```typescript
// src/renderer/src/components/panels/InstrumentsPanel.tsx
const InstrumentsPanelComponent: React.FC = () => {
  // Only select needed data
  const airspeed = useTelemetryStore((s) => s.velocity.airspeed)
  const altitude = useTelemetryStore((s) => s.position.alt)
  // NOT: const state = useTelemetryStore()  ← causes full re-render

  return (/* ... */)
}

export const InstrumentsPanel = React.memo(InstrumentsPanelComponent)
```

### 5. Profiling

**React Profiler** (DevTools → Profiler tab):
1. Record a session
2. Identify slow components (yellow bars)
3. Optimize with React.memo or useMemo

**Node Profiler** (Main Process):
```bash
node --prof src/main/index.ts
node --prof-process isolate-*.log > profile.txt
```

---

## Code Quality

### Linting & Formatting

```bash
# Check code style
pnpm lint

# Auto-fix issues
pnpm lint --fix

# Format with Prettier
pnpm format
```

### Type Checking

```bash
# Check TypeScript types
pnpm typecheck

# Fix common issues
pnpm typecheck --fix
```

### Pre-commit Hooks

Configured in `package.json` (Husky):
```bash
# Automatically runs before commit:
pnpm lint
pnpm typecheck
```

---

## Deployment

### Building for Release

```bash
# Create optimized build
pnpm build

# Package for platforms
pnpm package:mac
pnpm package:win
pnpm package:linux

# Output in dist/release/
```

### Code Signing (macOS)

```json
// electron.vite.config.ts
{
  "build": {
    "appId": "com.davincilabs.gcs",
    "sign": {
      "identity": "Developer ID Application: Your Name"
    }
  }
}
```

### Auto-Update

Configured in `electron-updater` (see `src/main/index.ts`):
```typescript
autoUpdater.checkForUpdatesAndNotify()
```

---

## Common Tasks

### Add a new telemetry field

1. Update type in `src/renderer/src/types/index.ts`
2. Parse in `src/main/mavlink/parser.ts`
3. Store in `src/renderer/src/store/telemetryStore.ts`
4. Display in component

### Add a new command

1. Add command type in `src/renderer/src/types/index.ts`
2. Implement in `src/main/mavlink/commander.ts`
3. Handle in IPC (`src/main/ipc/commands.ts`)
4. Call from UI (`window.mavlink.sendCommand()`)

### Add a new UI component

1. Create in `src/renderer/src/components/`
2. Use Zustand hooks for state
3. Apply design system classes
4. Integrate into `MapOverlay.tsx` or panel
5. Add TypeScript types

### Debug MAVLink messages

1. Enable logging: Uncomment `console.log` in parser
2. Run `pnpm dev`
3. Check console output in terminal
4. Use `tcpdump` to sniff UDP packets (optional)

---

## Resources

- **MAVLink**: https://mavlink.io/en/
- **Electron**: https://www.electronjs.org/docs
- **React**: https://react.dev/
- **Zustand**: https://github.com/pmndrs/zustand
- **Tailwind CSS**: https://tailwindcss.com/docs

---

**Last Updated**: 2026-02-17
**Version**: 1.0
