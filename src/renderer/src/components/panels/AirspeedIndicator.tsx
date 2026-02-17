interface Props {
  airspeed: number // m/s
  size?: number
}

export function AirspeedIndicator({ airspeed, size = 140 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.42

  // 0~40 m/s → 30°~330° arc (300° range)
  const minSpd = 0
  const maxSpd = 40
  const startAngle = 30
  const endAngle = 330
  const clamped = Math.max(minSpd, Math.min(maxSpd, airspeed))
  const pct = (clamped - minSpd) / (maxSpd - minSpd)
  const needleAngle = startAngle + pct * (endAngle - startAngle)

  // Tick marks
  const ticks = Array.from({ length: 9 }, (_, i) => i * 5) // 0,5,10,...,40

  const polarToXY = (angleDeg: number, radius: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const id = `asp-${size}`

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2a2e24" />
          <stop offset="100%" stopColor="#1a1e16" />
        </radialGradient>
      </defs>

      {/* Bezel */}
      <circle cx={cx} cy={cy} r={r + size * 0.06} fill="#111410" />
      <circle cx={cx} cy={cy} r={r + size * 0.04} fill="rgba(236,223,204,0.06)" />

      {/* Face */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-bg)`} />

      {/* Tick marks */}
      {ticks.map((spd) => {
        const pctTick = (spd - minSpd) / (maxSpd - minSpd)
        const angle = startAngle + pctTick * (endAngle - startAngle)
        const isMajor = spd % 10 === 0
        const outer = polarToXY(angle, r - 2)
        const inner = polarToXY(angle, r - (isMajor ? size * 0.12 : size * 0.07))
        return (
          <line
            key={spd}
            x1={outer.x} y1={outer.y}
            x2={inner.x} y2={inner.y}
            stroke="rgba(236,223,204,0.7)"
            strokeWidth={isMajor ? 1.5 : 0.8}
          />
        )
      })}

      {/* Labels */}
      {[0, 10, 20, 30, 40].map((spd) => {
        const pctTick = (spd - minSpd) / (maxSpd - minSpd)
        const angle = startAngle + pctTick * (endAngle - startAngle)
        const pos = polarToXY(angle, r - size * 0.22)
        return (
          <text
            key={spd}
            x={pos.x} y={pos.y + 3}
            textAnchor="middle"
            fontSize={size * 0.07}
            fill="rgba(236,223,204,0.7)"
            fontFamily="JetBrains Mono, monospace"
          >
            {spd}
          </text>
        )
      })}

      {/* Needle */}
      <g transform={`rotate(${needleAngle}, ${cx}, ${cy})`}>
        <line
          x1={cx} y1={cy + r * 0.2}
          x2={cx} y2={cy - r * 0.72}
          stroke="#ECDFCC"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <line
          x1={cx} y1={cy + r * 0.2}
          x2={cx} y2={cy + r * 0.1}
          stroke="rgba(236,223,204,0.4)"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>

      {/* Center cap */}
      <circle cx={cx} cy={cy} r={size * 0.04} fill="#3C3D37" stroke="rgba(236,223,204,0.3)" strokeWidth={1} />

      {/* Label */}
      <text x={cx} y={cy + r * 0.55} textAnchor="middle"
        fontSize={size * 0.065} fill="rgba(236,223,204,0.4)"
        fontFamily="Space Grotesk, sans-serif" letterSpacing="0.1em">
        m/s
      </text>
    </svg>
  )
}
