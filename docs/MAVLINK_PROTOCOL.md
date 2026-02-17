# MAVLink Protocol Specification

> Technical reference for MAVLink v2 message handling in DavinciLabs GCS

## Overview

DavinciLabs GCS communicates with flight controllers (Simulink, PX4, real drones) using **MAVLink v2** protocol over UDP. The protocol is implemented in `src/main/mavlink/parser.ts` and `src/main/mavlink/commander.ts`.

### Protocol Details

- **Version**: MAVLink v2
- **Transport**: UDP (IPv4)
- **Magic Byte**: `0xFD` (v2 identifier)
- **Payload Encoding**: Little-endian binary
- **Checksum**: CRC-16/MCRF4XX with message-specific CRC_EXTRA

## Connection Configuration

### Simulink Mode (Development/Testing)

```
Host:        127.0.0.1
Port:        14551 (GCS receives)
System ID:   1
Component ID: 1
```

**Reference**: `../simulink/utilities/mavlink/mavlinkGCS_sfunc.m`

### Real Drone / PX4 SITL Mode

```
Host:        User-configurable (usually 127.0.0.1 for SITL, drone IP for real)
Port:        User-configurable (default 14550 for PX4, 14551 for GCS)
System ID:   Configurable (default 1)
Component ID: Configurable (default 1)
```

---

## Received Messages (Parser)

The `MavlinkParser` class in `src/main/mavlink/parser.ts` handles incoming MAVLink messages. Each message is identified by a numeric Message ID (`msgid`).

### 1. HEARTBEAT (msgid: 0)

**Purpose**: System health and mode indicator. Transmitted by the vehicle at ~1 Hz.

**Payload Structure** (excerpt):
- Byte 16: `base_mode` (8-bit flags)
- Byte 19: `system_status` (8-bit enum)

**Key Fields**:
- `armed`: Extracted from `base_mode & MAV_MODE_FLAG.SAFETY_ARMED`
  - `0x80` = SAFETY_ARMED flag set
  - Non-zero = motors armed, armed = true
- `systemStatus`: Enumeration mapping
  - `0` = UNINIT (uninitialized)
  - `1` = BOOT (booting)
  - `2` = CALIBRATING
  - `3` = STANDBY (ready to fly)
  - `4` = ACTIVE (flying)
  - `5` = CRITICAL
  - `6` = EMERGENCY
  - `7` = POWEROFF

**Parser Handler**: `handleHeartbeat()`

**Emitted Event**:
```typescript
emit('heartbeat')
emit('telemetry', TelemetryData)  // via tryEmitTelemetry()
```

---

### 2. ATTITUDE (msgid: 30)

**Purpose**: Aircraft attitude (roll, pitch, yaw) and angular velocities.

**Payload Structure**:
- Bytes 14-17: `roll` (float, radians)
- Bytes 18-21: `pitch` (float, radians)
- Bytes 22-25: `yaw` (float, radians)
- Bytes 26-29: `rollspeed` (float, rad/s)
- Bytes 30-33: `pitchspeed` (float, rad/s)
- Bytes 34-37: `yawspeed` (float, rad/s)

**Update in TelemetryData**:
```typescript
telemetryState.attitude = {
  roll,      // radians → displayed as degrees (rad * 180 / π)
  pitch,     // radians → displayed as degrees
  yaw,       // radians → displayed as degrees
  rollspeed, // rad/s
  pitchspeed,
  yawspeed
}
```

**Parser Handler**: `handleAttitude()`

**UI Rendering**: Converted to degrees by ChartPanel and HorizonIndicator

---

### 3. GLOBAL_POSITION_INT (msgid: 33)

**Purpose**: Global position (GPS), altitude, velocity vector.

