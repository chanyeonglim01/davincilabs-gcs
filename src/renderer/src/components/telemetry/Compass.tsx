import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function Compass(): React.ReactElement {
  const heading = useTelemetryStore((state) => state.telemetry?.heading ?? 0)

  return (
    <div className="relative w-full h-full bg-surface-elevated rounded-lg overflow-hidden border border-border">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Background circle */}
        <circle cx="100" cy="100" r="90" fill="#1a1a1a" stroke="#4b5563" strokeWidth="2" />

        {/* Rotating compass card */}
        <g transform={`rotate(${-heading} 100 100)`}>
          {/* Tick marks */}
          {[...Array(36)].map((_, i) => {
            const angle = i * 10
            const isMajor = angle % 30 === 0
            const r1 = 85
            const r2 = isMajor ? 70 : 78
            const x1 = 100 + r1 * Math.sin((angle * Math.PI) / 180)
            const y1 = 100 - r1 * Math.cos((angle * Math.PI) / 180)
            const x2 = 100 + r2 * Math.sin((angle * Math.PI) / 180)
            const y2 = 100 - r2 * Math.sin((angle * Math.PI) / 180)

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#fff"
                strokeWidth={isMajor ? 2 : 1}
              />
            )
          })}

          {/* Cardinal directions */}
          <text
            x="100"
            y="30"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#22c55e"
            fontSize="20"
            fontWeight="bold"
          >
            N
          </text>
          <text
            x="170"
            y="100"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize="18"
            fontWeight="bold"
          >
            E
          </text>
          <text
            x="100"
            y="175"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize="18"
            fontWeight="bold"
          >
            S
          </text>
          <text
            x="30"
            y="100"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize="18"
            fontWeight="bold"
          >
            W
          </text>

          {/* Degree labels */}
          {[30, 60, 120, 150, 210, 240, 300, 330].map((deg) => {
            const angle = deg
            const r = 60
            const x = 100 + r * Math.sin((angle * Math.PI) / 180)
            const y = 100 - r * Math.cos((angle * Math.PI) / 180)

            return (
              <text
                key={`deg-${deg}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#9ca3af"
                fontSize="11"
              >
                {deg}
              </text>
            )
          })}
        </g>

        {/* Fixed heading indicator (top center) */}
        <g>
          {/* Triangle pointer */}
          <polygon points="100,15 95,25 105,25" fill="#fbbf24" stroke="#fff" strokeWidth="1" />
          {/* Line down */}
          <line x1="100" y1="25" x2="100" y2="35" stroke="#fbbf24" strokeWidth="2" />
        </g>

        {/* Center reference point */}
        <circle cx="100" cy="100" r="4" fill="#2d3748" stroke="#fbbf24" strokeWidth="2" />

        {/* Label */}
        <text x="100" y="150" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold">
          HEADING
        </text>
      </svg>

      {/* Digital readout */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center">
        <div className="bg-background/90 px-4 py-1 rounded">
          <span className="text-primary font-mono text-xl font-bold">
            {Math.round(heading).toString().padStart(3, '0')}°
          </span>
        </div>
      </div>
    </div>
  )
}
