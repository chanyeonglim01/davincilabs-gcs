# DavinciLabs GCS - User Guide

> Getting started with the DavinciLabs Ground Control Station for UAM flight control

## Table of Contents

1. [Installation](#installation)
2. [Running the Application](#running-the-application)
3. [Basic Usage](#basic-usage)
4. [Connecting to Vehicle](#connecting-to-vehicle)
5. [Monitoring Telemetry](#monitoring-telemetry)
6. [Sending Commands](#sending-commands)
7. [Troubleshooting](#troubleshooting)

---

## Installation

### Prerequisites

- **Node.js**: v18+ (includes npm)
- **pnpm**: Package manager (recommended over npm)
- **Operating System**: macOS, Windows, or Linux

### Install pnpm (if not already installed)

```bash
npm install -g pnpm
```

Or use Homebrew (macOS):
```bash
brew install pnpm
```

### Clone and Setup

```bash
# Navigate to the project
cd davincilabs_GCS

# Install dependencies
pnpm install
```

### Verify Installation

```bash
# Check Node.js version
node --version    # Should be v18 or higher

# Check pnpm version
pnpm --version    # Should be v8 or higher
```

---

## Running the Application

### Development Mode (Recommended for Development)

Start the full development environment with hot-reload:

```bash
pnpm dev
```

This command:
- Starts the Main Process (Node.js) with file watching
- Starts the Renderer (React) with Vite dev server
- Launches the Electron app window
- Enables hot-reload on file changes

**Expected output**:
```
> electron-vite dev
✓ electron vite v2.x.x
  → Main process listening at:  http://127.0.0.1:12912
  → Renderer Process listening at:  http://localhost:5173
⠙ Building...
↓ [preload-script] building...
✓ Renderer build complete. Files written to: /dist/renderer
⠙ Loading electron...
```

### Production Build

Create an optimized build:

```bash
pnpm build
```

Output:
```
dist/
├── main/        # Compiled Main Process
├── preload/     # Compiled Preload Script
└── renderer/    # Compiled React UI
```

### Package for Distribution

Create a standalone executable for your platform:

```bash
# macOS
pnpm package:mac

# Windows
pnpm package:win

# Linux
pnpm package:linux

# Current platform only
pnpm package
```

Packages are created in `/dist/release/`.

---

## Basic Usage

### Application Layout

When you launch DavinciLabs GCS, you'll see:

```
┌─────────────────────────────────────────────────────────┐
│  Header (CONNECT button, status) [Top Fixed]            │
├─────────────────────────────────────────────────────────┤
│                                   │  AvionicsPanel       │
│  Map View                         │  (Horizon, Arm Btn)  │
│  (Leaflet, drone marker)          │  ─────────────────   │
│  [Draggable: Instruments,         │  STATUS Panel       │
│   Charts, Logs]                   │  (Telemetry Data)    │
│                                   │  [Fixed, Flex Col]   │
└─────────────────────────────────────────────────────────┘
```

**Key UI Sections**:

1. **Header** (top, fixed)
   - CONNECT/DISCONNECT button
   - Connection status
   - Vehicle mode display

2. **Map View** (center, full background)
   - Live GPS position (white VTOL marker)
   - Drone heading (orange line from marker)
   - Draggable panels overlay on top

3. **Instruments Panel** (left, draggable)
   - Airspeed indicator
   - Altitude indicator
   - Heading dial
   - Vertical speed indicator

4. **AvionicsPanel** (right, fixed)
   - Artificial horizon
   - ARM/DISARM/TAKEOFF/LAND buttons

5. **STATUS Panel** (right, fixed below Avionics)
   - System status
   - Battery voltage/current
   - Armed status
   - Flight mode

6. **Charts Panel** (left, draggable)
   - Roll/Pitch/Yaw time series
   - Toggle individual axes
   - 60-second history

7. **Logs Panel** (left, draggable)
   - Real-time system messages
   - Filter by INFO/WARN/ERROR

---

## Connecting to Vehicle

### Step 1: Open Connection Settings

Click the **CONNECT** button in the header. You'll see a connection dialog:

```
┌──────────────────────────────────────┐
│ Connection Settings                  │
├──────────────────────────────────────┤
│ Mode: [Simulink | Real Drone]        │
│ Host: 127.0.0.1                      │
│ Port: 14551                          │
│ System ID: 1                         │
│ Component ID: 1                      │
│                                      │
│ [Connect] [Cancel]                   │
└──────────────────────────────────────┘
```

### Step 2: Select Connection Mode

Choose between two modes:

#### Mode 1: Simulink Simulation (Development)

```
Mode: Simulink
Host: 127.0.0.1
Port: 14551
System ID: 1
Component ID: 1
```

**Prerequisites**:
- Simulink UAM_Flight_control.slx must be running
- UDP port 14551 accessible on localhost

**Verification**:
```bash
# In MATLAB, run the model
simulink/utilities/mavlink/mavlink_mission_test.m
```

#### Mode 2: Real Drone or PX4 SITL

**For PX4 SITL**:
```
Mode: Real Drone
Host: 127.0.0.1
Port: 14550
System ID: 1
Component ID: 1
```

**For Real Drone**:
```
Mode: Real Drone
Host: <drone-ip>      # e.g., 192.168.1.100
Port: 14550           # or configured port
System ID: 1          # or vehicle system ID
Component ID: 1
```

### Step 3: Connect

1. Ensure the vehicle/simulator is running
2. Click **Connect**
3. Wait for connection confirmation (should see heartbeat in 1-2 seconds)

**Status Indicators**:
- ✅ Connected (green): Vehicle heartbeat received
- ⚠️ Connecting (yellow): Waiting for first message
- ❌ Disconnected (red): No heartbeat for 3+ seconds

**Connection Status Display**:
```
Status: Connected | Mode: Simulink | Heartbeat: 1.2s ago
```

---

## Monitoring Telemetry

Once connected, real-time data updates automatically:

### Attitude Data

**Display**: Charts Panel (left)

Shows Roll, Pitch, Yaw over 60-second sliding window.

**Units**: Degrees

**Actions**:
- Click legend (Roll/Pitch/Yaw) to toggle visibility
- Data updates at ~30Hz (throttled for UI smoothness)

### Position & Altitude

**Display**: Map View

- **Marker**: Current GPS position (white VTOL icon)
- **Heading**: Orange line from marker
- **Zoom**: Scroll wheel to zoom in/out
- **Pan**: Click and drag to move map

**Data**:
- Latitude/Longitude (6 decimal places)
- Altitude MSL (meters)
- Relative altitude (meters above ground)

### Airspeed, Altitude, Heading

**Display**: Instruments Panel

- **Airspeed Indicator** (left-top)
  - Needle indicates current airspeed (m/s)
  - Arc shows safe operating range

- **Altimeter** (left-middle)
  - Altitude in meters above sea level (MSL)
  - Barometer-style dial

- **Heading Dial** (center-top)
  - Compass rose, 0-360 degrees
  - Heading indicator (red triangle)

- **Vertical Speed Indicator** (right)
  - Climb/descent rate (m/s)
  - Positive = climbing, negative = descending

### Battery Status

**Display**: STATUS Panel (right)

```
Battery:  12.5V | 5.2A | 75%
CPU Load: 42%
Armed:    YES
Mode:     STABILIZE
```

**Fields**:
- Voltage: Volts (critical if < 10.5V for 3S)
- Current: Amps (indicates load)
- Remaining: Percentage (0-100)
- CPU Load: System CPU usage percentage

### System Status

**Display**: STATUS Panel + Logs Panel

**System Status Values**:
- UNINIT: Not yet initialized
- BOOT: Booting up
- CALIBRATING: Sensor calibration in progress
- STANDBY: Ready but not armed
- ACTIVE: Flying
- CRITICAL: System error (land immediately!)
- EMERGENCY: Failsafe mode

**Logs**:
- Real-time messages from vehicle
- Level: INFO (blue) | WARN (yellow) | ERROR (red)
- Auto-scroll to latest

---

## Sending Commands

### Arming/Disarming

**Arming** (motors spinning ready):

1. Ensure vehicle is in valid state (GPS lock, sensors OK)
2. Click **ARM** button (AvionicsPanel, right)
3. Confirmation dialog appears:
   ```
   Confirm Action
   Arm motors?
   [Yes] [No]
   ```
4. Click **Yes**
5. Wait for COMMAND_ACK (should see success in Logs)

**Disarming** (motors stop):

1. Click **DISARM** button
2. Confirm
3. Motors will immediately stop

### Takeoff

**Procedure**:

1. **ARM** first (see above)
2. Click **TAKEOFF** button
3. Enter altitude (default 10m):
   ```
   Takeoff Altitude
   ┌────────────────┐
   │ 10             │ meters
   └────────────────┘
   [Takeoff] [Cancel]
   ```
4. Click **Takeoff**
5. Vehicle will climb to specified altitude vertically

**Requirements**:
- Vehicle must be ARMED
- GPS lock required (for home position)
- Clear airspace above

### Land

**Procedure**:

1. Click **LAND** button
2. Confirm:
   ```
   Land at current position?
   [Yes] [No]
   ```
3. Vehicle will descend slowly to ground and disarm

**Notes**:
- Safe way to return to ground
- Can be called from any altitude

### Return to Launch (RTL)

**Procedure**:

1. Click **RTL** button (if available)
2. Vehicle will:
   - Fly back to home position (set on first GPS fix)
   - Hover at RTL altitude (default 20m)
   - Disarm after landing

**Requirements**:
- Home position must be set (first valid GPS fix)
- Sufficient battery

### Hold Position

**Procedure**:

1. During flight, click **HOLD** button
2. Vehicle will:
   - Stop mission
   - Maintain current altitude
   - Hold GPS position

**Use case**: Emergency pause during waypoint mission

---

## Troubleshooting

### Issue: Connection Failed

**Error message**:
```
Error: Failed to connect to 127.0.0.1:14551
```

**Causes and solutions**:

1. **Vehicle/Simulator not running**
   - Start Simulink or PX4 SITL
   - Verify UDP port is listening:
     ```bash
     # macOS/Linux
     lsof -i :14551

     # Windows PowerShell
     Get-NetUDPEndpoint -LocalPort 14551
     ```

2. **Wrong host/port**
   - Verify settings match vehicle configuration
   - Simulink: 127.0.0.1:14551 (default)
   - PX4 SITL: 127.0.0.1:14550
   - Real drone: Check drone IP and QGC port settings

3. **Firewall blocking**
   - Add Electron app to firewall whitelist
   - Or open UDP port: `sudo ufw allow 14551/udp`

4. **Multiple GCS instances**
   - Only one app can receive on a UDP port
   - Close other GCS apps (including QGroundControl)

### Issue: No Telemetry Data (Connected but no updates)

**Symptoms**:
- Connection shows "Connected" but no attitude/position data
- Maps blank, instruments at zero

**Causes**:

1. **Heartbeat received but other messages blocked**
   - Check vehicle is configured to output ATTITUDE, GLOBAL_POSITION_INT, VFR_HUD
   - In QGC or vehicle settings, ensure messages are enabled

2. **Message parser sync issue**
   - Restart connection (Disconnect → Connect)
   - Check Logs Panel for parser errors

3. **Simulink: Output interval too long**
   - Simulink model runs at ~2s output rate (by design)
   - Allow 3-5 seconds for first telemetry

**Solutions**:
```bash
# Check UDP traffic (debug mode)
tcpdump -i lo udp port 14551  # macOS/Linux only

# Restart vehicle
# Restart GCS app
```

### Issue: Map Tiles Not Displaying

**Symptoms**:
- Map shows blank/black background
- No satellite imagery or street map

**Cause**: Tiles server unreachable or CSP policy blocking

**Solutions**:

1. **Check internet connection**
   - GCS needs internet for map tiles (OpenStreetMap, Mapbox)

2. **Check CSP policy in index.html**
   ```html
   <meta http-equiv="Content-Security-Policy"
         content="img-src 'self' https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com">
   ```
   - Verify tile servers are in `img-src` whitelist

3. **Restart app**
   ```bash
   Ctrl+C  # Stop dev server
   pnpm dev  # Restart
   ```

4. **Switch tile provider**
   - Click tiles toggle in top-left corner
   - Try SAT (satellite) or MAPS (dark street)

### Issue: Commands Not Executing (Button Clicked but No Effect)

**Symptoms**:
- ARM button clicked, but no response
- Command appears in Logs but doesn't execute

**Causes**:

1. **Vehicle not ready**
   - Missing GPS lock (need for RTL, takeoff)
   - Sensors not calibrated
   - Vehicle in failsafe mode

2. **Vehicle rejects command**
   - Battery too low
   - Already armed (can't arm again)
   - Insufficient permissions

3. **Command timeout**
   - Vehicle overloaded (especially Simulink at 2s/cycle)
   - Network latency
   - Vehicle didn't receive command

**Solutions**:

- Check Logs Panel for exact error message
- Verify vehicle status in STATUS Panel:
  - System Status should be STANDBY or ACTIVE
  - Battery should be > 10.5V (3S battery)
  - Armed should be YES/NO (not inconsistent)

- Check MAVLink protocol details in `docs/MAVLINK_PROTOCOL.md`

- Increase timeout for Simulink mode:
  - Edit `src/main/mavlink/connection.ts`
  - Change `retryInterval` from 1500ms to 3000ms

### Issue: Crashes on Startup

**Error**:
```
Failed to load resource: the server responded with a status of 404
```

**Cause**: Frontend build not generated

**Solution**:
```bash
# Full rebuild
pnpm clean
pnpm install
pnpm build
pnpm dev
```

### Issue: "Renderer IPC Channel Not Found"

**Error**:
```
TypeError: window.mavlink.sendCommand is not a function
```

**Cause**: Preload script not loaded

**Solution**:
```bash
# Check preload in main process
src/main/index.ts

# Verify contextBridge exports window.mavlink
src/preload/index.ts

# Rebuild and restart
pnpm build
pnpm dev
```

### Issue: Map Marker Not Moving

**Symptoms**:
- Drone icon doesn't update position
- Altitude/heading change but map frozen

**Cause**: Position update not reaching UI

**Debug**:
1. Open DevTools: `Ctrl+Shift+I` (Windows) or `Cmd+Option+I` (macOS)
2. Check Console tab for errors
3. Check Network tab for IPC messages

**Solution**:
```bash
# Verify parser is receiving GLOBAL_POSITION_INT
# In Logs Panel, should see position updates

# If not, restart connection
```

---

## Advanced Configuration

### Custom UDP Port

To use a non-standard port:

1. **Simulink mode**:
   - Edit `../simulink/utilities/mavlink/mavlinkGCS_sfunc.m`
   - Change `LocalUDPPort = 14551` to desired port

2. **GCS side**:
   - Use Connection dialog to set port

### Disabling Features

To reduce CPU load:

1. **Disable charts**:
   - Close Charts Panel
   - Reduces CPU by ~10%

2. **Use map tiles offline**:
   - Download offline map tiles (beyond scope of this guide)

3. **Reduce telemetry rate**:
   - Edit `src/main/mavlink/parser.ts`
   - Change `this.lastTelemetryEmit < 33` (30Hz) to `< 100` (10Hz)

---

## Performance Tips

1. **Simulink mode**: Expect 2-3 second latency due to model cycle time
2. **Real drone**: ~100ms latency typical for UDP connection
3. **Multiple browsers**: Only one can display live data (UDP receiver constraint)
4. **Disable unnecessary panels**: Close unused panels to save CPU

---

## Getting Help

- **Documentation**: See `docs/` folder
  - `MAVLINK_PROTOCOL.md` - Technical protocol details
  - `DEVELOPER_GUIDE.md` - For developers
  - `IPC_API.md` - Internal communication specification

- **Logs**: Check Logs Panel for error messages (right side)

- **GitHub Issues**: Report bugs at project repository

---

**Last Updated**: 2026-02-17
**Version**: 1.0
