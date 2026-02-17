# IPC API Specification

> Contract between Electron Main Process and Renderer Process

## Overview

All IPC communication uses Electron's `contextBridge` for security. The Renderer never
directly accesses Node.js APIs. Communication flows through typed channels defined in
`src/renderer/src/types/ipc.ts`.

## Architecture

```
Renderer Process                 Preload (contextBridge)         Main Process
─────────────────               ────────────────────────        ──────────────
window.mavlink.sendCommand() -> ipcRenderer.invoke()         -> ipcMain.handle()
                              <- Promise<CommandResult>       <- return result

webContents.send()           <- ipcRenderer.on()             <- MAVLink parser
(telemetry-update)
```

---

## Main -> Renderer (Broadcast)

These channels push data from Main to Renderer via `webContents.send()`.
Renderer listens via `window.mavlink.onXxx(callback)`.

### `telemetry-update`

Aggregated telemetry data broadcast at ~30Hz.

**Payload**: `TelemetryData`

```typescript
{
  attitude: { roll, pitch, yaw, rollspeed, pitchspeed, yawspeed },
  position: { lat, lon, alt, relative_alt },
  velocity: { vx, vy, vz, groundspeed, airspeed, climb },
  status: { armed, flightMode, systemStatus, battery: { voltage, current, remaining }, cpuLoad },
  heading: number,     // degrees 0..360
  throttle: number,    // percent 0..100
  timestamp: number    // ms since epoch
}
```

### `connection-status`

Connection state changes (connect/disconnect/heartbeat timeout).

**Payload**: `ConnectionStatus`

```typescript
{
  connected: boolean,
  mode: 'simulink' | 'real-drone',
  host: string,
  port: number,
  lastHeartbeat: number  // ms since epoch
}
```

### `home-position`

Home position set on first valid GPS fix or explicit command.

**Payload**: `HomePosition`

```typescript
{
  lat: number,   // degrees
  lon: number,   // degrees
  alt: number    // meters
}
```

### `param-value`

Individual parameter received from vehicle.

**Payload**: `ParamEntry`

```typescript
{
  id: string,      // param name (e.g. "MC_ROLL_P")
  value: number,
  type: number,    // MAV_PARAM_TYPE
  index: number
}
```

### `param-progress`

Parameter download progress indicator.

**Payload**: `ParamProgress`

```typescript
{
  received: number,
  total: number
}
```

### `command-ack`

Result of a command sent to the vehicle.

**Payload**: `CommandResult`

```typescript
{
  success: boolean,
  command: CommandType,
  message: string
}
```

### `log-message`

Structured log entry for the Status Console.

**Payload**: `LogEntry`

```typescript
{
  level: 'info' | 'warn' | 'error',
  message: string,
  timestamp: number
}
```

---

## Renderer -> Main (Invoke)

These channels are called from Renderer via `window.mavlink.xxx()`.
Main Process handles via `ipcMain.handle()` and returns a Promise.

### `mavlink:connect`

Establish MAVLink connection.

**Request**: `ConnectionConfig`

```typescript
{
  mode: 'simulink' | 'real-drone',
  host: '127.0.0.1',
  port: 14551,
  sysid: 1,
  compid: 1
}
```

**Response**: `void` (throws on error)

### `mavlink:disconnect`

Close the active MAVLink connection.

**Request**: `void`
**Response**: `void`

### `mavlink:send-command`

Send a command to the vehicle.

**Request**: `Command`

```typescript
{
  type: 'ARM' | 'DISARM' | 'TAKEOFF' | 'LAND' | 'RTL' | 'HOLD' | 'SET_MODE',
  params?: {
    altitude?: number,   // meters (TAKEOFF)
    mode?: string         // mode name (SET_MODE)
  }
}
```

**Response**: `CommandResult`

```typescript
{
  success: boolean,
  command: 'ARM',
  message: 'Command accepted'
}
```

### `mavlink:request-params`

Request all parameters from the vehicle (PARAM_REQUEST_LIST).

**Request**: `void`
**Response**: `void` (parameters arrive asynchronously via `param-value` and `param-progress` channels)

### `mavlink:set-param`

Set a single parameter on the vehicle.

**Request**: `ParamEntry`

```typescript
{
  id: 'MC_ROLL_P',
  value: 6.5,
  type: 9,    // MAV_PARAM_TYPE_REAL32
  index: 0
}
```

**Response**: `void` (acknowledgement arrives via `param-value` channel)

### `mavlink:get-connection-status`

Get the current connection status synchronously.

**Request**: `void`
**Response**: `ConnectionStatus`

---

## Preload API (window.mavlink)

The preload script exposes the following typed API on `window.mavlink`:

```typescript
interface MavlinkAPI {
  // Invoke (Renderer -> Main, returns Promise)
  connect(config: ConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  sendCommand(command: Command): Promise<CommandResult>
  requestParams(): Promise<void>
  setParam(param: ParamEntry): Promise<void>
  getConnectionStatus(): Promise<ConnectionStatus>

  // Listen (Main -> Renderer, callback)
  onTelemetryUpdate(callback: (data: TelemetryData) => void): () => void
  onConnectionStatus(callback: (status: ConnectionStatus) => void): () => void
  onHomePosition(callback: (home: HomePosition) => void): () => void
  onParamValue(callback: (param: ParamEntry) => void): () => void
  onParamProgress(callback: (progress: ParamProgress) => void): () => void
  onCommandAck(callback: (result: CommandResult) => void): () => void
  onLogMessage(callback: (entry: LogEntry) => void): () => void
}
```

Each `onXxx` listener returns a cleanup function to remove the listener.

---

## Error Handling

- All `invoke` calls may throw. Wrap in try-catch.
- Connection errors emit `log-message` with level `'error'`.
- Heartbeat timeout (>3s without heartbeat) sets `connected: false` in `connection-status`.
- Command failures return `{ success: false, message: '...' }` rather than throwing.

---

## Type Imports

```typescript
// From Renderer components:
import type { TelemetryData, ConnectionStatus, Command } from '@renderer/types'

// From Main Process:
// Types are in src/renderer/src/types/ but can be imported via relative paths
```
