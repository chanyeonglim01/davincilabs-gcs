import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function VerticalSpeedIndicator(): React.ReactElement {
  const climbRate = useTelemetryStore((state) => state.telemetry?.velocity.climb ?? 0)

  // Convert m/s to feet per minute (fpm) for aviation standard
  // 1 m/s = 196.85 fpm
  const verticalSpeedFpm = climbRate * 196.85

  // Needle position: -2000 fpm to +2000 fpm
  // Map to -90° (bottom) to +90° (top)
  const maxFpm = 2000
  const clampedFpm = Math.max(-maxFpm, Math.min(maxFpm, verticalSpeedFpm))
  const needleAngle = (clampedFpm / maxFpm) * 90

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-700">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Background circle */}
        <circle cx="100" cy="100" r="90" fill="#1a1a1a" stroke="#4b5563" strokeWidth="2" />

        {/* Scale marks and labels (right side for climb, left side for descend) */}
        {/* Climb (positive) - right side */}
        {[0, 500, 1000, 1500, 2000].map((fpm) => {
          const angle = (fpm / maxFpm) * 90
          const isMajor = fpm % 500 === 0
          const r1 = 85
          const r2 = isMajor ? 70 : 78
          const x1 = 100 + r1 * Math.cos((angle * Math.PI) / 180)
          const y1 = 100 - r1 * Math.sin((angle * Math.PI) / 180)
          const x2 = 100 + r2 * Math.cos((angle * Math.PI) / 180)
          const y2 = 100 - r2 * Math.sin((angle * Math.PI) / 180)

          return (
            <g key={`climb-${fpm}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#22c55e"
                strokeWidth={isMajor ? 2 : 1}
              />
              {isMajor && fpm > 0 && (
                <text
                  x={100 + 60 * Math.cos((angle * Math.PI) / 180)}
                  y={100 - 60 * Math.sin((angle * Math.PI) / 180)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#22c55e"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {fpm / 100}
                </text>
              )}
            </g>
          )
        })}

        {/* Descend (negative) - left side */}
        {[0, -500, -1000, -1500, -2000].map((fpm) => {
          const angle = (fpm / maxFpm) * 90
          const isMajor = fpm % 500 === 0
          const r1 = 85
          const r2 = isMajor ? 70 : 78
          const x1 = 100 + r1 * Math.cos((angle * Math.PI) / 180)
          const y1 = 100 - r1 * Math.sin((angle * Math.PI) / 180)
          const x2 = 100 + r2 * Math.cos((angle * Math.PI) / 180)
          const y2 = 100 - r2 * Math.sin((angle * Math.PI) / 180)

          return (
            <g key={`descend-${fpm}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#ef4444"
                strokeWidth={isMajor ? 2 : 1}
              />
              {isMajor && fpm < 0 && (
                <text
                  x={100 + 60 * Math.cos((angle * Math.PI) / 180)}
                  y={100 - 60 * Math.sin((angle * Math.PI) / 180)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ef4444"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {Math.abs(fpm) / 100}
                </text>
              )}
            </g>
          )
        })}

        {/* Minor tick marks */}
        {[-2000, -1500, -1000, -500, -250, 0, 250, 500, 1000, 1500, 2000].map((fpm) => {
          const angle = (fpm / maxFpm) * 90
          const isMinor = fpm % 500 !== 0
          if (!isMinor) return null

          const r1 = 85
          const r2 = 78
          const x1 = 100 + r1 * Math.cos((angle * Math.PI) / 180)
          const y1 = 100 - r1 * Math.sin((angle * Math.PI) / 180)
          const x2 = 100 + r2 * Math.cos((angle * Math.PI) / 180)
          const y2 = 100 - r2 * Math.sin((angle * Math.PI) / 180)

          return (
            <line
              key={`minor-${fpm}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#666"
              strokeWidth={1}
            />
          )
        })}

        {/* Center zero line */}
        <line x1="70" y1="100" x2="130" y2="100" stroke="#fff" strokeWidth="2" />

        {/* UP/DOWN labels */}
        <text x="100" y="30" textAnchor="middle" fill="#22c55e" fontSize="12" fontWeight="bold">
          UP
        </text>
        <text x="100" y="175" textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="bold">
          DOWN
        </text>

        {/* Needle */}
        <g transform={`rotate(${-needleAngle} 100 100)`}>
          {/* Needle body */}
          <polygon
            points="95,100 98,100 98,35 100,30 102,35 102,100 105,100"
            fill="#fbbf24"
            stroke="#fff"
            strokeWidth="1"
          />
        </g>

        {/* Center hub */}
        <circle cx="100" cy="100" r="6" fill="#2d3748" stroke="#4b5563" strokeWidth="2" />
        <circle cx="100" cy="100" r="3" fill="#fbbf24" />

        {/* Label */}
        <text x="100" y="155" textAnchor="middle" fill="#9ca3af" fontSize="9" fontWeight="bold">
          VERTICAL SPEED
        </text>
        <text x="100" y="165" textAnchor="middle" fill="#6b7280" fontSize="8">
          x100 FPM
        </text>
      </svg>

      {/* Digital readout */}
      <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1">
        <div className="bg-black/80 px-3 py-1 rounded">
          <span
            className={`font-mono text-lg font-bold ${
              verticalSpeedFpm > 50
                ? 'text-green-400'
                : verticalSpeedFpm < -50
                  ? 'text-red-400'
                  : 'text-gray-400'
            }`}
          >
            {verticalSpeedFpm > 0 ? '+' : ''}
            {verticalSpeedFpm.toFixed(0)}
          </span>
          <span className="text-gray-500 text-xs ml-1">fpm</span>
        </div>
        <div className="text-xs text-gray-500 font-mono">{climbRate.toFixed(2)} m/s</div>
      </div>
    </div>
  )
}
