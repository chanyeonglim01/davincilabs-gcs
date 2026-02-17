import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function AttitudeCharts() {
  const history = useTelemetryStore((state) => state.history)

  const data = useMemo(() => {
    return history.map((t) => ({
      time: new Date(t.timestamp).toLocaleTimeString(),
      roll: (t.attitude.roll * 180) / Math.PI,
      pitch: (t.attitude.pitch * 180) / Math.PI,
      yaw: (t.attitude.yaw * 180) / Math.PI
    }))
  }, [history])

  return (
    <div className="w-full bg-surface rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Attitude</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
          <XAxis
            dataKey="time"
            stroke="hsl(var(--text-tertiary))"
            tick={{ fontSize: 10 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            stroke="hsl(var(--text-tertiary))"
            tick={{ fontSize: 10 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            label={{ value: 'deg', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--surface-elevated))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px'
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            iconType="line"
            iconSize={16}
          />
          <Line
            type="monotone"
            dataKey="roll"
            stroke="#00BFFF"
            strokeWidth={2}
            dot={false}
            name="Roll"
            animationDuration={300}
          />
          <Line
            type="monotone"
            dataKey="pitch"
            stroke="#00CC7A"
            strokeWidth={2}
            dot={false}
            name="Pitch"
            animationDuration={300}
          />
          <Line
            type="monotone"
            dataKey="yaw"
            stroke="#FFB800"
            strokeWidth={2}
            dot={false}
            name="Yaw"
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
