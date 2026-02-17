import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

interface DataPoint {
  timestamp: number
  roll?: number
  pitch?: number
  yaw?: number
  groundspeed?: number
  rollRate?: number
  pitchRate?: number
  yawRate?: number
  altitude?: number
  voltage?: number
}

export function TelemetryChart() {
  const telemetry = useTelemetryStore((state) => state.telemetry)
  const [data, setData] = useState<DataPoint[]>([])
  const [selectedMetrics, setSelectedMetrics] = useState({
    roll: true,
    pitch: true,
    yaw: false,
    groundspeed: false,
    rollRate: false,
    pitchRate: false,
    yawRate: false,
    altitude: false,
    voltage: false
  })

  // Update data when telemetry changes
  useEffect(() => {
    if (telemetry) {
      const newPoint: DataPoint = {
        timestamp: Date.now(),
        roll: telemetry.attitude.roll * (180 / Math.PI),
        pitch: telemetry.attitude.pitch * (180 / Math.PI),
        yaw: telemetry.attitude.yaw * (180 / Math.PI),
        groundspeed: telemetry.velocity.groundspeed,
        rollRate: telemetry.attitude.rollspeed * (180 / Math.PI),
        pitchRate: telemetry.attitude.pitchspeed * (180 / Math.PI),
        yawRate: telemetry.attitude.yawspeed * (180 / Math.PI),
        altitude: telemetry.position.relative_alt,
        voltage: telemetry.battery.voltage
      }

      setData((prev) => {
        const updated = [...prev, newPoint]
        return updated.slice(-100) // Keep last 100 points
      })
    }
  }, [telemetry])

  const toggleMetric = (metric: keyof typeof selectedMetrics) => {
    setSelectedMetrics((prev) => ({ ...prev, [metric]: !prev[metric] }))
  }

  const chartColors = {
    roll: '#00d9ff',
    pitch: '#39ff14',
    yaw: '#fbbf24',
    groundspeed: '#a855f7',
    rollRate: '#3b82f6',
    pitchRate: '#10b981',
    yawRate: '#f59e0b',
    altitude: '#ec4899',
    voltage: '#06b6d4'
  }

  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold mb-2">Telemetry Data</h3>
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedMetrics.roll}
              onChange={() => toggleMetric('roll')}
              className="w-4 h-4"
            />
            <span>Roll</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedMetrics.pitch}
              onChange={() => toggleMetric('pitch')}
              className="w-4 h-4"
            />
            <span>Pitch</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedMetrics.yaw}
              onChange={() => toggleMetric('yaw')}
              className="w-4 h-4"
            />
            <span>Yaw</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedMetrics.groundspeed}
              onChange={() => toggleMetric('groundspeed')}
              className="w-4 h-4"
            />
            <span>Ground Speed</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedMetrics.rollRate}
              onChange={() => toggleMetric('rollRate')}
              className="w-4 h-4"
            />
            <span>Roll Rate</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedMetrics.pitchRate}
              onChange={() => toggleMetric('pitchRate')}
              className="w-4 h-4"
            />
            <span>Pitch Rate</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedMetrics.yawRate}
              onChange={() => toggleMetric('yawRate')}
              className="w-4 h-4"
            />
            <span>Yaw Rate</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedMetrics.altitude}
              onChange={() => toggleMetric('altitude')}
              className="w-4 h-4"
            />
            <span>Altitude</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedMetrics.voltage}
              onChange={() => toggleMetric('voltage')}
              className="w-4 h-4"
            />
            <span>Battery Voltage</span>
          </label>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
            stroke="#888"
            tick={{ fontSize: 10 }}
          />
          <YAxis stroke="#888" tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
            labelFormatter={(ts) => new Date(ts as number).toLocaleTimeString()}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />

          {selectedMetrics.roll && (
            <Line
              type="monotone"
              dataKey="roll"
              stroke={chartColors.roll}
              dot={false}
              name="Roll (deg)"
              strokeWidth={2}
            />
          )}
          {selectedMetrics.pitch && (
            <Line
              type="monotone"
              dataKey="pitch"
              stroke={chartColors.pitch}
              dot={false}
              name="Pitch (deg)"
              strokeWidth={2}
            />
          )}
          {selectedMetrics.yaw && (
            <Line
              type="monotone"
              dataKey="yaw"
              stroke={chartColors.yaw}
              dot={false}
              name="Yaw (deg)"
              strokeWidth={2}
            />
          )}
          {selectedMetrics.groundspeed && (
            <Line
              type="monotone"
              dataKey="groundspeed"
              stroke={chartColors.groundspeed}
              dot={false}
              name="Ground Speed (m/s)"
              strokeWidth={2}
            />
          )}
          {selectedMetrics.rollRate && (
            <Line
              type="monotone"
              dataKey="rollRate"
              stroke={chartColors.rollRate}
              dot={false}
              name="Roll Rate (deg/s)"
              strokeWidth={2}
            />
          )}
          {selectedMetrics.pitchRate && (
            <Line
              type="monotone"
              dataKey="pitchRate"
              stroke={chartColors.pitchRate}
              dot={false}
              name="Pitch Rate (deg/s)"
              strokeWidth={2}
            />
          )}
          {selectedMetrics.yawRate && (
            <Line
              type="monotone"
              dataKey="yawRate"
              stroke={chartColors.yawRate}
              dot={false}
              name="Yaw Rate (deg/s)"
              strokeWidth={2}
            />
          )}
          {selectedMetrics.altitude && (
            <Line
              type="monotone"
              dataKey="altitude"
              stroke={chartColors.altitude}
              dot={false}
              name="Altitude (m)"
              strokeWidth={2}
            />
          )}
          {selectedMetrics.voltage && (
            <Line
              type="monotone"
              dataKey="voltage"
              stroke={chartColors.voltage}
              dot={false}
              name="Voltage (V)"
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
