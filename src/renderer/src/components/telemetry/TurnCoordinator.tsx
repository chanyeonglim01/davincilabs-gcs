import { useTelemetryStore } from '@renderer/store/telemetryStore'

export function TurnCoordinator(): React.ReactElement {
  const attitude = useTelemetryStore((state) => state.telemetry?.attitude)
  const velocity = useTelemetryStore((state) => state.telemetry?.velocity)

  // Turn rate in degrees per second
  const yawRate = ((attitude?.yawspeed ?? 0) * 180) / Math.PI

  // Standard rate turn is 3°/sec (360° in 2 minutes)
  // Display roll angle for turn coordinator
  const roll = ((attitude?.roll ?? 0) * 180) / Math.PI

  // Slip/skid indicator (simplified: use lateral velocity)
  const lateralVel = velocity?.vy ?? 0
  // Ball position: -20 to +20 pixels based on lateral acceleration
  const ballOffset = Math.max(-20, Math.min(20, lateralVel * 5))

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-700">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Background */}
        <rect x="0" y="0" width="200" height="200" fill="#1a1a1a" />

        {/* Turn indicator marks */}
        <g>
          {/* Left standard rate mark */}
          <line x1="45" y1="75" x2="45" y2="85" stroke="#fff" strokeWidth="2" />
          <text x="45" y="70" textAnchor="middle" fill="#fff" fontSize="10">
            L
          </text>

          {/* Center mark */}
          <line x1="100" y1="75" x2="100" y2="85" stroke="#fff" strokeWidth="3" />

          {/* Right standard rate mark */}
          <line x1="155" y1="75" x2="155" y2="85" stroke="#fff" strokeWidth="2" />
          <text x="155" y="70" textAnchor="middle" fill="#fff" fontSize="10">
            R
          </text>

          {/* Curved reference line */}
          <path d="M 40 80 Q 100 90 160 80" fill="none" stroke="#4b5563" strokeWidth="1" />
        </g>

        {/* Aircraft symbol (tilts with roll) */}
        <g transform={`translate(100 80) rotate(${-roll}) translate(-100 -80)`}>
          {/* Fuselage */}
          <rect x="98" y="75" width="4" height="15" fill="#fbbf24" />

          {/* Wings */}
          <rect x="60" y="83" width="80" height="4" fill="#fbbf24" />

          {/* Wing tips */}
          <rect x="60" y="87" width="4" height="8" fill="#fbbf24" />
          <rect x="136" y="87" width="4" height="8" fill="#fbbf24" />

          {/* Tail */}
          <polygon points="98,75 100,70 102,75" fill="#fbbf24" />
        </g>

        {/* Turn rate indicator (digital) */}
        <g>
          <rect
            x="70"
            y="45"
            width="60"
            height="18"
            fill="#000"
            stroke="#4b5563"
            strokeWidth="1"
            rx="2"
          />
          <text
            x="100"
            y="57"
            textAnchor="middle"
            fill={Math.abs(yawRate) > 3 ? '#ef4444' : '#0f0'}
            fontSize="11"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {yawRate.toFixed(1)} °/s
          </text>
        </g>

        {/* Slip/Skid Indicator (Ball) */}
        <g transform="translate(0 120)">
          {/* Tube background */}
          <rect
            x="60"
            y="0"
            width="80"
            height="30"
            fill="#2d3748"
            stroke="#4b5563"
            strokeWidth="2"
            rx="15"
          />

          {/* Reference marks */}
          <line x1="95" y1="5" x2="95" y2="25" stroke="#666" strokeWidth="1" />
          <line x1="100" y1="2" x2="100" y2="28" stroke="#666" strokeWidth="1" />
          <line x1="105" y1="5" x2="105" y2="25" stroke="#666" strokeWidth="1" />

          {/* Ball */}
          <circle
            cx={100 + ballOffset}
            cy="15"
            r="10"
            fill="#1a1a1a"
            stroke="#fff"
            strokeWidth="2"
          />
          <circle cx={100 + ballOffset} cy="15" r="8" fill="#f3f4f6" />
        </g>

        {/* Labels */}
        <text x="100" y="170" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold">
          TURN COORDINATOR
        </text>

        <text x="100" y="138" textAnchor="middle" fill="#6b7280" fontSize="8">
          2 MIN
        </text>

        {/* Coordinated turn indicator */}
        <g transform="translate(0 180)">
          <text x="30" y="0" fill="#6b7280" fontSize="8">
            SLIP
          </text>
          <text x="100" y="0" textAnchor="middle" fill="#6b7280" fontSize="8">
            COORDINATED
          </text>
          <text x="170" y="0" textAnchor="end" fill="#6b7280" fontSize="8">
            SKID
          </text>
        </g>
      </svg>

      {/* Digital readout */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center">
        <div className="bg-black/80 px-2 py-1 rounded text-xs font-mono">
          <span className="text-gray-400">ROLL:</span>{' '}
          <span className="text-yellow-400 font-bold">{roll.toFixed(1)}°</span>
        </div>
      </div>
    </div>
  )
}
