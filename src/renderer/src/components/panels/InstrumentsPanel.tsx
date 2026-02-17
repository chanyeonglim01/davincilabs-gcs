import { useTelemetryStore } from '@renderer/store/telemetryStore'

interface Props {
  onDragHandle: (e: React.MouseEvent) => void
  collapsed: boolean
  onToggle: () => void
}

function CompactGauge({
  label,
  value,
  unit,
  min,
  max
}: {
  label: string
  value: number
  unit: string
  min: number
  max: number
}) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const displayVal = Number.isFinite(value) ? value.toFixed(1) : '--'

  return (
    <div style={{ flex: 1, padding: '0 8px' }}>
      <div
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '9px',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'rgba(236, 223, 204, 0.5)',
          marginBottom: '4px'
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '22px',
          fontWeight: 700,
          color: '#ECDFCC',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          marginBottom: '6px'
        }}
      >
        {displayVal}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 400,
            marginLeft: '4px',
            opacity: 0.5
          }}
        >
          {unit}
        </span>
      </div>
      {/* Progress bar */}
      <div
        style={{
          height: '2px',
          background: 'rgba(236, 223, 204, 0.1)',
          borderRadius: '1px',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct * 100}%`,
            background: 'rgba(236, 223, 204, 0.7)',
            borderRadius: '1px',
            transition: 'width 0.15s ease'
          }}
        />
      </div>
    </div>
  )
}

function HeadingCompass({ heading }: { heading: number }) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const dir = dirs[Math.round(heading / 45) % 8]

  return (
    <div style={{ flex: 1, padding: '0 8px', borderRight: '1px solid rgba(236, 223, 204, 0.08)' }}>
      <div
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '9px',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'rgba(236, 223, 204, 0.5)',
          marginBottom: '4px'
        }}
      >
        HDG
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '6px',
          marginBottom: '6px'
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '22px',
            fontWeight: 700,
            color: '#ECDFCC',
            lineHeight: 1,
            letterSpacing: '-0.02em'
          }}
        >
          {Math.round(heading).toString().padStart(3, '0')}
        </span>
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '13px',
            fontWeight: 600,
            color: 'rgba(236, 223, 204, 0.7)'
          }}
        >
          {dir}
        </span>
        <span style={{ fontSize: '11px', color: 'rgba(236, 223, 204, 0.4)' }}>°</span>
      </div>
      {/* Mini compass arc */}
      <div
        style={{
          height: '2px',
          background: 'rgba(236, 223, 204, 0.1)',
          borderRadius: '1px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: `${(heading / 360) * 100}%`,
            transform: 'translateX(-50%)',
            width: '20%',
            height: '100%',
            background:
              'linear-gradient(90deg, transparent, rgba(236,223,204,0.8), transparent)',
            borderRadius: '1px'
          }}
        />
      </div>
    </div>
  )
}

export function InstrumentsPanel({ onDragHandle, collapsed, onToggle }: Props) {
  const { telemetry } = useTelemetryStore()

  const heading = telemetry?.heading ?? 0
  const airspeed = telemetry?.velocity?.airspeed ?? 0
  const altitude = telemetry?.position?.relative_alt ?? 0
  const vspeed = -(telemetry?.velocity?.vz ?? 0)

  return (
    <div
      style={{
        background: 'rgba(24, 28, 20, 0.88)',
        border: '1px solid rgba(236, 223, 204, 0.12)',
        borderRadius: '6px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        minWidth: '380px'
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
          {/* Grip dots */}
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
            INSTRUMENTS
          </span>
        </div>
        <span style={{ color: 'rgba(236, 223, 204, 0.3)', fontSize: '10px' }}>
          {collapsed ? '▲' : '▼'}
        </span>
      </div>

      {/* Content */}
      {!collapsed && (
        <div style={{ display: 'flex', padding: '12px 4px' }}>
          <HeadingCompass heading={heading} />
          <div
            style={{
              width: '1px',
              background: 'rgba(236, 223, 204, 0.08)',
              margin: '0 4px'
            }}
          />
          <CompactGauge label="AIRSPEED" value={airspeed} unit="m/s" min={0} max={40} />
          <div
            style={{
              width: '1px',
              background: 'rgba(236, 223, 204, 0.08)',
              margin: '0 4px'
            }}
          />
          <CompactGauge label="ALTITUDE" value={altitude} unit="m" min={0} max={200} />
          <div
            style={{
              width: '1px',
              background: 'rgba(236, 223, 204, 0.08)',
              margin: '0 4px'
            }}
          />
          <CompactGauge label="V/SPEED" value={vspeed} unit="m/s" min={-10} max={10} />
        </div>
      )}
    </div>
  )
}
