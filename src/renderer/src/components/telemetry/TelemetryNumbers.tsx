import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function TelemetryNumbers() {
  const telemetry = useTelemetryStore((state) => state.telemetry)

  if (!telemetry) {
    return (
      <div className="bg-surface rounded-lg border border-border p-4">
        <p className="text-text-tertiary text-center">No telemetry data</p>
      </div>
    )
  }

  const altitude = telemetry.position.relative_alt.toFixed(2)
  const groundspeed = telemetry.velocity.groundspeed.toFixed(2)
  const yaw = (telemetry.attitude.yaw * (180 / Math.PI)).toFixed(2)
  const vspeed = telemetry.velocity.vz.toFixed(2)
  const distToWP = telemetry.position.distance_to_wp?.toFixed(2) || '0.00'
  const distToMAV = '320.34' // TODO: Calculate actual distance

  const MetricDisplay = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
    <div className="flex flex-col items-center justify-center p-3 bg-surface-elevated rounded border border-border">
      <div className="text-xs text-text-tertiary mb-1">{label}</div>
      <div className="text-3xl font-bold text-secondary">{value}</div>
      <div className="text-xs text-text-tertiary mt-1">{unit}</div>
    </div>
  )

  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <div className="grid grid-cols-2 gap-3">
        <MetricDisplay label="Altitude" value={altitude} unit="m" />
        <MetricDisplay label="GndSpeed" value={groundspeed} unit="m/s" />
        <MetricDisplay label="Dist to WP" value={distToWP} unit="m" />
        <MetricDisplay label="Yaw" value={yaw} unit="deg" />
        <MetricDisplay label="V.Speed" value={vspeed} unit="m/s" />
        <MetricDisplay label="DistToMAV" value={distToMAV} unit="m" />
      </div>
    </div>
  )
}
