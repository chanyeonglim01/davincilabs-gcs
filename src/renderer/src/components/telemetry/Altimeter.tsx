import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function Altimeter(): React.ReactElement {
  const altitude = useTelemetryStore((state) => state.telemetry?.position.relative_alt ?? 0)

  // Convert meters to feet for aviation standard (1 m = 3.28084 ft)
  const altitudeFeet = altitude * 3.28084

  // Multi-needle altimeter
  // 100ft hand: full rotation every 1000ft
  const angle100 = (altitudeFeet % 1000) * 0.36 // 360° per 1000ft
  // 1000ft hand: full rotation every 10000ft
  const angle1000 = (altitudeFeet % 10000) * 0.036 // 360° per 10000ft

  return (
    <div className="relative w-full h-full bg-surface-elevated rounded-lg overflow-hidden border border-border">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Background circle */}
        <circle cx="100" cy="100" r="90" fill="#1a1a1a" stroke="#4b5563" strokeWidth="2" />

        {/* Altitude scale (in hundreds of feet) */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
          const angle = num * 36 - 90 // Start from top
          const r = 75
          const x = 100 + r * Math.cos((angle * Math.PI) / 180)
          const y = 100 + r * Math.sin((angle * Math.PI) / 180)

          return (
            <g key={`alt-num-${num}`}>
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize="16"
                fontWeight="bold"
              >
                {num}
              </text>
            </g>
          )
        })}

        {/* Tick marks */}
        {[...Array(50)].map((_, i) => {
          const angle = i * 7.2 - 90
          const isMajor = i % 5 === 0
          const r1 = 85
          const r2 = isMajor ? 70 : 80
          const x1 = 100 + r1 * Math.cos((angle * Math.PI) / 180)
          const y1 = 100 + r1 * Math.sin((angle * Math.PI) / 180)
          const x2 = 100 + r2 * Math.cos((angle * Math.PI) / 180)
          const y2 = 100 + r2 * Math.sin((angle * Math.PI) / 180)

          return (
            <line
              key={`alt-tick-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#666"
              strokeWidth={isMajor ? 2 : 1}
            />
          )
        })}

        {/* 1000ft hand (short, wide) */}
        <g transform={`rotate(${angle1000} 100 100)`}>
          <polygon
            points="100,100 95,105 95,50 105,50 105,105"
            fill="#fff"
            stroke="#000"
            strokeWidth="1"
          />
        </g>

        {/* 100ft hand (long, thin) */}
        <g transform={`rotate(${angle100} 100 100)`}>
          <polygon
            points="100,100 98,102 98,30 102,30 102,102"
            fill="#fbbf24"
            stroke="#000"
            strokeWidth="1"
          />
          {/* Arrow tip */}
          <polygon points="98,30 100,25 102,30" fill="#fbbf24" stroke="#000" strokeWidth="1" />
        </g>

        {/* Center hub */}
        <circle cx="100" cy="100" r="6" fill="#2d3748" stroke="#4b5563" strokeWidth="2" />

        {/* Digital altitude window */}
        <rect
          x="120"
          y="90"
          width="60"
          height="20"
          fill="#000"
          stroke="#4b5563"
          strokeWidth="1"
          rx="2"
        />
        <text
          x="150"
          y="103"
          textAnchor="middle"
          fill="#0f0"
          fontSize="12"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {Math.round(altitudeFeet / 100)
            .toString()
            .padStart(3, '0')}
        </text>

        {/* Label */}
        <text x="100" y="150" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold">
          ALTITUDE
        </text>
        <text x="100" y="162" textAnchor="middle" fill="#6b7280" fontSize="8">
          x100 FT
        </text>
      </svg>

      {/* Digital readout */}
      <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1">
        <div className="bg-background/90 px-3 py-1 rounded">
          <span className="text-green-400 font-mono text-lg font-bold">
            {altitudeFeet.toFixed(0)}
          </span>
          <span className="text-text-tertiary text-xs ml-1">ft</span>
        </div>
        <div className="text-xs text-text-tertiary font-mono">{altitude.toFixed(1)} m</div>
      </div>
    </div>
  )
}
