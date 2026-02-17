import { useTelemetryStore } from '@renderer/store/telemetryStore'
import { AttitudeIndicator } from '../telemetry/AttitudeIndicator'
import { AirspeedTape } from './AirspeedTape'
import { AltitudeTape } from './AltitudeTape'
import { HeadingBar } from './HeadingBar'
import { Battery, Satellite } from 'lucide-react'

export function PrimaryFlightDisplay(): React.ReactElement {
  const telemetry = useTelemetryStore((state) => state.telemetry)
  const flightMode = telemetry?.status.flightMode ?? 'UNKNOWN'
  const battery = telemetry?.status.battery.remaining ?? -1
  const armed = telemetry?.status.armed ?? false

  // Mock GPS satellites count (would come from telemetry in real implementation)
  const gpsSats = 15

  return (
    <div className="relative h-[400px] w-full bg-surface rounded-lg border border-border p-4">
      {/* Top Status Overlay */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        {/* Flight Mode */}
        <div
          className={`px-3 py-1 rounded-lg border font-semibold text-sm ${
            armed
              ? 'bg-secondary/20 border-secondary text-secondary'
              : 'bg-muted/20 border-muted text-muted-foreground'
          }`}
        >
          {flightMode}
        </div>

        {/* Battery */}
        <div className="flex items-center gap-2 px-3 py-1 bg-surface-elevated/90 rounded-lg border border-border">
          <Battery className="w-4 h-4 text-warning" />
          <span
            className={`text-sm font-mono font-semibold ${
              battery >= 0 ? (battery > 20 ? 'text-foreground' : 'text-danger') : 'text-muted-foreground'
            }`}
          >
            {battery >= 0 ? `${battery}%` : '--'}
          </span>
        </div>

        {/* GPS Status */}
        <div className="flex items-center gap-2 px-3 py-1 bg-surface-elevated/90 rounded-lg border border-border">
          <Satellite className="w-4 h-4 text-primary" />
          <span className="text-sm font-mono font-semibold text-foreground">{gpsSats}</span>
        </div>
      </div>

      {/* Main PFD Layout */}
      <div className="flex items-center justify-center h-full gap-2 pt-8">
        {/* Airspeed Tape (Left) */}
        <div className="h-80">
          <AirspeedTape />
        </div>

        {/* Attitude Indicator (Center) */}
        <div className="flex-1 h-80 max-w-md">
          <AttitudeIndicator />
        </div>

        {/* Altitude Tape (Right) */}
        <div className="h-80">
          <AltitudeTape />
        </div>
      </div>

      {/* Heading Bar (Bottom) */}
      <div className="absolute bottom-4 left-4 right-4">
        <HeadingBar />
      </div>
    </div>
  )
}
