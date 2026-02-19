import { useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
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

// Fixed panel - no drag
export function AvionicsPanel() {
  const [confirming, setConfirming] = useState<(typeof COMMANDS)[0] | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!confirming || !window.mavlink) { setConfirming(null); return }
    setLoading(true)
    try { await window.mavlink.sendCommand({ type: confirming.type, params: confirming.params }) }
    catch (e) { console.error(e) }
    finally { setLoading(false); setConfirming(null) }
  }
  const { telemetry } = useTelemetryStore()

  const armed = telemetry?.status?.armed ?? false
  const flightMode = telemetry?.status?.flightMode ?? 'UNKNOWN'
  const systemStatus = telemetry?.status?.systemStatus ?? '--'

  const roll = ((telemetry?.attitude?.roll ?? 0) * 180) / Math.PI
  const pitch = ((telemetry?.attitude?.pitch ?? 0) * 180) / Math.PI
  const yaw = ((telemetry?.attitude?.yaw ?? 0) * 180) / Math.PI

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
          {(['MANUAL', 'AUTO', 'EMER'] as const).map((mode) => {
            const modeMap: Record<string, string> = { MANUAL: 'MANUAL', AUTO: 'AUTO.MISSION', EMER: 'EMERGENCY' }
            const isActive = flightMode === modeMap[mode] || (mode === 'AUTO' && flightMode.startsWith('AUTO'))
            return (
              <button
                key={mode}
                onClick={() => {
                  const targetMode = mode === 'EMER' ? 'STABILIZED' : modeMap[mode]
                  window.mavlink?.sendCommand({ type: 'SET_MODE', params: { mode: targetMode } })
                }}
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
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(60,61,55,0.7)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(236,223,204,0.85)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(60,61,55,0.3)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(236,223,204,0.5)'
                  }
                }}
              >
                {mode}
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
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
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
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(236,223,204,0.45)'
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
      </div>

      {/* Confirm dialog */}
      {confirming && (
        <div
          style={{
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(24,28,20,0.7)',
            backdropFilter: 'blur(4px)', zIndex: 100
          }}
          onClick={() => !loading && setConfirming(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1e2218', border: '1px solid rgba(236,223,204,0.2)',
              borderRadius: '6px', padding: '12px 16px', width: '160px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)'
            }}
          >
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(236,223,204,0.45)', marginBottom: '6px' }}>CONFIRM</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '16px', fontWeight: 700, color: '#ECDFCC', marginBottom: '12px' }}>{confirming.label}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setConfirming(null)} style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 600, padding: '6px', border: '1px solid rgba(236,223,204,0.15)', borderRadius: '3px', background: 'transparent', color: 'rgba(236,223,204,0.5)', cursor: 'pointer', textTransform: 'uppercase' }}>CANCEL</button>
              <button onClick={handleConfirm} disabled={loading} style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, padding: '6px', border: '1px solid rgba(236,223,204,0.5)', borderRadius: '3px', background: 'rgba(236,223,204,0.08)', color: '#ECDFCC', cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase' }}>{loading ? '...' : 'EXECUTE'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
