import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function AirspeedIndicator(): React.ReactElement {
  const airspeed = useTelemetryStore((state) => state.telemetry?.velocity.airspeed ?? 0)

  // Convert m/s to knots for aviation standard (1 m/s = 1.944 knots)
  const speedKnots = airspeed * 1.944

  // Needle angle: 0 knots = -135°, 200 knots = +135° (270° range)
  const maxSpeed = 200
  const angle = -135 + (Math.min(speedKnots, maxSpeed) / maxSpeed) * 270

  return (
    <div className="relative w-full h-full bg-surface-elevated rounded-lg overflow-hidden border border-border">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          {/* Gradient for speed arcs */}
          <linearGradient id="speed-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#22c55e', stopOpacity: 0.3 }} />
            <stop offset="60%" style={{ stopColor: '#eab308', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: '#ef4444', stopOpacity: 0.3 }} />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle cx="100" cy="100" r="90" fill="#1a1a1a" stroke="#4b5563" strokeWidth="2" />

        {/* Color-coded speed arcs */}
        {/* Green arc (0-100 knots) */}
        <path
          d="M 24 100 A 76 76 0 0 1 100 24"
          fill="none"
          stroke="#22c55e"
          strokeWidth="12"
          opacity="0.3"
        />
        {/* Yellow arc (100-150 knots) */}
        <path
          d="M 100 24 A 76 76 0 0 1 153 53"
          fill="none"
          stroke="#eab308"
          strokeWidth="12"
          opacity="0.3"
        />
        {/* Red arc (150-200 knots) */}
        <path
          d="M 153 53 A 76 76 0 0 1 176 100"
          fill="none"
          stroke="#ef4444"
          strokeWidth="12"
          opacity="0.3"
        />

        {/* Speed scale marks */}
        {[0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200].map((speed) => {
          const speedAngle = -135 + (speed / maxSpeed) * 270
          const isMajor = speed % 20 === 0
          const r1 = 85
          const r2 = isMajor ? 70 : 75
          const x1 = 100 + r1 * Math.cos((speedAngle * Math.PI) / 180)
          const y1 = 100 + r1 * Math.sin((speedAngle * Math.PI) / 180)
          const x2 = 100 + r2 * Math.cos((speedAngle * Math.PI) / 180)
          const y2 = 100 + r2 * Math.sin((speedAngle * Math.PI) / 180)

          return (
            <g key={`speed-${speed}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={isMajor ? 2 : 1} />
              {isMajor && (
                <text
                  x={100 + 60 * Math.cos((speedAngle * Math.PI) / 180)}
                  y={100 + 60 * Math.sin((speedAngle * Math.PI) / 180)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {speed}
                </text>
              )}
            </g>
          )
        })}

        {/* Center hub */}
        <circle cx="100" cy="100" r="8" fill="#2d3748" stroke="#4b5563" strokeWidth="1" />

        {/* Needle */}
        <g transform={`rotate(${angle} 100 100)`}>
          {/* Needle shadow */}
          <polygon points="100,105 98,100 100,30 102,100" fill="#000" opacity="0.3" />
          {/* Needle */}
          <polygon
            points="100,102 97,100 100,25 103,100"
            fill="#fbbf24"
            stroke="#fff"
            strokeWidth="1"
          />
        </g>

        {/* Center dot */}
        <circle cx="100" cy="100" r="4" fill="#fbbf24" stroke="#fff" strokeWidth="1" />

        {/* Label */}
        <text x="100" y="150" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold">
          AIRSPEED
        </text>
        <text x="100" y="162" textAnchor="middle" fill="#6b7280" fontSize="8">
          KNOTS
        </text>
      </svg>

      {/* Digital readout */}
      <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1">
        <div className="bg-background/90 px-3 py-1 rounded">
          <span className="text-primary font-mono text-lg font-bold">{speedKnots.toFixed(0)}</span>
        </div>
        <div className="text-xs text-text-tertiary font-mono">{airspeed.toFixed(1)} m/s</div>
      </div>
    </div>
  )
}
