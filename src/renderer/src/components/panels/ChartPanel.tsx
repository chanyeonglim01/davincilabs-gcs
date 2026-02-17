import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

interface Props {
  onDragHandle: (e: React.MouseEvent) => void
  collapsed: boolean
  onToggle: () => void
}

const SERIES = [
  { key: 'roll', label: 'ROLL', opacity: 1 },
  { key: 'pitch', label: 'PITCH', opacity: 0.65 },
  { key: 'yaw', label: 'YAW', opacity: 0.35 }
]

export function ChartPanel({ onDragHandle, collapsed, onToggle }: Props) {
  const { history } = useTelemetryStore()
  const [visible, setVisible] = useState({ roll: true, pitch: true, yaw: false })

  const chartData = history.slice(-60).map((d) => ({
    t: d.timestamp,
    roll: parseFloat(((d.attitude.roll * 180) / Math.PI).toFixed(1)),
    pitch: parseFloat(((d.attitude.pitch * 180) / Math.PI).toFixed(1)),
    yaw: parseFloat(((d.attitude.yaw * 180) / Math.PI).toFixed(1))
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
            ATTITUDE CHART
          </span>
        </div>

        {/* Series toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {SERIES.map((s) => (
            <button
              key={s.key}
              onClick={() =>
                setVisible((v) => ({ ...v, [s.key]: !v[s.key as keyof typeof v] }))
              }
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '2px 6px',
                border: '1px solid',
                borderColor: visible[s.key as keyof typeof visible]
                  ? `rgba(236, 223, 204, ${s.opacity})`
                  : 'rgba(236, 223, 204, 0.12)',
                borderRadius: '2px',
                background: 'transparent',
                color: visible[s.key as keyof typeof visible]
                  ? `rgba(236, 223, 204, ${s.opacity})`
                  : 'rgba(236, 223, 204, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {s.label}
            </button>
          ))}
          <span
            onClick={onToggle}
            style={{ color: 'rgba(236, 223, 204, 0.3)', fontSize: '10px', cursor: 'pointer', padding: '0 4px' }}
          >
            {collapsed ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: '8px 4px 8px 0' }}>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="t" hide />
              <YAxis
                domain={[-90, 90]}
                tickCount={5}
                tick={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  fill: 'rgba(236, 223, 204, 0.3)'
                }}
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
                formatter={(val: number) => [`${val.toFixed(1)}°`, '']}
              />
              {visible.roll && (
                <Line
                  dataKey="roll"
                  stroke="rgba(236, 223, 204, 1)"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {visible.pitch && (
                <Line
                  dataKey="pitch"
                  stroke="rgba(236, 223, 204, 0.6)"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {visible.yaw && (
                <Line
                  dataKey="yaw"
                  stroke="rgba(236, 223, 204, 0.3)"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 2"
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