**Payload Structure**:
- Bytes 14-17: `lat` (int32, 1e-7 degrees)
- Bytes 18-21: `lon` (int32, 1e-7 degrees)
- Bytes 22-25: `alt` (int32, millimeters above MSL)
- Bytes 26-29: `relative_alt` (int32, millimeters above ground)
- Bytes 30-31: `vx` (int16, cm/s, East)
- Bytes 32-33: `vy` (int16, cm/s, North)
- Bytes 34-35: `vz` (int16, cm/s, Down)
- Bytes 36-37: `hdg` (uint16, compass heading in 1/100 degrees)

**Coordinate System Conversions**:
```
lat = lat_int32 / 1e7        // degrees
lon = lon_int32 / 1e7        // degrees
alt = alt_int32 / 1000       // meters
relative_alt = relative_alt_int32 / 1000  // meters
vx = vx_int16 / 100          // m/s
vy = vy_int16 / 100          // m/s
vz = vz_int16 / 100          // m/s
heading = hdg / 100          // degrees
```

**Update in TelemetryData**:
```typescript
telemetryState.position = { lat, lon, alt, relative_alt }
telemetryState.velocity.vx = vx
telemetryState.velocity.vy = vy
telemetryState.velocity.vz = vz
telemetryState.heading = hdg / 100
```

**Home Position Logic**:
- On first valid GPS fix (lat ≠ 0, lon ≠ 0, lat ≠ -1, lon ≠ -1):
  - Set `homePositionSet = true`
  - Emit `'homePosition'` event with coordinates

**Parser Handler**: `handleGlobalPositionInt()`

**UI Rendering**: Map marker position, altitude/position displays

---

### 4. VFR_HUD (msgid: 74)

**Purpose**: Vehicle flying data (airspeed, ground speed, throttle, climb rate).

**Payload Structure**:
- Bytes 10-13: `airspeed` (float, m/s)
- Bytes 14-17: `groundspeed` (float, m/s)
- Bytes 18-19: `heading` (int16, degrees, 0-360) — **Note**: Already set by GLOBAL_POSITION_INT
- Bytes 20-21: `throttle` (uint16, 0-100 percent)
- Bytes 22-25: `alt` (float, altitude) — **Note**: Already set by GLOBAL_POSITION_INT
- Bytes 26-29: `climb` (float, m/s)

**Update in TelemetryData**:
```typescript
telemetryState.velocity.airspeed = airspeed
telemetryState.velocity.groundspeed = groundspeed
telemetryState.velocity.climb = climb
telemetryState.throttle = throttle  // 0-100
```

**Parser Handler**: `handleVfrHud()`

**UI Rendering**: Airspeed indicator, vertical speed indicator, throttle bar

---

### 5. SYS_STATUS (msgid: 1)

**Purpose**: System status (battery, power, load).

**Payload Structure**:
- Bytes 26-27: `load` (uint16, 0-1000, total CPU load in 10%)
- Bytes 28-29: `voltage_battery` (uint16, millivolts)
- Bytes 30-31: `current_battery` (int16, centiamps, 10A = 1000)
- Bytes 42: `battery_remaining` (int8, 0-100 percent, or -1 if unknown)

**Update in TelemetryData**:
```typescript
telemetryState.status.battery = {
  voltage: voltage_battery / 1000,    // volts
  current: current_battery / 100,     // amps
  remaining: battery_remaining        // percent
}
telemetryState.status.cpuLoad = load / 10  // percent
```

**Parser Handler**: `handleSysStatus()`

**UI Rendering**: Battery indicator, CPU load gauge

---

### 6. PARAM_VALUE (msgid: 22)

**Purpose**: Single parameter value response (from PARAM_REQUEST_LIST or PARAM_SET).

**Payload Structure**:
- Bytes 10-13: `param_value` (float, actual parameter value)
- Bytes 14-15: `param_count` (uint16, total parameters available)
- Bytes 16-17: `param_index` (uint16, index of this parameter)
- Byte 18: `param_type` (uint8, MAV_PARAM_TYPE enum)
- Bytes 19-34: `param_id` (char[16], ASCII null-terminated parameter name)

