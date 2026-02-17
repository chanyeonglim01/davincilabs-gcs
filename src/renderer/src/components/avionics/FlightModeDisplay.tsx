import { useTelemetryStore } from '@renderer/store/telemetryStore'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'

export function FlightModeDisplay() {
  const telemetry = useTelemetryStore((state) => state.telemetry)
  const connection = useTelemetryStore((state) => state.connection)

  const armed = telemetry?.status.armed ?? false
  const mode = telemetry?.status.flightMode ?? 'UNKNOWN'
  const systemStatus = telemetry?.status.systemStatus ?? 'UNKNOWN'
  const battery = telemetry?.status.battery ?? { voltage: 0, current: 0, remaining: -1 }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Flight Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Connection</span>
          <span
            className={`font-bold ${connection.connected ? 'text-green-500' : 'text-red-500'}`}
          >
            {connection.connected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Armed Status</span>
          <span className={`font-bold ${armed ? 'text-red-500' : 'text-green-500'}`}>
            {armed ? 'ARMED' : 'DISARMED'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Flight Mode</span>
          <span className="font-mono text-primary">{mode}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">System Status</span>
          <span className="font-mono text-sm">{systemStatus}</span>
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Battery Voltage</span>
            <span className="font-mono">{battery.voltage.toFixed(2)} V</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current</span>
            <span className="font-mono">{battery.current.toFixed(2)} A</span>
          </div>

          {battery.remaining >= 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Remaining</span>
              <span
                className={`font-mono ${
                  battery.remaining < 20
                    ? 'text-red-500'
                    : battery.remaining < 50
                      ? 'text-yellow-500'
                      : 'text-green-500'
                }`}
              >
                {battery.remaining}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
