import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function AirspeedTape(): React.ReactElement {
  const airspeed = useTelemetryStore((state) => state.telemetry?.velocity.airspeed ?? 0)

  // Convert m/s to knots
  const speedKnots = Math.round(airspeed * 1.944)

  // Generate tape values (current ±20 knots, in steps of 10)
  const tapeValues = []
  const step = 10
  const range = 20
  for (let i = -range; i <= range; i += step) {
    tapeValues.push(speedKnots + i)
  }

  return (
    <div className="relative h-full w-20 bg-surface-elevated/80 rounded-lg border border-border overflow-hidden">
      {/* Tape background */}
      <div className="absolute inset-0 flex flex-col items-center justify-center py-4">
        {tapeValues.map((value, index) => {
          const offset = ((speedKnots - value) / step) * 40 // 40px per step
          const isCurrent = Math.abs(speedKnots - value) < 5

          return (
            <div
              key={index}
              className="absolute flex items-center justify-end w-full pr-2"
              style={{ top: `calc(50% + ${offset}px)` }}
            >
              {/* Tick mark */}
              <div className="absolute right-0 h-px w-3 bg-border" />

              {/* Value label */}
              {value % 10 === 0 && value >= 0 && (
                <span
                  className={`text-xs font-mono ${
                    isCurrent ? 'text-foreground font-bold' : 'text-text-tertiary'
                  }`}
                >
                  {value}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Center indicator box */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-10 border-y-2 border-primary bg-primary/10 flex items-center justify-center">
        <span className="text-2xl font-mono font-bold text-primary">{speedKnots}</span>
      </div>

      {/* Label */}
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <span className="text-[10px] font-semibold text-text-secondary tracking-wider">
          IAS
        </span>
      </div>
    </div>
  )
}
