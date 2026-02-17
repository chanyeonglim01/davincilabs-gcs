import { useEffect, useRef, useState } from 'react'

interface Props {
  onDragHandle: (e: React.MouseEvent) => void
  collapsed: boolean
  onToggle: () => void
}

interface LogEntry {
  id: number
  time: string
  level: 'INFO' | 'WARN' | 'ERR'
  msg: string
}

let logId = 0
const globalLogs: LogEntry[] = []
const listeners: Array<() => void> = []

export function addLog(level: LogEntry['level'], msg: string) {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  globalLogs.push({ id: logId++, time, level, msg })
  if (globalLogs.length > 200) globalLogs.shift()
  listeners.forEach((fn) => fn())
}

export function LogPanel({ onDragHandle, collapsed, onToggle }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([...globalLogs])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => setLogs([...globalLogs])
    listeners.push(update)

    // Initial demo logs
    if (globalLogs.length === 0) {
      addLog('INFO', 'GCS initialized')
      addLog('INFO', 'Awaiting MAVLink connection...')
    }

    return () => {
      const idx = listeners.indexOf(update)
      if (idx >= 0) listeners.splice(idx, 1)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const levelColor = (level: LogEntry['level']) => {
    if (level === 'ERR') return 'rgba(236, 223, 204, 0.9)'
    if (level === 'WARN') return 'rgba(236, 223, 204, 0.65)'
    return 'rgba(236, 223, 204, 0.4)'
  }

  return (
    <div
      style={{
        background: 'rgba(24, 28, 20, 0.88)',
        border: '1px solid rgba(236, 223, 204, 0.12)',
        borderRadius: '6px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        width: '320px'
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
                    style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#ECDFCC' }}
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
            SYSTEM LOG
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '9px',
              color: 'rgba(236, 223, 204, 0.25)'
            }}
          >
            {logs.length}
          </span>
          <span style={{ color: 'rgba(236, 223, 204, 0.3)', fontSize: '10px' }}>
            {collapsed ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {!collapsed && (
        <div
          style={{
            height: '140px',
            overflowY: 'auto',
            padding: '6px 0',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(236, 223, 204, 0.15) transparent'
          }}
        >
          {logs.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                gap: '8px',
                padding: '2px 12px',
                alignItems: 'flex-start'
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '9px',
                  color: 'rgba(236, 223, 204, 0.2)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  marginTop: '1px'
                }}
              >
                {entry.time}
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '9px',
                  color: levelColor(entry.level),
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  marginTop: '1px',
                  minWidth: '28px'
                }}
              >
                {entry.level}
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '9px',
                  color: 'rgba(236, 223, 204, 0.55)',
                  lineHeight: '1.4',
                  wordBreak: 'break-all'
                }}
              >
                {entry.msg}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
