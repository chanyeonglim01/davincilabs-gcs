import { useTelemetryStore } from '@renderer/store/telemetryStore'

interface Props {
  onDragHandle: (e: React.MouseEvent) => void
  collapsed: boolean
  onToggle: () => void
}

// LogPanel severity palette — error red / warn amber. OK uses design-system accent.
const ERR_RED = '#ff5555'
const WARN_AMBER = '#f5c842'
const ACCENT = '#ECDFCC'
const OK_GREEN = '#A5D6A7'

type LihaiErrorKey = 'bat' | 'gps' | 'imu' | 'baro' | 'rc' | 'angle' | 'pos'

const FLAGS: { key: LihaiErrorKey; label: string }[] = [
  { key: 'bat', label: 'BATTERY' },
  { key: 'gps', label: 'GPS' },
  { key: 'imu', label: 'IMU' },
  { key: 'baro', label: 'BAROMETER' },
  { key: 'rc', label: 'RC' },
  { key: 'angle', label: 'ANGLE CTRL' },
  { key: 'pos', label: 'POSITION CTRL' }
]

function FlagRow({ label, state, color }: { label: string; state: string; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 10px',
        borderBottom: '1px solid rgba(236, 223, 204, 0.06)'
      }}
    >
      <span
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '9px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'rgba(236, 223, 204, 0.5)'
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          color
        }}
      >
        {state}
      </span>
    </div>
  )
}

export function LihaiPanel({ onDragHandle, collapsed, onToggle }: Props) {
  const status = useTelemetryStore((s) => s.telemetry?.status)
  // CONNECTED = LIHAI_STATUS를 최근에 수신(2s 신선도). 무수신이면 상세값 숨김.
  const rxMs = status?.lihaiRxMs ?? 0
  const connected = rxMs > 0 && Date.now() - rxMs < 2000
  const errors = connected ? status?.lihaiErrors : undefined
  const hasError = errors ? Object.values(errors).some((v) => v !== 0) : false

  return (
    <div
      style={{
        background: 'rgba(24, 28, 20, 0.88)',
        border: '1px solid rgba(236, 223, 204, 0.12)',
        borderRadius: '6px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        width: '220px'
      }}
    >
      {/* Drag Handle */}
      <div
        onMouseDown={onDragHandle}
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: collapsed ? 'none' : '1px solid rgba(236, 223, 204, 0.08)',
          cursor: 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', opacity: 0.35 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', gap: '2px' }}>
                {[0, 1].map((j) => (
                  <div
                    key={j}
                    style={{
                      width: '2px',
                      height: '2px',
                      borderRadius: '50%',
                      background: '#ECDFCC'
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '9px',
              fontWeight: 600,
              color: 'rgba(236, 223, 204, 0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em'
            }}
          >
            LIHAI
          </span>
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: !connected ? 'rgba(236, 223, 204, 0.25)' : hasError ? WARN_AMBER : OK_GREEN,
              boxShadow: !connected ? 'none' : hasError ? 'none' : `0 0 6px ${OK_GREEN}`
            }}
            title={!connected ? 'NO LINK' : hasError ? 'ERROR' : 'OK'}
          />
        </div>
        <span style={{ color: 'rgba(236, 223, 204, 0.3)', fontSize: '10px' }}>
          {collapsed ? '▲' : '▼'}
        </span>
      </div>

      {!collapsed && (
        <div>
          {/* Link status — CONNECTED when LIHAI_STATUS is being received */}
          <FlagRow
            label="LINK"
            state={connected ? 'CONNECTED' : 'NO LINK'}
            color={connected ? OK_GREEN : 'rgba(236, 223, 204, 0.3)'}
          />
          {/* Subsystem error flags */}
          {FLAGS.map((flag) => {
            const val = errors ? errors[flag.key] : undefined
            const state = val === undefined ? '--' : val !== 0 ? 'ERROR' : 'OK'
            const color =
              val === undefined ? 'rgba(236, 223, 204, 0.3)' : val !== 0 ? ERR_RED : ACCENT
            return <FlagRow key={flag.key} label={flag.label} state={state} color={color} />
          })}
        </div>
      )}
    </div>
  )
}
