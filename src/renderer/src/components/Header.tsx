import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function Header() {
  const { connection } = useTelemetryStore()

  return (
    <header
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        background: 'rgba(24, 28, 20, 0.92)',
        borderBottom: '1px solid rgba(236, 223, 204, 0.12)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 50,
        userSelect: 'none'
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            border: '1.5px solid rgba(236, 223, 204, 0.8)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L14 8L8 14L2 8Z" stroke="#ECDFCC" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="2" fill="#ECDFCC" />
          </svg>
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            fontWeight: 700,
            color: '#ECDFCC',
            letterSpacing: '0.1em',
            textTransform: 'uppercase'
          }}
        >
          DAVINCI GCS
        </span>
      </div>

      {/* Center: System Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            color: 'rgba(236, 223, 204, 0.45)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}
        >
          UAM FLIGHT CONTROL
        </span>
      </div>

      {/* Right: Connection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: connection.connected ? '#ECDFCC' : 'rgba(236, 223, 204, 0.2)',
            boxShadow: connection.connected
              ? '0 0 8px rgba(236, 223, 204, 0.6)'
              : 'none',
            transition: 'all 0.3s ease'
          }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            color: connection.connected
              ? 'rgba(236, 223, 204, 0.9)'
              : 'rgba(236, 223, 204, 0.35)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}
        >
          {connection.connected ? `${connection.host}:${connection.port}` : 'NO LINK'}
        </span>
      </div>
    </header>
  )
}
