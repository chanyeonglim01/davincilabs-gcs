import { useTelemetryStore } from '@renderer/store/telemetryStore'

// Fixed panel - no drag
export function AvionicsPanel() {
  const { telemetry } = useTelemetryStore()

  const armed = telemetry?.status?.armed ?? false
  const flightMode = telemetry?.status?.flightMode ?? 'UNKNOWN'
  const systemStatus = telemetry?.status?.systemStatus ?? '--'

  const roll = ((telemetry?.attitude?.roll ?? 0) * 180) / Math.PI
  const pitch = ((telemetry?.attitude?.pitch ?? 0) * 180) / Math.PI

  return (
    <div
      style={{
        background: 'rgba(24, 28, 20, 0.88)',
        border: '1px solid rgba(236, 223, 204, 0.12)',
        borderRadius: '6px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        padding: '14px 16px',
        width: '200px'
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
      </div>

      {/* Attitude */}
      <div
        style={{
          borderTop: '1px solid rgba(236, 223, 204, 0.08)',
          paddingTop: '12px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px'
        }}
      >
        {[
          { label: 'ROLL', value: roll },
          { label: 'PITCH', value: pitch }
        ].map(({ label, value }) => (
          <div key={label}>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '9px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'rgba(236, 223, 204, 0.45)',
                marginBottom: '2px'
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '16px',
                fontWeight: 700,
                color: '#ECDFCC'
              }}
            >
              {value.toFixed(1)}°
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
