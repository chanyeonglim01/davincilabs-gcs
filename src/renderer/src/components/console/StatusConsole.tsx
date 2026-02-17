import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import type { LogEntry } from '@renderer/types'

export function StatusConsole() {
  const telemetry = useTelemetryStore((state) => state.telemetry)
  const connection = useTelemetryStore((state) => state.connection)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  useEffect(() => {
    // Add initial log
    setLogs((prev) => [
      ...prev,
      {
        level: 'info',
        message: `GCS initialized in ${connection.mode} mode`,
        timestamp: Date.now()
      }
    ])

    // Listen for log messages from Main Process
    if (window.mavlink && window.mavlink.onLogMessage) {
      const unsubscribe = window.mavlink.onLogMessage((entry) => {
        setLogs((prev) => [...prev.slice(-99), entry])
      })
      return unsubscribe
    }

    return undefined
  }, [connection.mode])

  useEffect(() => {
    if (connection.connected) {
      setLogs((prev) => [
        ...prev,
        {
          level: 'info',
          message: `Connected to ${connection.host}:${connection.port}`,
          timestamp: Date.now()
        }
      ])
    } else {
      setLogs((prev) => [
        ...prev,
        {
          level: 'warn',
          message: 'Disconnected from vehicle',
          timestamp: Date.now()
        }
      ])
    }
  }, [connection.connected, connection.host, connection.port])

  useEffect(() => {
    if (telemetry && logs.length > 0) {
      const lastLog = logs[logs.length - 1]
      if (Date.now() - lastLog.timestamp > 5000) {
        setLogs((prev) => [
          ...prev,
          {
            level: 'info',
            message: `Telemetry: ${telemetry.status.flightMode} | Alt: ${telemetry.position.relative_alt.toFixed(1)}m | Speed: ${telemetry.velocity.groundspeed.toFixed(1)}m/s`,
            timestamp: Date.now()
          }
        ])
      }
    }
  }, [telemetry, logs])

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-danger'
      case 'warn':
        return 'text-warning'
      case 'info':
      default:
        return 'text-primary'
    }
  }

  const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.level === filter)

  return (
    <div className="w-full h-64 bg-surface rounded-lg border border-border">
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h3 className="font-semibold">System Log</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            className="h-8 px-3 text-xs"
          >
            ALL
          </Button>
          <Button
            size="sm"
            variant={filter === 'info' ? 'default' : 'outline'}
            onClick={() => setFilter('info')}
            className="h-8 px-3 text-xs"
          >
            INFO
          </Button>
          <Button
            size="sm"
            variant={filter === 'warn' ? 'default' : 'outline'}
            onClick={() => setFilter('warn')}
            className="h-8 px-3 text-xs"
          >
            WARN
          </Button>
          <Button
            size="sm"
            variant={filter === 'error' ? 'default' : 'outline'}
            onClick={() => setFilter('error')}
            className="h-8 px-3 text-xs"
          >
            ERROR
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className="p-4 font-mono text-xs space-y-1 h-44 overflow-y-auto">
        {filteredLogs.map((log, index) => (
          <div key={index} className="flex gap-2">
            <span className="text-text-tertiary text-xs">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={getLevelColor(log.level)}>[{log.level.toUpperCase()}]</span>
            <span>{log.message}</span>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="text-muted-foreground">
            {filter === 'all' ? 'No logs yet...' : `No ${filter} logs...`}
          </div>
        )}
      </div>
    </div>
  )
}
