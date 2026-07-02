import * as React from 'react'
import { useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import { useMissionStore } from '@renderer/store/missionStore'
import { HorizonIndicator } from './HorizonIndicator'
import type { Command } from '@renderer/types'

const COMMANDS: { type: Command['type']; label: string; params?: Command['params'] }[] = [
  { type: 'ARM', label: 'ARM' },
  { type: 'DISARM', label: 'DISARM' },
  { type: 'TAKEOFF', label: 'TAKEOFF', params: { altitude: 10 } },
  { type: 'LAND', label: 'LAND' },
  { type: 'HOLD', label: 'HOLD' },
  { type: 'RTL', label: 'RTL' }
]

// Mode entry — ArduPilot 스타일로 "모드 진입"과 "임무 실행"을 분리한다.
// AUTO 진입은 IDLE 진입이므로 무확인. MANUAL/EMERGENCY는 사용자 경고 후 진입.
type ModeKey = 'MANUAL' | 'AUTO' | 'EMER'

interface ModeEntry {
  key: ModeKey
  /** SET_MODE 명령에 들어갈 mode name (customModes.MODE_NAME_TO_CUSTOM key) */
  modeName: string
  /** flightModeRaw 매칭용 (0=Manual, 1=Auto, 2=Emergency) */
  flightModeRaw: number
  /** confirm 메시지. null이면 무확인 즉시 송신 */
  confirmMessage: string | null
}

const MODE_ENTRIES: ModeEntry[] = [
  {
    key: 'MANUAL',
    modeName: 'MANUAL',
    flightModeRaw: 0,
    confirmMessage: 'Switch to MANUAL? RC required.'
  },
  // AUTO 진입은 IDLE/HOLD로 들어가는 것이므로 안전 → 무확인
  { key: 'AUTO', modeName: 'AUTO', flightModeRaw: 1, confirmMessage: null },
  {
    key: 'EMER',
    modeName: 'EMERGENCY',
    flightModeRaw: 2,
    confirmMessage: 'Emergency mode? Auto RTL/Land will engage.'
  }
]

const ACCENT = '#A5D6A7'

interface AvionicsPanelProps {
  onDragHandle?: (e: React.MouseEvent) => void
}

export function AvionicsPanel({ onDragHandle }: AvionicsPanelProps): React.JSX.Element {
  const [confirming, setConfirming] = useState<(typeof COMMANDS)[0] | null>(null)
  const [loading, setLoading] = useState(false)
  const [missionConfirmOpen, setMissionConfirmOpen] = useState(false)
  const [missionLoading, setMissionLoading] = useState(false)
  const [modeConfirming, setModeConfirming] = useState<ModeEntry | null>(null)
  const [modeLoading, setModeLoading] = useState(false)

  const requestMapCenter = useTelemetryStore((s) => s.requestMapCenter)

  const handleConfirm = async (): Promise<void> => {
    if (!confirming || !window.mavlink) {
      setConfirming(null)
      return
    }
    setLoading(true)
    try {
      await window.mavlink.sendCommand({ type: confirming.type, params: confirming.params })
      // TAKEOFF 직후 home 점(현재 GPS) 기준으로 지도 자동 중심
      if (confirming.type === 'TAKEOFF') {
        requestMapCenter()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setConfirming(null)
    }
  }

  const { telemetry, connection } = useTelemetryStore()
  const waypoints = useMissionStore((s) => s.waypoints)

  const armed = telemetry?.status?.armed ?? false
  const flightModePrimary = telemetry?.status?.flightModePrimary ?? 'UNKNOWN'
  const flightModeSub = telemetry?.status?.flightModeSub ?? ''
  const flightModeRaw = telemetry?.status?.flightModeRaw ?? -1
  const subState = telemetry?.status?.subState ?? 0
  const rcOverride = telemetry?.status?.rcOverride ?? false
  const rcLink = telemetry?.status?.rcLink ?? false
  const gpsFix = telemetry?.status?.gpsFix ?? 0
  const satellites = telemetry?.status?.satellites ?? 0
  const gps3D = gpsFix >= 3
  const gpsLabel = gpsFix >= 3 ? `3D · ${satellites}` : gpsFix === 2 ? `2D · ${satellites}` : 'NO FIX'

  // LIHAI / KETI — CONNECTED = 커스텀 메시지를 최근에 수신했는지(신선도). RC와 동일 개념.
  const now = Date.now()
  const LINK_STALE_MS = 2000 // FCC가 250ms마다 송신 → 2s 무수신이면 NO LINK

  // LIHAI — 수신 여부 + 서브시스템 에러 플래그 (상세는 LihaiPanel)
  const lihaiRxMs = telemetry?.status?.lihaiRxMs ?? 0
  const lihaiConnected = lihaiRxMs > 0 && now - lihaiRxMs < LINK_STALE_MS
  const lihaiErrors = telemetry?.status?.lihaiErrors
  const lihaiHasError = lihaiConnected && lihaiErrors ? Object.values(lihaiErrors).some((v) => v !== 0) : false
  const lihaiColor = !lihaiConnected ? 'rgba(236, 223, 204, 0.2)' : lihaiHasError ? '#f5c842' : '#ECDFCC'
  const lihaiLabel = !lihaiConnected ? 'NO LINK' : lihaiHasError ? 'ERROR' : 'CONNECTED'

  // KETI — 수신 여부 + 전방 장애물 (상세는 KetiPanel)
  const ketiRxMs = telemetry?.status?.ketiRxMs ?? 0
  const ketiConnected = ketiRxMs > 0 && now - ketiRxMs < LINK_STALE_MS
  const ketiValid = telemetry?.status?.ketiValid ?? false
  const ketiDistance = telemetry?.status?.ketiDistance ?? 0
  const ketiObstacle = ketiConnected && ketiValid && ketiDistance > 0
  const ketiColor = !ketiConnected ? 'rgba(236, 223, 204, 0.2)' : ketiObstacle ? '#f5c842' : '#ECDFCC'
  const ketiLabel = !ketiConnected ? 'NO LINK' : ketiObstacle ? `OBST ${ketiDistance.toFixed(1)}m` : 'CONNECTED'
  const systemStatus = telemetry?.status?.systemStatus ?? '--'
  const linkState = connection?.linkState ?? 'DISCONNECTED'

  const roll = ((telemetry?.attitude?.roll ?? 0) * 180) / Math.PI
  const pitch = ((telemetry?.attitude?.pitch ?? 0) * 180) / Math.PI
  const yawSigned = ((telemetry?.attitude?.yaw ?? 0) * 180) / Math.PI
  const yaw = ((yawSigned % 360) + 360) % 360

  // Mode 진입 핸들러 — ArduPilot 스타일 분리. confirmMessage 있으면 커스텀 모달.
  const handleModeClick = (entry: ModeEntry): void => {
    if (!window.mavlink) return
    if (entry.confirmMessage) {
      setModeConfirming(entry)
      return
    }
    void window.mavlink.sendCommand({ type: 'SET_MODE', params: { mode: entry.modeName } })
  }

  const handleModeConfirm = async (): Promise<void> => {
    if (!modeConfirming || !window.mavlink) {
      setModeConfirming(null)
      return
    }
    setModeLoading(true)
    try {
      await window.mavlink.sendCommand({
        type: 'SET_MODE',
        params: { mode: modeConfirming.modeName }
      })
    } catch (e) {
      console.error(e)
    } finally {
      setModeLoading(false)
      setModeConfirming(null)
    }
  }

  // MISSION START 버튼 활성화 조건 — ArduPilot 스타일 게이팅
  const missionStartEnabled =
    linkState === 'LINKED' &&
    armed &&
    flightModeRaw === 1 && // Auto
    subState === 0 && // IDLE
    waypoints.length >= 1 &&
    !rcOverride &&
    !missionLoading

  const handleMissionStartClick = (): void => {
    if (!missionStartEnabled) return
    setMissionConfirmOpen(true)
  }

  const handleMissionStartConfirm = async (): Promise<void> => {
    if (!window.mavlink) {
      setMissionConfirmOpen(false)
      return
    }
    setMissionLoading(true)
    try {
      await window.mavlink.sendCommand({
        type: 'MISSION_START',
        params: { firstItem: 0, lastItem: 0 }
      })
    } catch (e) {
      console.error(e)
    } finally {
      setMissionLoading(false)
      setMissionConfirmOpen(false)
    }
  }

  const firstWp = waypoints[0]
  const startAlt = firstWp?.alt ?? 0
  const firstActionLabel = firstWp?.action ?? '—'

  return (
    <div
      style={{
        background: 'rgba(24, 28, 20, 0.88)',
        border: '1px solid rgba(236, 223, 204, 0.12)',
        borderRadius: '6px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        padding: '14px 16px',
        width: '220px',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto'
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onDragHandle}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '14px',
          marginBottom: '8px',
          cursor: onDragHandle ? 'grab' : 'default'
        }}
      >
        <div
          style={{
            width: '28px',
            height: '3px',
            borderRadius: '2px',
            background: 'rgba(236, 223, 204, 0.25)'
          }}
        />
      </div>

      {/* ARM Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(236, 223, 204, 0.45)'
          }}
        >
          ARM STATUS
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: armed ? '#ECDFCC' : 'rgba(236, 223, 204, 0.2)',
              boxShadow: armed ? '0 0 8px rgba(236, 223, 204, 0.7)' : 'none',
              transition: 'all 0.3s ease'
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 700,
              color: armed ? '#ECDFCC' : 'rgba(236, 223, 204, 0.35)',
              letterSpacing: '0.05em',
              transition: 'color 0.3s ease'
            }}
          >
            {armed ? 'ARMED' : 'DISARMED'}
          </span>
        </div>
      </div>

      {/* RC indicator — custom_mode bit 24 (rc_override). ARM STATUS 줄과 동일 레이아웃. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(236, 223, 204, 0.45)'
          }}
        >
          RC
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: rcLink ? '#ECDFCC' : 'rgba(236, 223, 204, 0.2)',
              boxShadow: rcLink ? '0 0 8px rgba(236, 223, 204, 0.7)' : 'none',
              transition: 'all 0.3s ease'
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 700,
              color: rcLink ? '#ECDFCC' : 'rgba(236, 223, 204, 0.35)',
              letterSpacing: '0.05em',
              transition: 'color 0.3s ease'
            }}
          >
            {rcLink ? 'CONNECTED' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* GPS indicator — GPS_RAW_INT fix_type + satellites. ARM STATUS 줄과 동일 레이아웃. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(236, 223, 204, 0.45)'
          }}
        >
          GPS
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: gps3D ? '#ECDFCC' : 'rgba(236, 223, 204, 0.2)',
              boxShadow: gps3D ? '0 0 8px rgba(236, 223, 204, 0.7)' : 'none',
              transition: 'all 0.3s ease'
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 700,
              color: gps3D ? '#ECDFCC' : 'rgba(236, 223, 204, 0.35)',
              letterSpacing: '0.05em',
              transition: 'color 0.3s ease'
            }}
          >
            {gpsLabel}
          </span>
        </div>
      </div>

      {/* LIHAI indicator — LIHAI_STATUS link + subsystem error flags. GPS 줄과 동일 레이아웃. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(236, 223, 204, 0.45)'
          }}
        >
          LIHAI
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: lihaiColor,
              boxShadow: lihaiConnected ? `0 0 8px ${lihaiColor}` : 'none',
              transition: 'all 0.3s ease'
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 700,
              color: lihaiConnected ? lihaiColor : 'rgba(236, 223, 204, 0.35)',
              letterSpacing: '0.05em',
              transition: 'color 0.3s ease'
            }}
          >
            {lihaiLabel}
          </span>
        </div>
      </div>

      {/* KETI indicator — KETI_OBSTACLE forward obstacle monitor. GPS 줄과 동일 레이아웃. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(236, 223, 204, 0.45)'
          }}
        >
          KETI
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: ketiColor,
              boxShadow: ketiConnected ? `0 0 8px ${ketiColor}` : 'none',
              transition: 'all 0.3s ease'
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 700,
              color: ketiConnected ? (ketiObstacle ? '#f5c842' : '#ECDFCC') : 'rgba(236, 223, 204, 0.35)',
              letterSpacing: '0.05em',
              transition: 'color 0.3s ease'
            }}
          >
            {ketiLabel}
          </span>
        </div>
      </div>

      {/* Flight Mode */}
      <div
        style={{
          borderTop: '1px solid rgba(236, 223, 204, 0.08)',
          paddingTop: '12px',
          marginBottom: '12px'
        }}
      >
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(236, 223, 204, 0.45)',
            marginBottom: '4px'
          }}
        >
          MODE
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '18px',
            fontWeight: 700,
            color: '#ECDFCC',
            letterSpacing: '0.03em',
            lineHeight: 1.1
          }}
        >
          {flightModePrimary}
        </div>
        {flightModeSub && (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              fontWeight: 600,
              color: 'rgba(236, 223, 204, 0.55)',
              letterSpacing: '0.08em',
              marginTop: '2px'
            }}
          >
            ↳ {flightModeSub}
          </div>
        )}
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '10px',
            color: 'rgba(236, 223, 204, 0.4)',
            marginTop: '4px'
          }}
        >
          {systemStatus}
        </div>
        {/* Mode selector buttons */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
          {MODE_ENTRIES.map((entry) => {
            const isActive = flightModeRaw === entry.flightModeRaw
            // 모드 전환은 RC/GCS 동등 last-action-wins (모델 Chart1). GCS는 진입 차단 안 함.
            const disabled = isActive
            return (
              <button
                key={entry.key}
                onClick={() => {
                  if (disabled) return
                  handleModeClick(entry)
                }}
                disabled={disabled}
                title={isActive ? `Already in ${entry.key}` : (entry.confirmMessage ?? `Enter ${entry.key}`)}
                style={{
                  flex: 1,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  padding: '5px 2px',
                  border: isActive
                    ? '1px solid rgba(236, 223, 204, 0.6)'
                    : '1px solid rgba(236, 223, 204, 0.15)',
                  borderRadius: '3px',
                  background: isActive ? 'rgba(236, 223, 204, 0.12)' : 'rgba(60, 61, 55, 0.3)',
                  color: isActive ? '#ECDFCC' : 'rgba(236, 223, 204, 0.5)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: 1,
                  textTransform: 'uppercase',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(60,61,55,0.7)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(236,223,204,0.85)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!disabled) {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(60,61,55,0.3)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(236,223,204,0.5)'
                  }
                }}
              >
                {entry.key}
              </button>
            )
          })}
        </div>
      </div>

      {/* Horizon Indicator */}
      <div
        style={{
          borderTop: '1px solid rgba(236, 223, 204, 0.08)',
          paddingTop: '12px',
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <HorizonIndicator roll={roll} pitch={pitch} size={178} />
      </div>

      {/* ROLL / PITCH compact values */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0px',
          paddingTop: '6px'
        }}
      >
        {[
          { label: 'ROLL', value: roll },
          { label: 'PITCH', value: pitch },
          { label: 'YAW', value: yaw }
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '60px'
            }}
          >
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '8px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(236, 223, 204, 0.4)',
                marginBottom: '2px'
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 700,
                color: 'rgba(236, 223, 204, 0.8)',
                whiteSpace: 'nowrap'
              }}
            >
              {value.toFixed(1)}°
            </span>
          </div>
        ))}
      </div>
      {/* Commands */}
      <div
        style={{
          borderTop: '1px solid rgba(236, 223, 204, 0.08)',
          paddingTop: '10px',
          marginTop: '8px'
        }}
      >
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(236, 223, 204, 0.45)',
            marginBottom: '8px'
          }}
        >
          COMMANDS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          {COMMANDS.map((cmd) => (
            <button
              key={cmd.type}
              onClick={() => setConfirming(cmd)}
              disabled={loading}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '8px 4px',
                border: '1px solid rgba(236, 223, 204, 0.18)',
                borderRadius: '3px',
                background: 'rgba(60, 61, 55, 0.4)',
                color: 'rgba(236, 223, 204, 0.75)',
                cursor: loading ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(60,61,55,0.85)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#ECDFCC'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                    'rgba(236,223,204,0.45)'
                }
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(60,61,55,0.4)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(236,223,204,0.75)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(236,223,204,0.18)'
              }}
            >
              {cmd.label}
            </button>
          ))}
        </div>

        {/* MISSION START — ArduPilot 스타일 분리: AUTO/IDLE + ARMED + 웨이포인트 보유 시에만 활성 */}
        <button
          onClick={handleMissionStartClick}
          disabled={!missionStartEnabled}
          title={
            missionStartEnabled
              ? `Start mission with ${waypoints.length} waypoint${waypoints.length === 1 ? '' : 's'}`
              : !armed
                ? 'Disarmed — ARM first'
                : flightModeRaw !== 1
                  ? 'Switch to AUTO first'
                  : subState !== 0
                    ? 'Mission already in progress'
                    : waypoints.length === 0
                      ? 'Upload at least one waypoint first'
                      : rcOverride
                        ? 'RC override active — release sticks first'
                        : linkState !== 'LINKED'
                          ? 'No telemetry link'
                          : 'Mission unavailable'
          }
          style={{
            width: '100%',
            marginTop: '8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '10px 4px',
            border: `1px solid ${missionStartEnabled ? ACCENT : 'rgba(236, 223, 204, 0.15)'}`,
            borderRadius: '3px',
            background: missionStartEnabled ? 'rgba(165, 214, 167, 0.12)' : 'rgba(60, 61, 55, 0.3)',
            color: missionStartEnabled ? ACCENT : 'rgba(236, 223, 204, 0.3)',
            cursor: missionStartEnabled ? 'pointer' : 'not-allowed',
            textTransform: 'uppercase',
            transition: 'all 0.15s ease',
            opacity: missionStartEnabled ? 1 : 0.7
          }}
          onMouseEnter={(e) => {
            if (missionStartEnabled) {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(165, 214, 167, 0.22)'
            }
          }}
          onMouseLeave={(e) => {
            if (missionStartEnabled) {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(165, 214, 167, 0.12)'
            }
          }}
        >
          ▶ MISSION START
        </button>
      </div>

      {/* Confirm dialog (ARM/DISARM/TAKEOFF/LAND/HOLD/RTL) */}
      {confirming && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(24,28,20,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 100
          }}
          onClick={() => !loading && setConfirming(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1e2218',
              border: '1px solid rgba(236,223,204,0.2)',
              borderRadius: '6px',
              padding: '12px 16px',
              width: '160px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)'
            }}
          >
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '9px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'rgba(236,223,204,0.45)',
                marginBottom: '6px'
              }}
            >
              CONFIRM
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '16px',
                fontWeight: 700,
                color: '#ECDFCC',
                marginBottom: '12px'
              }}
            >
              {confirming.label}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setConfirming(null)}
                style={{
                  flex: 1,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '6px',
                  border: '1px solid rgba(236,223,204,0.15)',
                  borderRadius: '3px',
                  background: 'transparent',
                  color: 'rgba(236,223,204,0.5)',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                style={{
                  flex: 1,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '6px',
                  border: '1px solid rgba(236,223,204,0.5)',
                  borderRadius: '3px',
                  background: 'rgba(236,223,204,0.08)',
                  color: '#ECDFCC',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                {loading ? '...' : 'EXECUTE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE confirm dialog (MANUAL/EMERGENCY) */}
      {modeConfirming &&
        (() => {
          const isEmer = modeConfirming.key === 'EMER'
          const accent = isEmer ? '#FF5252' : '#ECDFCC'
          return (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(24,28,20,0.7)',
                backdropFilter: 'blur(4px)',
                zIndex: 100
              }}
              onClick={() => !modeLoading && setModeConfirming(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#1e2218',
                  border: `1px solid ${isEmer ? accent : 'rgba(236,223,204,0.2)'}`,
                  borderRadius: '6px',
                  padding: '14px 18px',
                  width: '220px',
                  boxShadow: `0 16px 48px rgba(0,0,0,0.6)${isEmer ? `, 0 0 24px rgba(255,82,82,0.3)` : ''}`
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '9px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: isEmer ? accent : 'rgba(236,223,204,0.45)',
                    marginBottom: '6px'
                  }}
                >
                  {isEmer ? '⚠ EMERGENCY' : 'CONFIRM'}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#ECDFCC',
                    marginBottom: '14px',
                    lineHeight: 1.4
                  }}
                >
                  {modeConfirming.confirmMessage}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setModeConfirming(null)}
                    disabled={modeLoading}
                    style={{
                      flex: 1,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '8px',
                      border: '1px solid rgba(236,223,204,0.15)',
                      borderRadius: '3px',
                      background: 'transparent',
                      color: 'rgba(236,223,204,0.5)',
                      cursor: modeLoading ? 'not-allowed' : 'pointer',
                      textTransform: 'uppercase'
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleModeConfirm}
                    disabled={modeLoading}
                    style={{
                      flex: 1,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '8px',
                      border: `1px solid ${accent}`,
                      borderRadius: '3px',
                      background: isEmer ? 'rgba(255,82,82,0.15)' : 'rgba(236,223,204,0.08)',
                      color: accent,
                      cursor: modeLoading ? 'not-allowed' : 'pointer',
                      textTransform: 'uppercase'
                    }}
                  >
                    {modeLoading ? '...' : isEmer ? 'EMERGENCY' : 'EXECUTE'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

      {/* MISSION START confirm dialog */}
      {missionConfirmOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(24,28,20,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 100
          }}
          onClick={() => !missionLoading && setMissionConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1e2218',
              border: `1px solid ${ACCENT}`,
              borderRadius: '6px',
              padding: '14px 18px',
              width: '240px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)'
            }}
          >
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '9px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: ACCENT,
                marginBottom: '8px'
              }}
            >
              START MISSION?
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                lineHeight: 1.6,
                color: 'rgba(236, 223, 204, 0.85)',
                marginBottom: '12px'
              }}
            >
              <div>
                Items: <span style={{ color: '#ECDFCC', fontWeight: 700 }}>{waypoints.length}</span>
              </div>
              <div>
                First: <span style={{ color: '#ECDFCC', fontWeight: 700 }}>{firstActionLabel}</span>
              </div>
              <div>
                Start altitude:{' '}
                <span style={{ color: '#ECDFCC', fontWeight: 700 }}>{startAlt.toFixed(1)}m</span>
              </div>
              <div style={{ marginTop: '6px', color: ACCENT, fontSize: '10px' }}>
                Status: ARMED · AUTO · LINKED
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setMissionConfirmOpen(false)}
                disabled={missionLoading}
                style={{
                  flex: 1,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '8px',
                  border: '1px solid rgba(236,223,204,0.15)',
                  borderRadius: '3px',
                  background: 'transparent',
                  color: 'rgba(236,223,204,0.5)',
                  cursor: missionLoading ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleMissionStartConfirm}
                disabled={missionLoading}
                style={{
                  flex: 1,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '8px',
                  border: `1px solid ${ACCENT}`,
                  borderRadius: '3px',
                  background: 'rgba(165, 214, 167, 0.18)',
                  color: ACCENT,
                  cursor: missionLoading ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                {missionLoading ? '...' : '▶ START'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
