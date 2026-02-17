import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function HeadingBar(): React.ReactElement {
  const heading = useTelemetryStore((state) => state.telemetry?.heading ?? 0)

  // Round to nearest degree
  const headingRounded = Math.round(heading)

  // Generate heading marks (every 30 degrees)
  const headingMarks = []
  for (let i = 0; i < 360; i += 30) {
    headingMarks.push(i)
  }

  // Calculate offset for scrolling effect
  const offset = (headingRounded % 360) * 2 // 2px per degree

  // Cardinal directions
  const getCardinal = (deg: number): string => {
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const index = Math.round((deg % 360) / 45) % 8
    return cardinals[index]
  }

  return (
    <div className="relative h-14 w-full bg-surface-elevated/80 rounded-lg border border-border overflow-hidden">
      {/* Heading tape */}
      <div className="absolute top-0 left-0 right-0 h-10 overflow-hidden">
        <div
          className="absolute top-2 flex items-center"
          style={{
            left: `calc(50% - ${offset}px)`,
            transform: 'translateX(-50%)'
          }}
        >
          {headingMarks.map((deg) => (
            <div key={deg} className="flex flex-col items-center" style={{ width: '60px' }}>
              {/* Tick mark */}
              <div className="h-2 w-px bg-border" />

              {/* Cardinal/degree label */}
              <span className="text-[10px] font-mono text-text-tertiary mt-1">
                {deg % 90 === 0 ? getCardinal(deg) : deg}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Center indicator triangle */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2">
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-primary" />
      </div>

      {/* Current heading display */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-primary/20 border border-primary rounded px-3 py-0.5">
        <span className="text-lg font-mono font-bold text-primary">
          {headingRounded.toString().padStart(3, '0')}°
        </span>
      </div>

      {/* Label */}
      <div className="absolute bottom-1 left-2">
        <span className="text-[10px] font-semibold text-text-secondary tracking-wider">HDG</span>
      </div>
    </div>
  )
}
