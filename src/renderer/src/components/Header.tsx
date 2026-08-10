import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import logoSrc from '@renderer/assets/images/dl_logo.png'
import type { LinkState, SerialPortInfo } from '@renderer/types'

type ConnMode = 'udp' | 'com'
export type ViewType = 'main' | 'mission' | 'parameter' | 'test'

const VIEW_LABELS: Record<ViewType, string> = {
  main: 'MAIN',
  mission: 'MISSION',
  parameter: 'PARAMETER',
  test: 'TEST'
}

const BAUDRATES = [9600, 57600, 115200, 230400, 921600] as const
type Baudrate = (typeof BAUDRATES)[number]

const SERIAL_REFRESH_MS = 30_000

// Five-state link styling. Status colors are scoped to link visualization
// (black/cream design system stays untouched everywhere else).
interface LinkStyle {
  dot: string
  glow: string | null
  text: string
}

const LINK_STYLES: Record<LinkState, LinkStyle> = {
  DISCONNECTED: {
    dot: 'rgba(236, 223, 204, 0.2)',
    glow: null,
    text: 'rgba(236, 223, 204, 0.3)'
  },
  WAITING_HEARTBEAT: {
    dot: '#F0C674',
    glow: '0 0 8px rgba(240, 198, 116, 0.65)',
    text: '#F0C674'
  },
  LINKED: {
    dot: '#00FF88',
    glow: '0 0 8px rgba(0, 255, 136, 0.7)',
    text: '#00FF88'
  },
  STALE: {
    dot: '#E06C75',
    glow: '0 0 8px rgba(224, 108, 117, 0.7)',
    text: '#E06C75'
  },
  ERROR: {
    dot: '#E06C75',
    glow: '0 0 10px rgba(224, 108, 117, 0.85)',
    text: '#E06C75'
  }
}

function linkLabel(state: LinkState): string {
  switch (state) {
    case 'LINKED':
      return 'LINKED'
    case 'WAITING_HEARTBEAT':
      return 'WAITING'
    case 'STALE':
      return 'NO HEARTBEAT'
    case 'ERROR':
      return 'ERROR'
    case 'DISCONNECTED':
    default:
      return 'NO LINK'
  }
}

interface HeaderProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function Header({ currentView, onViewChange }: HeaderProps): React.JSX.Element {
  // Connection only — subscribing to the whole store would re-render the header
  // on every 30 Hz telemetry frame.
  const connection = useTelemetryStore((state) => state.connection)
  const linkState: LinkState = connection.linkState ?? 'DISCONNECTED'
  const isLinked = linkState === 'LINKED'
  const isTransportOpen = isLinked || linkState === 'WAITING_HEARTBEAT' || linkState === 'STALE'
  // Inputs lock once a transport is open. ERROR/DISCONNECTED keep them editable.
  const inputsLocked = isTransportOpen

