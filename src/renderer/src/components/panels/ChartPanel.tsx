import { useState } from 'react'
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
    unit: '°',
    domain: [-90, 90] as [number, number],
    formatter: (v: number) => `${v.toFixed(1)}°`,
    series: [
      { key: 'roll',  label: 'ROLL' },
      { key: 'pitch', label: 'PITCH' },
      { key: 'yaw',   label: 'YAW' },
    ]
  },
  {
    id: 'rate',
    title: 'RATE',
    unit: '°/s',
    domain: [-60, 60] as [number, number],
    formatter: (v: number) => `${v.toFixed(1)}°/s`,
    series: [
      { key: 'rollrate',  label: 'ROLL' },
      { key: 'pitchrate', label: 'PITCH' },
      { key: 'yawrate',   label: 'YAW' },
    ]
  },
  {
    id: 'speed',
    title: 'SPEED',
    unit: 'm/s',
    domain: [0, 40] as [number, number],
    formatter: (v: number) => `${v.toFixed(1)} m/s`,
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
      onClick={onClick}
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
  const [visible, setVisible] = useState<VisibleState>({
    roll: true, pitch: true, yaw: false,
    rollrate: true, pitchrate: true, yawrate: false,
    gndspd: true, airspd: true,
  })

  const toggle = (key: string) => setVisible((v) => ({ ...v, [key]: !v[key] }))

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
        background: 'rgba(24, 28, 20, 0.88)',
        border: '1px solid rgba(236, 223, 204, 0.12)',
        borderRadius: '6px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        width: '420px'
      }}
    >
      {/* Drag Handle */}
      <div
        onMouseDown={onDragHandle}
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
        <div style={{ padding: '4px 0' }}>
          {CHARTS.map((chart, ci) => (
            <div
              key={chart.id}
              style={{
                borderTop: ci > 0 ? '1px solid rgba(236, 223, 204, 0.06)' : 'none',
                padding: '6px 0 2px'
              }}
            >
              {/* Sub-header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                  marginBottom: '4px'
                }}
              >
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '8px', fontWeight: 600, color: 'rgba(236, 223, 204, 0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {chart.title}
                </span>
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
              </div>

              {/* Chart */}
              <ResponsiveContainer width="100%" height={90}>
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
                    formatter={(val: number) => [chart.formatter(val), '']}
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
          ))}
        </div>
      )}
    </div>
  )
}
