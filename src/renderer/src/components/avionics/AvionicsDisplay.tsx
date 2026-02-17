import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function AvionicsDisplay() {
  const telemetry = useTelemetryStore((state) => state.telemetry)

  const isArmed = telemetry?.status.armed || false
  const flightMode = telemetry?.status.flightMode || 'UNKNOWN'

  return (
    <div className="h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-lg border-2 border-primary/30 p-6 flex flex-col justify-center items-center">
      {/* Armed Status */}
      <div className="mb-8">
        <div
          className={`text-6xl font-bold ${
            isArmed ? 'text-danger animate-pulse' : 'text-secondary'
          }`}
        >
          {isArmed ? 'ARMED' : 'DISARMED'}
        </div>
      </div>

      {/* Flight Mode */}
      <div className="mb-6">
        <div className="text-text-tertiary text-sm mb-2">FLIGHT MODE</div>
        <div className="text-4xl font-bold text-primary">{flightMode}</div>
      </div>

      {/* Phase Status */}
      <div className="mt-6">
        <div className="text-text-tertiary text-sm mb-2">PHASE</div>
        <div className="text-3xl font-bold text-secondary">AUTO</div>
      </div>

      {/* Status Indicators */}
      <div className="mt-8 flex gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-secondary animate-pulse"></div>
          <span className="text-xs text-text-tertiary">GPS LOCK</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse"></div>
          <span className="text-xs text-text-tertiary">TELEMETRY</span>
        </div>
      </div>
    </div>
  )
}
