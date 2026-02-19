import { useState, useRef, useEffect } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import logoSrc from '@renderer/assets/images/dl_logo.png'

type ConnMode = 'udp' | 'com'
export type ViewType = 'main' | 'mission' | 'parameter'

const COM_PORTS = ['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8']

const VIEW_LABELS: Record<ViewType, string> = {
  main: 'MAIN',
  mission: 'MISSION',
  parameter: 'PARAMETER'
}

interface HeaderProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function Header({ currentView, onViewChange }: HeaderProps) {
  const { connection } = useTelemetryStore()
  const [mode, setMode] = useState<ConnMode>('udp')
  const [udpHost, setUdpHost] = useState('127.0.0.1')
  const [udpPort, setUdpPort] = useState('14551')
  const [comPort, setComPort] = useState('COM1')
  const [comOpen, setComOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Sync input fields when auto-connect sets a different host/port
  useEffect(() => {
    if (connection.connected) {
      setUdpHost(connection.host)
      setUdpPort(String(connection.port))
    }
  }, [connection.connected, connection.host, connection.port])

  const handleConnectionToggle = async () => {
    if (connection.connected) {
      setConnecting(true)
      try {
        await window.mavlink?.disconnect()
      } catch (e) {
        console.error('[Header] disconnect error:', e)
      } finally {
        setConnecting(false)
      }
    } else {
      if (mode !== 'udp') return
      const port = parseInt(udpPort, 10)
      if (isNaN(port)) return
      setConnecting(true)
      try {
        const result = await window.mavlink?.reconnect({ host: udpHost, port })
        if (result && !result.success) {
          console.error('[Header] reconnect failed:', result.error)
        }
      } catch (e) {
        console.error('[Header] reconnect error:', e)
      } finally {
        setConnecting(false)
      }
    }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    background: 'rgba(60, 61, 55, 0.6)',
    border: '1px solid rgba(236, 223, 204, 0.15)',
    borderRadius: '3px',
    color: '#ECDFCC',
    padding: '4px 8px',
    outline: 'none',
    width: '100%',
    opacity: connection.connected ? 0.4 : 1,
    pointerEvents: connection.connected ? 'none' : 'auto'
  }

  const connTabStyle = (active: boolean): React.CSSProperties => ({
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
        background: 'rgba(24, 28, 20, 0.95)',
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
      {/* Left: Logo + Nav Dropdown */}
      <div ref={navRef} style={{ display: 'flex', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
        {/* Logo — clickable */}
        <div
          onClick={() => setNavOpen((v) => !v)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          <img
            src={logoSrc}
            alt="DavinciLabs"
            style={{ height: '88px', width: 'auto', objectFit: 'contain' }}
          />
          {/* Current view indicator */}
          {currentView !== 'main' && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: '#ECDFCC',
                background: 'rgba(236, 223, 204, 0.1)',
                border: '1px solid rgba(236, 223, 204, 0.25)',
                borderRadius: '3px',
                padding: '2px 8px',
                textTransform: 'uppercase'
              }}
            >
              {VIEW_LABELS[currentView]}
            </span>
          )}
        </div>

        {/* Dropdown */}
        {navOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% - 6px)',
              left: '8px',
              minWidth: '160px',
              background: 'rgba(24, 28, 20, 0.98)',
              border: '1px solid rgba(236, 223, 204, 0.2)',
              borderRadius: '6px',
              overflow: 'hidden',
              zIndex: 1300,
              boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
              backdropFilter: 'blur(16px)'
            }}
          >
            {(['main', 'mission', 'parameter'] as ViewType[]).map((v) => (
              <div
                key={v}
                onClick={() => {
                  onViewChange(v)
                  setNavOpen(false)
                }}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '10px 16px',
                  color: v === currentView ? '#ECDFCC' : 'rgba(236, 223, 204, 0.45)',
                  background: v === currentView ? 'rgba(236, 223, 204, 0.08)' : 'transparent',
                  cursor: 'pointer',
                  borderLeft: v === currentView
                    ? '2px solid #ECDFCC'
                    : '2px solid transparent',
                  transition: 'all 0.1s ease'
                }}
                onMouseEnter={(e) => {
                  if (v !== currentView) {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(236, 223, 204, 0.05)'
                    ;(e.currentTarget as HTMLDivElement).style.color = 'rgba(236, 223, 204, 0.75)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (v !== currentView) {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLDivElement).style.color = 'rgba(236, 223, 204, 0.45)'
                  }
                }}
              >
                {VIEW_LABELS[v]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Center: Title */}
      <div style={{ flex: 1, textAlign: 'center', pointerEvents: 'none', padding: '0 20px' }}>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '13px',
            fontWeight: 600,
            color: 'rgba(236, 223, 204, 0.4)',
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
        {/* Status indicator */}
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
        <div style={{ display: 'flex', gap: '4px', opacity: connection.connected ? 0.4 : 1, pointerEvents: connection.connected ? 'none' : 'auto' }}>
          <button style={connTabStyle(mode === 'udp')} onClick={() => setMode('udp')}>
            UDP
          </button>
          <button style={connTabStyle(mode === 'com')} onClick={() => setMode('com')}>
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
                      background: p === comPort ? 'rgba(236, 223, 204, 0.08)' : 'transparent',
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

        {/* Connect / Disconnect button */}
        <button
          onClick={handleConnectionToggle}
          disabled={connecting}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '5px 14px',
            borderRadius: '3px',
            textTransform: 'uppercase',
            transition: 'all 0.15s ease',
            cursor: connecting ? 'default' : 'pointer',
            ...(connection.connected
              ? {
                  border: '1px solid rgba(236, 223, 204, 0.5)',
                  background: connecting ? 'rgba(236, 223, 204, 0.14)' : 'rgba(236, 223, 204, 0.1)',
                  color: connecting ? 'rgba(236, 223, 204, 0.4)' : 'rgba(236, 223, 204, 0.6)'
                }
              : {
                  border: '1px solid rgba(236, 223, 204, 0.3)',
                  background: connecting ? 'rgba(236, 223, 204, 0.14)' : 'rgba(236, 223, 204, 0.06)',
                  color: connecting ? 'rgba(236, 223, 204, 0.5)' : '#ECDFCC'
                })
          }}
          onMouseEnter={(e) => {
            if (!connecting)
              (e.currentTarget as HTMLButtonElement).style.background =
                'rgba(236, 223, 204, 0.14)'
          }}
          onMouseLeave={(e) => {
            if (!connecting)
              (e.currentTarget as HTMLButtonElement).style.background = connection.connected
                ? 'rgba(236, 223, 204, 0.1)'
                : 'rgba(236, 223, 204, 0.06)'
          }}
        >
          {connecting ? '...' : connection.connected ? 'DISCONNECT' : 'CONNECT'}
        </button>
      </div>
    </header>
  )
}
