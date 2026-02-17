import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function AttitudeIndicator(): React.ReactElement {
  const attitude = useTelemetryStore((state) => state.telemetry?.attitude)

  // Convert radians to degrees
  const roll = ((attitude?.roll ?? 0) * 180) / Math.PI
  const pitch = ((attitude?.pitch ?? 0) * 180) / Math.PI

  // Pitch scale - limit to ±30 degrees visible range
  const pitchOffset = Math.max(-30, Math.min(30, pitch)) * 2.5 // pixels per degree

  return (
    <div className="relative w-full h-full bg-surface-elevated rounded-lg overflow-hidden border border-border">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          {/* Clip path for circular display */}
          <clipPath id="attitude-clip">
            <circle cx="100" cy="100" r="85" />
          </clipPath>

          {/* Gradient for sky */}
          <linearGradient id="sky-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#1e40af', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
          </linearGradient>

          {/* Gradient for ground */}
          <linearGradient id="ground-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#92400e', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#78350f', stopOpacity: 1 }} />
          </linearGradient>
        </defs>

        {/* Rotating horizon group */}
        <g clipPath="url(#attitude-clip)">
          <g transform={`rotate(${-roll} 100 100) translate(0 ${pitchOffset})`}>
            {/* Sky */}
            <rect x="0" y="-200" width="200" height="300" fill="url(#sky-gradient)" />

            {/* Ground */}
            <rect x="0" y="100" width="200" height="300" fill="url(#ground-gradient)" />

            {/* Horizon line */}
            <line x1="0" y1="100" x2="200" y2="100" stroke="#fff" strokeWidth="3" />

            {/* Pitch ladder - positive (climb) */}
            {[10, 20, 30, 40, 50, 60].map((deg) => {
              const y = 100 - deg * 2.5
              const width = deg % 20 === 0 ? 40 : 20
              return (
                <g key={`pitch-up-${deg}`}>
                  <line
                    x1={100 - width}
                    y1={y}
                    x2={100 + width}
                    y2={y}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  {deg % 20 === 0 && (
                    <>
                      <text
                        x={100 - width - 15}
                        y={y + 5}
                        fill="#fff"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {deg}
                      </text>
                      <text
                        x={100 + width + 5}
                        y={y + 5}
                        fill="#fff"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {deg}
                      </text>
                    </>
                  )}
                </g>
              )
            })}

            {/* Pitch ladder - negative (dive) */}
            {[-10, -20, -30, -40, -50, -60].map((deg) => {
              const y = 100 - deg * 2.5
              const width = deg % 20 === 0 ? 40 : 20
              return (
                <g key={`pitch-down-${deg}`}>
                  {/* Dashed line for negative pitch */}
                  <line x1={100 - width} y1={y} x2={100 - 5} y2={y} stroke="#fff" strokeWidth="2" />
                  <line x1={100 + 5} y1={y} x2={100 + width} y2={y} stroke="#fff" strokeWidth="2" />
                  {deg % 20 === 0 && (
                    <>
                      <text
                        x={100 - width - 15}
                        y={y + 5}
                        fill="#fff"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {Math.abs(deg)}
                      </text>
                      <text
                        x={100 + width + 5}
                        y={y + 5}
                        fill="#fff"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {Math.abs(deg)}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          </g>
        </g>

        {/* Fixed aircraft symbol (center) */}
        <g>
          {/* Center dot */}
          <circle cx="100" cy="100" r="3" fill="#fbbf24" />

          {/* Left wing */}
          <line x1="40" y1="100" x2="90" y2="100" stroke="#fbbf24" strokeWidth="4" />
          <line x1="40" y1="100" x2="45" y2="105" stroke="#fbbf24" strokeWidth="3" />

          {/* Right wing */}
          <line x1="110" y1="100" x2="160" y2="100" stroke="#fbbf24" strokeWidth="4" />
          <line x1="160" y1="100" x2="155" y2="105" stroke="#fbbf24" strokeWidth="3" />
        </g>

        {/* Roll scale (outer ring) */}
        <g>
          {/* Roll arc marks */}
          {[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map((angle) => {
            const isMajor = angle % 30 === 0
            const r1 = 90
            const r2 = isMajor ? 82 : 85
            const x1 = 100 + r1 * Math.sin((angle * Math.PI) / 180)
            const y1 = 100 - r1 * Math.cos((angle * Math.PI) / 180)
            const x2 = 100 + r2 * Math.sin((angle * Math.PI) / 180)
            const y2 = 100 - r2 * Math.cos((angle * Math.PI) / 180)

            return (
              <line
                key={`roll-${angle}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#fff"
                strokeWidth={isMajor ? 2 : 1}
              />
            )
          })}

          {/* Triangle at top (0 degrees) */}
          <polygon points="100,10 95,20 105,20" fill="#fff" />

          {/* Roll indicator (yellow triangle) */}
          <g transform={`rotate(${-roll} 100 100)`}>
            <polygon points="100,25 95,35 105,35" fill="#fbbf24" />
          </g>
        </g>

        {/* Outer bezel circle */}
        <circle cx="100" cy="100" r="90" fill="none" stroke="#4b5563" strokeWidth="2" />
        <circle cx="100" cy="100" r="85" fill="none" stroke="#374151" strokeWidth="1" />
      </svg>

      {/* Digital readout */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-4">
        <div className="bg-background/90 px-2 py-1 rounded text-xs font-mono">
          <span className="text-text-tertiary">PITCH:</span>{' '}
          <span className="text-primary font-bold">{pitch.toFixed(1)}°</span>
        </div>
        <div className="bg-background/90 px-2 py-1 rounded text-xs font-mono">
          <span className="text-text-tertiary">ROLL:</span>{' '}
          <span className="text-warning font-bold">{roll.toFixed(1)}°</span>
        </div>
      </div>
    </div>
  )
}
