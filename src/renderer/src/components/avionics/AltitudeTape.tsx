import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function AltitudeTape(): React.ReactElement {
  const altitude = useTelemetryStore((state) => state.telemetry?.position.relative_alt ?? 0)

  // Round to nearest 10m
  const altitudeRounded = Math.round(altitude / 10) * 10

  // Generate tape values (current ±40m, in steps of 10)
  const tapeValues = []
  const step = 10
  const range = 40
  for (let i = -range; i <= range; i += step) {
    tapeValues.push(altitudeRounded + i)
  }

  return (
    <div className="relative h-full w-20 bg-surface-elevated/80 rounded-lg border border-border overflow-hidden">
      {/* Tape background */}
      <div className="absolute inset-0 flex flex-col items-center justify-center py-4">
        {tapeValues.map((value, index) => {
          const offset = ((altitudeRounded - value) / step) * 40 // 40px per step
          const isCurrent = Math.abs(altitudeRounded - value) < 5

          return (
            <div
              key={index}
              className="absolute flex items-center justify-start w-full pl-2"
              style={{ top: `calc(50% + ${offset}px)` }}
            >
              {/* Tick mark */}
              <div className="absolute left-0 h-px w-3 bg-border" />

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
        <span className="text-2xl font-mono font-bold text-primary">
          {Math.round(altitude)}
        </span>
      </div>

      {/* Label */}
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <span className="text-[10px] font-semibold text-text-secondary tracking-wider">
          ALT
        </span>
      </div>
    </div>
  )
}
