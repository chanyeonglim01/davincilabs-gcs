import { useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import logoSrc from '@renderer/assets/images/dl_logo.png'

type ConnMode = 'udp' | 'com'

const COM_PORTS = ['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8']

export function Header() {
  const { connection } = useTelemetryStore()
  const [mode, setMode] = useState<ConnMode>('udp')
  const [udpHost, setUdpHost] = useState('127.0.0.1')
  const [udpPort, setUdpPort] = useState('14551')
  const [comPort, setComPort] = useState('COM1')
  const [comOpen, setComOpen] = useState(false)

  const inputStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    background: 'rgba(60, 61, 55, 0.6)',
    border: '1px solid rgba(236, 223, 204, 0.15)',
    borderRadius: '3px',
    color: '#ECDFCC',
    padding: '4px 8px',
    outline: 'none',
    width: '100%'
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '3px 10px',
    border: '1px solid',
    borderColor: active ? 'rgba(236, 223, 204, 0.5)' : 'rgba(236, 223, 204, 0.12)',
    borderRadius: '3px',
    background: active ? 'rgba(236, 223, 204, 0.08)' : 'transparent',
    color: active ? '#ECDFCC' : 'rgba(236, 223, 204, 0.35)',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  })

  return (
    <header
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        zIndex: 1200,
        background: 'rgba(24, 28, 20, 0.92)',
        borderBottom: '1px solid rgba(236, 223, 204, 0.1)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        userSelect: 'none',
        overflow: 'visible'
      }}
    >
      {/* Left: Logo */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <img
          src={logoSrc}
          alt="DavinciLabs"
          style={{ height: '88px', width: 'auto', objectFit: 'contain' }}
        />
      </div>

      {/* Center: Title */}
      <div
        style={{
          flex: 1,
          textAlign: 'center',
          pointerEvents: 'none',
          padding: '0 20px'
        }}
      >
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            color: 'rgba(236, 223, 204, 0.55)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap'
          }}
        >
          ADVANCED AIR MOBILITY GROUND CONTROL SYSTEM
        </div>
      </div>

      {/* Right: Connection Panel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0
        }}
      >
        {/* Status indicator - LEFT of controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: connection.connected ? '#00FF88' : 'rgba(236, 223, 204, 0.2)',
              boxShadow: connection.connected ? '0 0 8px rgba(0, 255, 136, 0.7)' : 'none',
              transition: 'all 0.3s ease'
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: connection.connected ? '#00FF88' : 'rgba(236, 223, 204, 0.3)',
              letterSpacing: '0.04em',
              transition: 'color 0.3s ease'
            }}
          >
            {connection.connected ? `${connection.host}:${connection.port}` : 'NO LINK'}
          </span>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'rgba(236, 223, 204, 0.1)' }} />

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button style={tabStyle(mode === 'udp')} onClick={() => setMode('udp')}>
            UDP
          </button>
          <button style={tabStyle(mode === 'com')} onClick={() => setMode('com')}>
            COM
          </button>
        </div>

        {/* UDP inputs */}
        {mode === 'udp' && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="text"
              value={udpHost}
              onChange={(e) => setUdpHost(e.target.value)}
              placeholder="127.0.0.1"
              style={{ ...inputStyle, width: '100px' }}
            />
            <span style={{ color: 'rgba(236, 223, 204, 0.25)', fontSize: '12px' }}>:</span>
            <input
              type="text"
              value={udpPort}
              onChange={(e) => setUdpPort(e.target.value)}
              placeholder="14551"
              style={{ ...inputStyle, width: '54px' }}
            />
          </div>
        )}

        {/* COM port selector */}
        {mode === 'com' && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setComOpen((v) => !v)}
              style={{
                ...inputStyle,
                width: '90px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: comOpen
                  ? '1px solid rgba(236, 223, 204, 0.4)'
                  : '1px solid rgba(236, 223, 204, 0.15)'
              }}
            >
              <span>{comPort}</span>
              <span style={{ opacity: 0.4, fontSize: '9px' }}>▼</span>
            </button>
            {comOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  width: '90px',
                  background: '#1e2218',
                  border: '1px solid rgba(236, 223, 204, 0.2)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  zIndex: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                }}
              >
                {COM_PORTS.map((p) => (
                  <div
                    key={p}
                    onClick={() => {
                      setComPort(p)
                      setComOpen(false)
                    }}
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '11px',
                      padding: '6px 10px',
                      color: p === comPort ? '#ECDFCC' : 'rgba(236, 223, 204, 0.5)',
                      background:
                        p === comPort ? 'rgba(236, 223, 204, 0.08)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLDivElement).style.background =
                        'rgba(236, 223, 204, 0.08)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLDivElement).style.background =
                        p === comPort ? 'rgba(236, 223, 204, 0.08)' : 'transparent'
                    }}
                  >
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Connect button */}
        <button
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '5px 14px',
            border: '1px solid rgba(236, 223, 204, 0.3)',
            borderRadius: '3px',
            background: 'rgba(236, 223, 204, 0.06)',
            color: '#ECDFCC',
            cursor: 'pointer',
            textTransform: 'uppercase',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background =
              'rgba(236, 223, 204, 0.14)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background =
              'rgba(236, 223, 204, 0.06)'
          }}
        >
          CONNECT
        </button>

      </div>
    </header>
  )
}
