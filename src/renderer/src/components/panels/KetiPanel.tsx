import { useTelemetryStore } from '@renderer/store/telemetryStore'

interface Props {
  onDragHandle: (e: React.MouseEvent) => void
  collapsed: boolean
  onToggle: () => void
}

const OK_GREEN = '#A5D6A7'
const WARN_AMBER = '#f5c842'
const DIM = 'rgba(236, 223, 204, 0.3)'

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
            fontSize: '15px',
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

export function KetiPanel({ onDragHandle, collapsed, onToggle }: Props) {
  const status = useTelemetryStore((s) => s.telemetry?.status)
  // CONNECTED = KETI_OBSTACLE를 최근에 수신(2s 신선도). 무수신이면 상세값 숨김('--').
  const rxMs = status?.ketiRxMs ?? 0
  const connected = rxMs > 0 && Date.now() - rxMs < 2000
  const valid = connected && (status?.ketiValid ?? false)
  const count = status?.ketiCount ?? 0
  const distance = status?.ketiDistance ?? 0
  const objX = status?.ketiObjX ?? 0
  const objY = status?.ketiObjY ?? 0
  const objZ = status?.ketiObjZ ?? 0
  const id = status?.ketiId ?? 0
  const size = status?.ketiSize ?? 0
  const g = (v: string): string => (connected ? v : '--')

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
            KETI OBSTACLE
          </span>
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: !connected ? DIM : valid ? WARN_AMBER : OK_GREEN,
              boxShadow: !connected ? 'none' : valid ? 'none' : `0 0 6px ${OK_GREEN}`
            }}
            title={!connected ? 'NO LINK' : valid ? 'OBSTACLE' : 'CONNECTED'}
          />
        </div>
        <span style={{ color: 'rgba(236, 223, 204, 0.3)', fontSize: '10px' }}>
          {collapsed ? '▲' : '▼'}
        </span>
      </div>

      {!collapsed && (
        <div>
          {/* Link status — CONNECTED when KETI_OBSTACLE is being received */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderBottom: '1px solid rgba(236, 223, 204, 0.08)'
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
              LINK
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                fontWeight: 700,
                color: connected ? OK_GREEN : DIM,
                letterSpacing: '0.05em'
              }}
            >
              {connected ? 'CONNECTED' : 'NO LINK'}
            </span>
          </div>
          {/* Object count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderBottom: '1px solid rgba(236, 223, 204, 0.08)'
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
              OBJECTS
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                fontWeight: 700,
                color: '#ECDFCC',
                letterSpacing: '0.05em'
              }}
            >
              {g(String(count))}
            </span>
          </div>

          {/* Nearest object */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <DataCell label="DIST" value={g(distance.toFixed(1))} unit="m" />
            <DataCell label="SIZE" value={g(size.toFixed(1))} unit="" />
            <DataCell label="OBJ X" value={g(objX.toFixed(1))} unit="m" />
            <DataCell label="OBJ Y" value={g(objY.toFixed(1))} unit="m" />
            <DataCell label="OBJ Z" value={g(objZ.toFixed(1))} unit="m" />
            <DataCell label="TYPE" value={g(String(id))} unit="" />
          </div>
        </div>
      )}
    </div>
  )
}