**Enumeration (param_type)**:
- `0` = UINT8
- `1` = INT8
- `2` = UINT16
- `3` = INT16
- `4` = UINT32
- `5` = INT32
- `6` = UINT64
- `7` = INT64
- `8` = FLOAT (32-bit)
- `9` = DOUBLE (64-bit)

**Emitted Event**:
```typescript
emit('paramValue', {
  id: 'MC_ROLL_P',   // parameter name
  value: 6.5,
  type: 9,           // DOUBLE
  index: 145         // position in parameter list
})
```

**Parser Handler**: `handleParamValue()`

**UI Rendering**: Parameter Builder list, real-time parameter download progress

---

### 7. COMMAND_ACK (msgid: 77)

**Purpose**: Acknowledge receipt and execution status of a command.

**Payload Structure**:
- Bytes 10-11: `command` (uint16, MAV_CMD enum of the command being acknowledged)
- Byte 12: `result` (uint8, MAV_RESULT enum)
- Byte 13: `progress` (uint8, 0-100, reserved)
- Bytes 14-17: `result_param2` (float, additional context)
- Bytes 18-19: `target_system` (uint8, ACK sender)
- Byte 20: `target_component` (uint8, ACK sender)

**Result Enumeration (MAV_RESULT)**:
- `0` = ACCEPTED (command accepted, executing)
- `1` = TEMPORARILY_REJECTED (temporary failure, may retry)
- `2` = DENIED (command permanently denied)
- `3` = UNSUPPORTED (command not supported)
- `4` = FAILED (execution failed)
- `5` = IN_PROGRESS (still executing)
- `6` = CANCELLED (command was cancelled)

**Emitted Event**:
```typescript
emit('commandAck', {
  success: true,           // result === ACCEPTED
  command: 'ARM',          // human-readable command name
  message: 'Command accepted'  // human-readable result
})
```

**Parser Handler**: `handleCommandAck()`

**UI Rendering**: Command result toast notification, IPC channel `'command-ack'`

---

## Transmitted Commands (Commander)

The `commander.ts` module generates MAVLink v2 COMMAND_LONG messages. Each command is created with:
- System ID: 255 (GCS)
- Component ID: 190 (MAV_COMP_ID_MISSIONPLANNER)
- Target System: 1 (configurable)
- Target Component: 1 (configurable)

### COMMAND_LONG Message Structure (msgid: 76)

```
Offset  Type        Field
0       uint8       Magic (0xFD)
1       uint8       Payload length (30)
2       uint8       Incompat flags (0)
3       uint8       Compat flags (0)
4       uint8       Sequence
5       uint8       System ID
6       uint8       Component ID
7-9     uint24      Message ID (76)
10-13   float       param1
14-17   float       param2
18-21   float       param3
22-25   float       param4
26-29   float       param5
30-33   float       param6
34-37   float       param7
38-39   uint16      command (MAV_CMD enum)
40      uint8       target_system
41      uint8       target_component
42      uint8       confirmation (0)
43-44   uint16      checksum
```

### 1. ARM Command

**Function**: `commandToBuffer({ type: 'ARM' })`

**MAVLink Command**: MAV_CMD_COMPONENT_ARM_DISARM (400)

**Parameters**:
- param1: `1` (arm)
- Other params: `0`

**Effect**: Arm motors if conditions met (GPS fix, sensors calibrated, etc.)

**Expected ACK**: COMMAND_ACK with result = ACCEPTED

---

### 2. DISARM Command

**Function**: `commandToBuffer({ type: 'DISARM' })`

**MAVLink Command**: MAV_CMD_COMPONENT_ARM_DISARM (400)

**Parameters**:
- param1: `0` (disarm)
- Other params: `0`

**Effect**: Disarm motors immediately

**Expected ACK**: COMMAND_ACK with result = ACCEPTED

