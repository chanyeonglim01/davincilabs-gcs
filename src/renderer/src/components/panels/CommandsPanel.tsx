import { useState } from 'react'
import type { Command } from '@renderer/types'

interface CmdDef {
  type: Command['type']
  label: string
  params?: Command['params']
  danger?: boolean
}

const COMMANDS: CmdDef[] = [
  { type: 'ARM', label: 'ARM' },
  { type: 'DISARM', label: 'DISARM' },
  { type: 'TAKEOFF', label: 'TAKEOFF', params: { altitude: 10 } },
  { type: 'LAND', label: 'LAND' },
  { type: 'HOLD', label: 'HOLD' },
  { type: 'RTL', label: 'RTL', danger: true }
]

// Fixed panel - no drag
export function CommandsPanel() {
  const [confirming, setConfirming] = useState<CmdDef | null>(null)
  const [loading, setLoading] = useState(false)

  const handleClick = (cmd: CmdDef) => {
    setConfirming(cmd)
  }

  const handleConfirm = async () => {
    if (!confirming) return
    if (!window.mavlink) {
      console.error('MAVLink API not available')
      setConfirming(null)
      return
    }
    setLoading(true)
    try {
      await window.mavlink.sendCommand({ type: confirming.type, params: confirming.params })
    } catch (err) {
      console.error('Command failed:', err)
    } finally {
      setLoading(false)
      setConfirming(null)
    }
  }

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
      {/* Header */}
      <div
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '9px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'rgba(236, 223, 204, 0.45)',
          marginBottom: '10px'
        }}
      >
        COMMANDS
      </div>

      {/* Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {COMMANDS.map((cmd) => (
          <button
            key={cmd.type}
            onClick={() => handleClick(cmd)}
            disabled={loading}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '9px 8px',
              border: cmd.danger
                ? '1px solid rgba(236, 223, 204, 0.35)'
                : '1px solid rgba(236, 223, 204, 0.18)',
              borderRadius: '3px',
              background: cmd.danger
                ? 'rgba(60, 61, 55, 0.6)'
                : 'rgba(60, 61, 55, 0.4)',
              color: cmd.danger
                ? 'rgba(236, 223, 204, 0.9)'
                : 'rgba(236, 223, 204, 0.75)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              textTransform: 'uppercase'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                ;(e.target as HTMLButtonElement).style.background = 'rgba(60, 61, 55, 0.85)'
                ;(e.target as HTMLButtonElement).style.borderColor = 'rgba(236, 223, 204, 0.5)'
                ;(e.target as HTMLButtonElement).style.color = '#ECDFCC'
              }
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLButtonElement).style.background = cmd.danger
                ? 'rgba(60, 61, 55, 0.6)'
                : 'rgba(60, 61, 55, 0.4)'
              ;(e.target as HTMLButtonElement).style.borderColor = cmd.danger
                ? 'rgba(236, 223, 204, 0.35)'
                : 'rgba(236, 223, 204, 0.18)'
              ;(e.target as HTMLButtonElement).style.color = cmd.danger
                ? 'rgba(236, 223, 204, 0.9)'
                : 'rgba(236, 223, 204, 0.75)'
            }}
          >
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Confirm Dialog (inline) */}
      {confirming && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(24, 28, 20, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 100
          }}
          onClick={() => !loading && setConfirming(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1e2218',
              border: '1px solid rgba(236, 223, 204, 0.2)',
              borderRadius: '6px',
              padding: '20px 24px',
              width: '260px',
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
                color: 'rgba(236, 223, 204, 0.45)',
                marginBottom: '8px'
              }}
            >
              CONFIRM
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '20px',
                fontWeight: 700,
                color: '#ECDFCC',
                marginBottom: '16px'
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
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '9px',
                  border: '1px solid rgba(236, 223, 204, 0.15)',
                  borderRadius: '3px',
                  background: 'transparent',
                  color: 'rgba(236, 223, 204, 0.5)',
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
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '9px',
                  border: '1px solid rgba(236, 223, 204, 0.5)',
                  borderRadius: '3px',
                  background: 'rgba(236, 223, 204, 0.08)',
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
    </div>
  )
}
