import { useTelemetryStore } from '@renderer/store/telemetryStore'

interface Props {
  onDragHandle: (e: React.MouseEvent) => void
  collapsed: boolean
  onToggle: () => void
}

function DataCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderBottom: '1px solid rgba(236, 223, 204, 0.06)',
        borderRight: '1px solid rgba(236, 223, 204, 0.06)'
      }}
    >
      <div
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '8px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'rgba(236, 223, 204, 0.4)',
          marginBottom: '2px'
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '17px',
            fontWeight: 700,
            color: '#ECDFCC',
            lineHeight: 1,
            letterSpacing: '-0.02em'
          }}
        >
          {value}
        </span>
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '9px',
            color: 'rgba(236, 223, 204, 0.4)'
          }}
        >
          {unit}
        </span>
      </div>
    </div>
  )
}

export function TelemetryPanel({ onDragHandle, collapsed, onToggle }: Props) {
  const { telemetry } = useTelemetryStore()

  const lat = telemetry?.position?.lat?.toFixed(5) ?? '--'
  const lon = telemetry?.position?.lon?.toFixed(5) ?? '--'
  const alt = telemetry?.position?.relative_alt?.toFixed(1) ?? '--'
  const gspd = telemetry?.velocity?.groundspeed?.toFixed(1) ?? '--'
  const aspd = telemetry?.velocity?.airspeed?.toFixed(1) ?? '--'
  const bat = telemetry?.status?.battery?.remaining?.toFixed(0) ?? '--'

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
            STATUS
          </span>
        </div>
        <span style={{ color: 'rgba(236, 223, 204, 0.3)', fontSize: '10px' }}>
          {collapsed ? '▲' : '▼'}
        </span>
      </div>

      {!collapsed && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr'
          }}
        >
          <DataCell label="LAT" value={lat} unit="°" />
          <DataCell label="LON" value={lon} unit="°" />
          <DataCell label="ALT" value={alt} unit="m" />
          <DataCell label="GND SPD" value={gspd} unit="m/s" />
          <DataCell label="AIR SPD" value={aspd} unit="m/s" />
          <DataCell label="BAT" value={bat} unit="%" />
        </div>
      )}
    </div>
  )
}