---

### 3. TAKEOFF Command

**Function**: `commandToBuffer({ type: 'TAKEOFF', params: { altitude: 10 } })`

**MAVLink Command**: MAV_CMD_NAV_TAKEOFF (22)

**Parameters**:
- param1: `0` (pitch)
- param2: `0`
- param3: `0`
- param4: `0`
- param5: `0`
- param6: `0`
- param7: `altitude` (meters, default 10)

**Preconditions**: Must be ARMED

**Effect**: Takeoff vertically to specified altitude

**Expected ACK**: COMMAND_ACK with result = IN_PROGRESS, then ACCEPTED

---

### 4. LAND Command

**Function**: `commandToBuffer({ type: 'LAND' })`

**MAVLink Command**: MAV_CMD_NAV_LAND (21)

**Parameters**: All `0`

**Effect**: Land at current position

**Expected ACK**: COMMAND_ACK with result = IN_PROGRESS, then ACCEPTED

---

### 5. RETURN-TO-LAUNCH (RTL) Command

**Function**: `commandToBuffer({ type: 'RTL' })`

**MAVLink Command**: MAV_CMD_NAV_RETURN_TO_LAUNCH (20)

**Parameters**: All `0`

**Effect**: Fly back to home position and land

**Preconditions**: Home position must be set (from first GPS fix)

**Expected ACK**: COMMAND_ACK with result = IN_PROGRESS, then ACCEPTED

---

### 6. HOLD Command

**Function**: `commandToBuffer({ type: 'HOLD' })`

**MAVLink Command**: MAV_CMD_DO_PAUSE_CONTINUE (193)

**Parameters**:
- param1: `1` (pause/hold, 0 = continue)
- Other params: `0`

**Effect**: Hold current position (or pause mission)

**Expected ACK**: COMMAND_ACK with result = ACCEPTED

---

### 7. SET_MODE Command

**Function**: `commandToBuffer({ type: 'SET_MODE', params: { mode: 'AUTO' } })`

**MAVLink Command**: MAV_CMD_DO_SET_MODE (176)

**Parameters**:
- param1: Mode number (1 for AUTO, varies by platform)
- Other params: `0`

**Status**: ⚠️ Not fully implemented (placeholder only)

**Note**: Mode setting is complex and platform-specific (PX4 vs ArduPilot). Full implementation deferred.

---

## Parameter Protocol (PARAM_REQUEST_LIST / PARAM_SET)

### Requesting All Parameters

**Command Sequence**:
1. Renderer calls `window.mavlink.requestParams()`
2. Main Process sends `PARAM_REQUEST_LIST` (msgid 21)
3. Vehicle responds with multiple `PARAM_VALUE` messages (one per parameter)
4. Each `PARAM_VALUE` increments progress (index / total)
5. Renderer receives via IPC: `'param-progress'`, `'param-value'`

**Payload (PARAM_REQUEST_LIST, msgid 21)**:
- Bytes 10-11: `param_index` (0xFFFF = request all)
- Bytes 12: `target_system`
- Bytes 13: `target_component`
- Bytes 14-29: `param_id` (reserved, usually empty)

### Setting Single Parameter

**Command Sequence**:
1. Renderer calls `window.mavlink.setParam({ id: 'MC_ROLL_P', value: 6.5, ... })`
2. Main Process sends `PARAM_SET` (msgid 23)
3. Vehicle acknowledges with `PARAM_VALUE` matching the new value
4. Renderer receives via IPC: `'param-value'`

**Payload (PARAM_SET, msgid 23)**:
- Bytes 10-13: `param_value` (float)
- Bytes 14-15: `target_system`
- Bytes 16: `target_component`
- Bytes 17: `param_type` (MAV_PARAM_TYPE enum)
- Bytes 18-33: `param_id` (char[16], name)

---

## Timing & Reliability

### Timeouts