  const [mode, setMode] = useState<ConnMode>('udp')
  const [udpHost, setUdpHost] = useState('127.0.0.1')
  const [udpPort, setUdpPort] = useState('14550')
  const [comOpen, setComOpen] = useState(false)
  const [baudOpen, setBaudOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [serialPorts, setSerialPorts] = useState<SerialPortInfo[]>([])
  const [serialRefreshing, setSerialRefreshing] = useState(false)
  const [comPort, setComPort] = useState<string>('')
  const [baudrate, setBaudrate] = useState<Baudrate>(115200)
  const navRef = useRef<HTMLDivElement>(null)
  const comRef = useRef<HTMLDivElement>(null)
  const baudRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      const t = e.target as Node
      if (navRef.current && !navRef.current.contains(t)) setNavOpen(false)
      if (comRef.current && !comRef.current.contains(t)) setComOpen(false)
      if (baudRef.current && !baudRef.current.contains(t)) setBaudOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Sync input fields when auto-connect or main process picks a different host/port
  useEffect(() => {
    if (isTransportOpen) {
      setUdpHost(connection.host)
      setUdpPort(String(connection.port))
    }
  }, [isTransportOpen, connection.host, connection.port])

  const refreshSerialPorts = useCallback(async () => {
    if (!window.mavlink?.listSerialPorts) return
    setSerialRefreshing(true)
    try {
      const ports = await window.mavlink.listSerialPorts()
      setSerialPorts(ports)
      // Auto-select first port if none selected, or clear if previous vanished
      setComPort((prev) => {
        if (ports.length === 0) return ''
        if (prev && ports.some((p) => p.path === prev)) return prev
        return ports[0].path
      })
    } catch (err) {
      console.error('[Header] listSerialPorts error:', err)
    } finally {
      setSerialRefreshing(false)
    }
  }, [])

  // Initial enumeration + 30s polling
  useEffect(() => {
    void refreshSerialPorts()
    const id = setInterval(() => {
      void refreshSerialPorts()
    }, SERIAL_REFRESH_MS)
    return () => clearInterval(id)
  }, [refreshSerialPorts])

  const handleConnectionToggle = async (): Promise<void> => {
    if (isTransportOpen) {
      setConnecting(true)
      try {
        await window.mavlink?.disconnect()
      } catch (e) {
        console.error('[Header] disconnect error:', e)
      } finally {
        setConnecting(false)
      }
      return
    }

    if (mode === 'com') {
      // 시리얼 트랜스포트 (텔레메트리 라디오 COM 포트)
      if (!comPort) {
        window.alert('시리얼 포트를 먼저 선택하세요.')
        return
      }
      setConnecting(true)
      try {
        const result = await window.mavlink?.connectSerial(comPort, baudrate)
        if (result && !result.success) {
          console.error('[Header] serial connect failed:', result.error)
        }
      } catch (e) {
        console.error('[Header] serial connect error:', e)
      } finally {
        setConnecting(false)
      }
      return
    }

    const port = parseInt(udpPort, 10)
    if (Number.isNaN(port)) return
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

  const linkStyle = LINK_STYLES[linkState]
  const labelText = useMemo(() => linkLabel(linkState), [linkState])

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
    opacity: inputsLocked ? 0.4 : 1,
    pointerEvents: inputsLocked ? 'none' : 'auto'
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
      <div
        ref={navRef}
        style={{ display: 'flex', alignItems: 'center', flexShrink: 0, position: 'relative' }}
      >
        <div
          onClick={() => setNavOpen((v) => !v)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          <img
            src={logoSrc}
            alt="DavinciLabs"
            style={{ height: '88px', width: 'auto', objectFit: 'contain' }}
          />
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
            {(['main', 'mission', 'parameter', 'test'] as ViewType[]).map((v) => (
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
                  borderLeft: v === currentView ? '2px solid #ECDFCC' : '2px solid transparent',
                  transition: 'all 0.1s ease'
                }}
                onMouseEnter={(e) => {
                  if (v !== currentView) {
                    ;(e.currentTarget as HTMLDivElement).style.background =
                      'rgba(236, 223, 204, 0.05)'
                    ;(e.currentTarget as HTMLDivElement).style.color = 'rgba(236, 223, 204, 0.75)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (v !== currentView) {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* 5-state link indicator */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '7px' }}
          title={
            linkState === 'ERROR' && connection.error ? `ERROR: ${connection.error}` : labelText
          }
        >
          <div
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: linkStyle.dot,
              boxShadow: linkStyle.glow ?? 'none',
              transition: 'all 0.3s ease',
              animation:
                linkState === 'WAITING_HEARTBEAT'
                  ? 'dl-link-pulse 1.4s ease-in-out infinite'
                  : 'none'
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: linkStyle.text,
              letterSpacing: '0.04em',
              transition: 'color 0.3s ease',
              maxWidth: '240px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {labelText}
          </span>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'rgba(236, 223, 204, 0.1)' }} />

        {/* Mode tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            opacity: inputsLocked ? 0.4 : 1,
            pointerEvents: inputsLocked ? 'none' : 'auto'
          }}
        >
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
              placeholder="14550"
              style={{ ...inputStyle, width: '54px' }}
            />
          </div>
        )}

        {/* COM port + baud */}
        {mode === 'com' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Serial port dropdown */}
            <div ref={comRef} style={{ position: 'relative' }}>
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
                title={comPort || 'No serial devices found'}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    textAlign: 'left',
                    color: comPort ? '#ECDFCC' : 'rgba(236, 223, 204, 0.4)'
                  }}
                >
                  {comPort || (serialPorts.length === 0 ? 'NO DEVICES' : 'Select port')}
                </span>
                <span style={{ opacity: 0.4, fontSize: '9px', marginLeft: '6px' }}>▼</span>
              </button>

              {comOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    width: '120px',
                    background: '#1e2218',
                    border: '1px solid rgba(236, 223, 204, 0.2)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    zIndex: 200,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                  }}
                >
                  {/* Refresh row */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      void refreshSerialPorts()
                    }}
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '6px 10px',
                      color: 'rgba(236, 223, 204, 0.55)',
                      background: 'rgba(236, 223, 204, 0.04)',
                      borderBottom: '1px solid rgba(236, 223, 204, 0.08)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{serialRefreshing ? 'SCANNING…' : 'REFRESH'}</span>
                    <span style={{ opacity: 0.5 }}>{serialPorts.length}</span>
                  </div>

                  {serialPorts.length === 0 && (
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        padding: '10px',
                        color: 'rgba(236, 223, 204, 0.4)',
                        textAlign: 'center'
                      }}
                    >
                      No serial devices
                    </div>
                  )}

                  {serialPorts.map((p) => (
                    <div
                      key={p.path}
                      onClick={() => {
                        setComPort(p.path)
                        setComOpen(false)
                      }}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        padding: '6px 10px',
                        color: p.path === comPort ? '#ECDFCC' : 'rgba(236, 223, 204, 0.5)',
                        background:
                          p.path === comPort ? 'rgba(236, 223, 204, 0.08)' : 'transparent',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={p.friendlyName ?? p.path}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLDivElement).style.background =
                          'rgba(236, 223, 204, 0.08)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLDivElement).style.background =
                          p.path === comPort ? 'rgba(236, 223, 204, 0.08)' : 'transparent'
                      }}
                    >
                      {p.friendlyName ?? p.path}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Baudrate dropdown */}
            <div ref={baudRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setBaudOpen((v) => !v)}
                style={{
                  ...inputStyle,
                  width: '88px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: baudOpen
                    ? '1px solid rgba(236, 223, 204, 0.4)'
                    : '1px solid rgba(236, 223, 204, 0.15)'
                }}
                title={`Baudrate ${baudrate}`}
              >
                <span>{baudrate}</span>
                <span style={{ opacity: 0.4, fontSize: '9px' }}>▼</span>
              </button>
              {baudOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    width: '88px',
                    background: '#1e2218',
                    border: '1px solid rgba(236, 223, 204, 0.2)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    zIndex: 200,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                  }}
                >
                  {BAUDRATES.map((b) => (
                    <div
                      key={b}
                      onClick={() => {
                        setBaudrate(b)
                        setBaudOpen(false)
                      }}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        padding: '6px 10px',
                        color: b === baudrate ? '#ECDFCC' : 'rgba(236, 223, 204, 0.5)',
                        background: b === baudrate ? 'rgba(236, 223, 204, 0.08)' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLDivElement).style.background =
                          'rgba(236, 223, 204, 0.08)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLDivElement).style.background =
                          b === baudrate ? 'rgba(236, 223, 204, 0.08)' : 'transparent'
                      }}
                    >
                      {b}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
            ...(isTransportOpen
              ? {
                  border: '1px solid rgba(236, 223, 204, 0.5)',
                  background: connecting ? 'rgba(236, 223, 204, 0.14)' : 'rgba(236, 223, 204, 0.1)',
                  color: connecting ? 'rgba(236, 223, 204, 0.4)' : 'rgba(236, 223, 204, 0.6)'
                }
              : {
                  border: '1px solid rgba(236, 223, 204, 0.3)',
                  background: connecting
                    ? 'rgba(236, 223, 204, 0.14)'
                    : 'rgba(236, 223, 204, 0.06)',
                  color: connecting ? 'rgba(236, 223, 204, 0.5)' : '#ECDFCC'
                })
          }}
          onMouseEnter={(e) => {
            if (!connecting)
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(236, 223, 204, 0.14)'
          }}
          onMouseLeave={(e) => {
            if (!connecting)
              (e.currentTarget as HTMLButtonElement).style.background = isTransportOpen
                ? 'rgba(236, 223, 204, 0.1)'
                : 'rgba(236, 223, 204, 0.06)'
          }}
        >
          {connecting ? '...' : isTransportOpen ? 'DISCONNECT' : 'CONNECT'}
        </button>
      </div>

      {/* keyframes for the WAITING pulse */}
      <style>{`
        @keyframes dl-link-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.85); }
        }
      `}</style>
    </header>
  )
}
