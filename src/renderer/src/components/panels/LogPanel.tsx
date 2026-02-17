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
  const [size, setSize] = useState({ width: 320, height: 200 })
  const bottomRef = useRef<HTMLDivElement>(null)
  const resizing = useRef(false)
  const resizeStart = useRef({ x: 0, y: 0, w: 320, h: 200 })

  useEffect(() => {
    const update = () => setLogs([...globalLogs])
    listeners.push(update)
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

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return
      const dx = e.clientX - resizeStart.current.x
      const dy = e.clientY - resizeStart.current.y
      setSize({
        width: Math.max(260, resizeStart.current.w + dx),
        height: Math.max(80, resizeStart.current.h + dy)
      })
    }
    const onMouseUp = () => { resizing.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizing.current = true
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height }
  }

  const levelColor = (level: LogEntry['level']) => {
    if (level === 'ERR') return '#ff5555'
    if (level === 'WARN') return '#f5c842'
    return 'rgba(236, 223, 204, 0.5)'
  }

  const msgColor = (level: LogEntry['level']) => {
    if (level === 'ERR') return 'rgba(255, 85, 85, 0.85)'
    if (level === 'WARN') return 'rgba(245, 200, 66, 0.8)'
    return 'rgba(236, 223, 204, 0.6)'
  }

  return (
    <div
      style={{
        position: 'relative',
        background: 'rgba(24, 28, 20, 0.88)',
        border: '1px solid rgba(236, 223, 204, 0.12)',
        borderRadius: '6px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        width: `${size.width}px`
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
        <>
          <div
            style={{
              height: `${size.height}px`,
              overflowY: 'auto',
              padding: '4px 0',
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
                  padding: '3px 12px',
                  alignItems: 'flex-start',
                  background: entry.level === 'ERR'
                    ? 'rgba(255, 85, 85, 0.07)'
                    : entry.level === 'WARN'
                    ? 'rgba(245, 200, 66, 0.04)'
                    : 'transparent'
                }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    color: 'rgba(236, 223, 204, 0.25)',
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
                    fontSize: '11px',
                    fontWeight: 700,
                    color: levelColor(entry.level),
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    marginTop: '1px',
                    minWidth: '30px'
                  }}
                >
                  {entry.level}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    color: msgColor(entry.level),
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

          {/* Resize handle */}
          <div
            onMouseDown={onResizeMouseDown}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '18px',
              height: '18px',
              cursor: 'nwse-resize',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              padding: '3px',
              opacity: 0.35
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9">
              <line x1="1" y1="9" x2="9" y2="1" stroke="#ECDFCC" strokeWidth="1.2" />
              <line x1="4" y1="9" x2="9" y2="4" stroke="#ECDFCC" strokeWidth="1.2" />
              <line x1="7" y1="9" x2="9" y2="7" stroke="#ECDFCC" strokeWidth="1.2" />
            </svg>
          </div>
        </>
      )}
    </div>
  )
}
