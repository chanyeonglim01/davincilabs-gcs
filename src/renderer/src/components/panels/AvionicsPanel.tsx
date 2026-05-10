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

// Fixed panel - no drag
export function AvionicsPanel(): React.JSX.Element {
  const [confirming, setConfirming] = useState<(typeof COMMANDS)[0] | null>(null)
  const [loading, setLoading] = useState(false)
  const [missionConfirmOpen, setMissionConfirmOpen] = useState(false)
  const [missionLoading, setMissionLoading] = useState(false)

  const handleConfirm = async (): Promise<void> => {
    if (!confirming || !window.mavlink) {
      setConfirming(null)
      return
    }
    setLoading(true)
    try {
      await window.mavlink.sendCommand({ type: confirming.type, params: confirming.params })
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
  const flightMode = telemetry?.status?.flightMode ?? 'UNKNOWN'
  const flightModeRaw = telemetry?.status?.flightModeRaw ?? -1
  const subState = telemetry?.status?.subState ?? 0
  const rcOverride = telemetry?.status?.rcOverride ?? false
  const systemStatus = telemetry?.status?.systemStatus ?? '--'
  const linkState = connection?.linkState ?? 'DISCONNECTED'

  const roll = ((telemetry?.attitude?.roll ?? 0) * 180) / Math.PI
  const pitch = ((telemetry?.attitude?.pitch ?? 0) * 180) / Math.PI
  const yawSigned = ((telemetry?.attitude?.yaw ?? 0) * 180) / Math.PI
  const yaw = ((yawSigned % 360) + 360) % 360

  // Mode 진입 핸들러 — ArduPilot 스타일 분리
  const handleModeClick = (entry: ModeEntry): void => {
    if (!window.mavlink) return
    if (entry.confirmMessage && !window.confirm(entry.confirmMessage)) return
    void window.mavlink.sendCommand({ type: 'SET_MODE', params: { mode: entry.modeName } })
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
              fontSize: '13px',
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

      {/* RC OVERRIDE Badge — bit 24 set */}
      {rcOverride && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '5px 8px',
            marginBottom: '10px',
            background: 'rgba(236, 223, 204, 0.08)',
            border: `1px solid ${ACCENT}`,
            borderRadius: '3px',
            color: ACCENT,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase'
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: ACCENT,
              boxShadow: `0 0 8px ${ACCENT}`
            }}
          />
          RC OVERRIDE
        </div>
      )}

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
            letterSpacing: '0.03em'
          }}
        >
          {flightMode}
        </div>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '10px',
            color: 'rgba(236, 223, 204, 0.4)',
            marginTop: '2px'
          }}
        >
          {systemStatus}
        </div>
        {/* Mode selector buttons */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
          {MODE_ENTRIES.map((entry) => {
            const isActive = flightModeRaw === entry.flightModeRaw
            // RC override 중에는 AUTO/EMER 진입 차단 (수동 복귀는 허용)
            const blockedByRcOverride = rcOverride && entry.key !== 'MANUAL'
            const disabled = isActive || blockedByRcOverride
            return (
              <button
                key={entry.key}
                onClick={() => {
                  if (disabled) return
                  handleModeClick(entry)
                }}
                disabled={disabled}
                title={
                  isActive
                    ? `Already in ${entry.key}`
                    : blockedByRcOverride
                      ? 'RC override active — release sticks first'
                      : (entry.confirmMessage ?? `Enter ${entry.key}`)
                }
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
                  color: isActive
                    ? '#ECDFCC'
                    : blockedByRcOverride
                      ? 'rgba(236, 223, 204, 0.25)'
                      : 'rgba(236, 223, 204, 0.5)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: blockedByRcOverride ? 0.6 : 1,
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
