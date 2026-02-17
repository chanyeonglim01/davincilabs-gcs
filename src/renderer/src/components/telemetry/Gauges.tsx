import { useTelemetryStore } from '@renderer/store/telemetryStore'
import { Card } from '@renderer/components/ui/card'

export function Gauges() {
  const telemetry = useTelemetryStore((state) => state.telemetry)

  const gaugeItems = [
    {
      label: 'Altitude (m)',
      value: telemetry?.position.relative_alt.toFixed(2) ?? '0.00',
      color: 'text-green-400'
    },
    {
      label: 'Airspeed (m/s)',
      value: telemetry?.velocity.airspeed.toFixed(2) ?? '0.00',
      color: 'text-blue-400'
    },
    {
      label: 'Ground Speed (m/s)',
      value: telemetry?.velocity.groundspeed.toFixed(2) ?? '0.00',
      color: 'text-cyan-400'
    },
    {
      label: 'Climb Rate (m/s)',
      value: telemetry?.velocity.climb.toFixed(2) ?? '0.00',
      color: 'text-yellow-400'
    },
    {
      label: 'Yaw (deg)',
      value: ((telemetry?.attitude.yaw ?? 0) * (180 / Math.PI)).toFixed(2),
      color: 'text-purple-400'
    },
    {
      label: 'Roll (deg)',
      value: ((telemetry?.attitude.roll ?? 0) * (180 / Math.PI)).toFixed(2),
      color: 'text-pink-400'
    }
  ]

  return (
    <Card className="p-3 bg-gray-900/50 border-gray-700">
      <h3 className="text-xs font-semibold text-gray-400 mb-3">TELEMETRY</h3>
      <div className="space-y-2">
        {gaugeItems.map((item) => (
          <div key={item.label} className="flex justify-between items-center py-1 border-b border-gray-800">
            <span className="text-xs text-gray-500">{item.label}</span>
            <span className={`text-sm font-mono font-bold ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
