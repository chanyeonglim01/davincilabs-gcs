import { CesiumMap } from './map/CesiumMap'
import { StatusConsole } from './console/StatusConsole'
import { Compass } from './telemetry/Compass'
import { AirspeedIndicator } from './telemetry/AirspeedIndicator'
import { Altimeter } from './telemetry/Altimeter'
import { TelemetryChart } from './telemetry/TelemetryChart'
import { AvionicsDisplay } from './avionics/AvionicsDisplay'
import { PhaseControl } from './avionics/PhaseControl'
import { TelemetryNumbers } from './telemetry/TelemetryNumbers'

export function Dashboard(): React.ReactElement {
  return (
    <div className="h-full flex gap-4 p-4 bg-background">
      {/* Left Column (25%) - Map + Console */}
      <div className="flex-[3] flex flex-col gap-4">
        <div className="flex-1 min-h-0">
          <CesiumMap />
        </div>
        <div className="h-48">
          <StatusConsole />
        </div>
      </div>

      {/* Center Column (45%) - Gauges + Chart */}
      <div className="flex-[5] flex flex-col gap-4">
        {/* Analog Gauges */}
        <div className="h-48">
          <Compass />
        </div>
        <div className="h-48">
          <AirspeedIndicator />
        </div>
        <div className="h-48">
          <Altimeter />
        </div>

        {/* Telemetry Chart with Checkboxes */}
        <div className="flex-1 min-h-0">
          <TelemetryChart />
        </div>
      </div>

      {/* Right Column (30%) - Avionics + Controls + Numbers */}
      <div className="flex-[4] flex flex-col gap-4">
        <div className="flex-1 min-h-0">
          <AvionicsDisplay />
        </div>
        <div>
          <PhaseControl />
        </div>
        <div>
          <TelemetryNumbers />
        </div>
      </div>
    </div>
  )
}