| Operation | Timeout | Retry | Source |
|-----------|---------|-------|--------|
| QGC heartbeat | 1500ms | 5 times | QGC `PlanManager.h` |
| PX4 heartbeat | 5000ms | 250ms retry | PX4 `mavlink_mission.cpp` |
| Mission upload | 30s total | 5 × 1.5s retry | Simulink fix (v2) |
| Parameter request | 5s per param | 3 retries | GCS |

### Simulink-Specific Timing

- **Output rate**: ~2s (heavy model, runs slower than drone)
- **Callback dispatch**: Slow under load (MATLAB event queue)
  - **Fix**: Use `drawnow` + `pause(0.01)` between retries
  - See `/simulink/utilities/mavlink/mavlinkGCS_sfunc.m` for details

---

## Buffer Parsing Details

### Message Sync

The parser scans for magic byte `0xFD` (MAVLink v2 identifier):

```typescript
while (buffer.length > 0) {
  const magicIndex = buffer.indexOf(0xfd)
  if (magicIndex === -1) break

  // Read payload length from byte 1
  const payloadLen = buffer[1]
  const incompatFlags = buffer[2]
  const signatureLen = (incompatFlags & 0x01) !== 0 ? 13 : 0
  const packetLen = 12 + payloadLen + signatureLen

  if (buffer.length < packetLen) break  // Wait for more data

  // Extract and parse packet
  const packet = buffer.subarray(0, packetLen)
  this.parsePacket(packet)
}
```

### Checksum Calculation

CRC-16/MCRF4XX polynomial used:

```
CRC = 0xFFFF
for each byte:
  tmp = byte ^ (CRC & 0xFF)
  tmpShifted = (tmp ^ (tmp << 4)) & 0xFF
  CRC = ((CRC >> 8) ^ (tmpShifted << 8) ^ (tmpShifted << 3) ^ (tmpShifted >> 4)) & 0xFFFF

// Add CRC_EXTRA (message-specific)
CRC_EXTRA = 152 for COMMAND_LONG, varies per message
```

---

## Common Issues & Debugging

### Issue: Telemetry not updating

**Possible causes**:
1. Heartbeat not received → set `connected: false`
2. Message buffer not properly synchronized (lost magic byte)
3. Payload length mismatch → packet discarded

**Debug**:
```typescript
// Enable logging in parser.ts (uncomment)
// console.log(`[MAVLink Parser] Unhandled msgid: ${msgid}`)
// console.log(`[MAVLink] Parsed packet: msgid=${msgid}, len=${payloadLen}`)
```

### Issue: Command ACK not received

**Possible causes**:
1. Checksum invalid
2. Target system/component mismatch
3. Vehicle overloaded (especially Simulink)

**Solutions**:
- Verify GCS sends seq = 0 (some systems ignore sequence)
- Increase retry timeout (1500ms → 3000ms for Simulink)
- Check vehicle logs for rejection reasons

### Issue: Parameters not downloading

**Possible causes**:
1. Vehicle in armed state (some systems block param download)
2. Too many retries causing buffer overrun
3. Parameter count mismatch

**Solutions**:
- Ensure vehicle is disarmed before param request
- Limit parallel requests to 1
- Implement param cache to avoid repeated requests

---

## References

- [MAVLink Protocol Specification](https://mavlink.io/en/)
- [Message ID Reference](https://mavlink.io/en/messages/common.html)
- [QGroundControl PlanManager](https://github.com/mavlink/qgroundcontrol/blob/master/src/Plan/PlanManager.h)
- [PX4 MAVLink Mission Protocol](https://github.com/PX4/PX4-Autopilot/blob/main/src/modules/mavlink/mavlink_mission.cpp)
- [Simulink MAVLink S-Function](../simulink/utilities/mavlink/mavlinkGCS_sfunc.m)

---

**Last Updated**: 2026-02-17
**Document Version**: 1.0
