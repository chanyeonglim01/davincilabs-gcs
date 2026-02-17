import { useState, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

interface Props {
  onDragHandle: (e: React.MouseEvent) => void
  collapsed: boolean
  onToggle: () => void
}

const ACTIVE_COLOR = 'rgba(236, 223, 204, 0.9)'
const INACTIVE_COLOR = 'rgba(236, 223, 204, 0.2)'
const INACTIVE_BORDER = 'rgba(236, 223, 204, 0.12)'

const LINE_STYLES = [
  { strokeDasharray: undefined, opacity: 1.0 },
  { strokeDasharray: '5 2',     opacity: 0.7 },
  { strokeDasharray: '2 2',     opacity: 0.45 },
]

const CHARTS = [
  {
    id: 'attitude',
    title: 'ATTITUDE',
    formatter: (v: number | undefined) => v != null ? `${v.toFixed(1)}°` : '--',
    domain: [-90, 90] as [number, number],
    series: [
      { key: 'roll',  label: 'ROLL' },
      { key: 'pitch', label: 'PITCH' },
      { key: 'yaw',   label: 'YAW' },
    ]
  },
  {
    id: 'rate',
    title: 'RATE',
    formatter: (v: number | undefined) => v != null ? `${v.toFixed(1)}°/s` : '--',
    domain: [-60, 60] as [number, number],
    series: [
      { key: 'rollrate',  label: 'ROLL' },
      { key: 'pitchrate', label: 'PITCH' },
      { key: 'yawrate',   label: 'YAW' },
    ]
  },
  {
    id: 'speed',
    title: 'SPEED',
    formatter: (v: number | undefined) => v != null ? `${v.toFixed(1)} m/s` : '--',
    domain: [0, 40] as [number, number],
    series: [
      { key: 'gndspd', label: 'GND' },
      { key: 'airspd', label: 'AIR' },
    ]
  }
]

type VisibleState = Record<string, boolean>

function SeriesToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '2px 6px',
        border: `1px solid ${active ? ACTIVE_COLOR : INACTIVE_BORDER}`,
        borderRadius: '2px',
        background: 'transparent',
        color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
    >
      {label}
    </button>
  )
}

export function ChartPanel({ onDragHandle, collapsed, onToggle }: Props) {
  const { history } = useTelemetryStore()
  const [size, setSize] = useState({ width: 420, height: 360 })
  const [chartCollapsed, setChartCollapsed] = useState<Record<string, boolean>>({
    attitude: false, rate: false, speed: false
  })
  const [visible, setVisible] = useState<VisibleState>({
    roll: true, pitch: true, yaw: false,
    rollrate: true, pitchrate: true, yawrate: false,
    gndspd: true, airspd: true,
  })
  const resizing = useRef(false)
  const resizeStart = useRef({ x: 0, y: 0, w: 420, h: 360 })

  const toggle = (key: string) => setVisible((v) => ({ ...v, [key]: !v[key] }))
  const toggleChart = (id: string) => setChartCollapsed((v) => ({ ...v, [id]: !v[id] }))

  const SUBHEADER_HEIGHT = 32 // px per chart section header
  const openCount = CHARTS.filter((c) => !chartCollapsed[c.id]).length
  const totalHeadersHeight = CHARTS.length * SUBHEADER_HEIGHT
  const perChartHeight = openCount > 0
    ? Math.max(60, Math.floor((size.height - totalHeadersHeight) / openCount))
    : 0

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return
      const dx = e.clientX - resizeStart.current.x
      const dy = e.clientY - resizeStart.current.y
      setSize({
        width: Math.max(300, resizeStart.current.w + dx),
        height: Math.max(120, resizeStart.current.h + dy)
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

  const chartData = history.slice(-60).map((d) => ({
    t: d.timestamp,
    roll:      parseFloat(((d.attitude.roll      * 180) / Math.PI).toFixed(1)),
    pitch:     parseFloat(((d.attitude.pitch     * 180) / Math.PI).toFixed(1)),
    yaw:       parseFloat(((d.attitude.yaw       * 180) / Math.PI).toFixed(1)),
    rollrate:  parseFloat(((d.attitude.rollspeed  * 180) / Math.PI).toFixed(1)),
    pitchrate: parseFloat(((d.attitude.pitchspeed * 180) / Math.PI).toFixed(1)),
    yawrate:   parseFloat(((d.attitude.yawspeed   * 180) / Math.PI).toFixed(1)),
    gndspd:    parseFloat(d.velocity.groundspeed.toFixed(1)),
    airspd:    parseFloat(d.velocity.airspeed.toFixed(1)),
  }))

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
                  <div key={j} style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#ECDFCC' }} />
                ))}
              </div>
            ))}
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '9px', fontWeight: 600, color: 'rgba(236, 223, 204, 0.45)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            CHARTS
          </span>
        </div>
        <span
          onClick={onToggle}
          style={{ color: 'rgba(236, 223, 204, 0.3)', fontSize: '10px', cursor: 'pointer', padding: '0 4px' }}
        >
          {collapsed ? '▲' : '▼'}
        </span>
      </div>

      {!collapsed && (
        <>
          <div style={{ padding: '4px 0' }}>
            {CHARTS.map((chart, ci) => (
              <div
                key={chart.id}
                style={{
                  borderTop: ci > 0 ? '1px solid rgba(236, 223, 204, 0.06)' : 'none',
                }}
              >
                {/* Sub-header — click title to toggle chart */}
                <div
                  onClick={() => toggleChart(chart.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px 4px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'rgba(236, 223, 204, 0.25)', fontSize: '8px' }}>
                      {chartCollapsed[chart.id] ? '▶' : '▼'}
                    </span>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '8px', fontWeight: 600, color: 'rgba(236, 223, 204, 0.4)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      {chart.title}
                    </span>
                  </div>
                  {!chartCollapsed[chart.id] && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {chart.series.map((s) => (
                        <SeriesToggle
                          key={s.key}
                          label={s.label}
                          active={!!visible[s.key]}
                          onClick={() => toggle(s.key)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Chart body */}
                {!chartCollapsed[chart.id] && (
                  <div style={{ padding: '0 0 6px' }}>
                    <ResponsiveContainer width="100%" height={perChartHeight}>
                      <LineChart data={chartData} margin={{ top: 2, right: 8, left: -24, bottom: 0 }}>
                        <XAxis dataKey="t" hide />
                        <YAxis
                          domain={chart.domain}
                          tickCount={3}
                          tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fill: 'rgba(236, 223, 204, 0.3)' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#181C14',
                            border: '1px solid rgba(236, 223, 204, 0.15)',
                            borderRadius: '4px',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '10px',
                            color: '#ECDFCC'
                          }}
                          labelFormatter={() => ''}
                          formatter={chart.formatter}
                        />
                        {chart.series.map((s, si) =>
                          visible[s.key] ? (
                            <Line
                              key={s.key}
                              dataKey={s.key}
                              stroke={`rgba(236, 223, 204, ${LINE_STYLES[si].opacity})`}
                              strokeWidth={1.5}
                              strokeDasharray={LINE_STYLES[si].strokeDasharray}
                              dot={false}
                              isAnimationActive={false}
                            />
                          ) : null
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
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
