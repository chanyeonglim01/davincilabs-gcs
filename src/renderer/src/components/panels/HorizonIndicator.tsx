interface Props {
  roll: number  // degrees
  pitch: number // degrees
  size?: number
}

export function HorizonIndicator({ roll, pitch, size = 180 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.44
  const pitchPx = pitch * (r / 45) // 45deg = full radius

  // Bank angle tick positions (degrees)
  const bankTicks = [10, 20, 30, 45, 60, -10, -20, -30, -45, -60]
  const bankTickLen = (deg: number) => {
    const abs = Math.abs(deg)
    if (abs === 45 || abs === 60) return 10
    if (abs === 30) return 9
    return 6
  }

  // Pitch ladder lines
  const pitchLines = [-20, -10, 10, 20]

  const id = `clip-${size}`

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block' }}
    >
      <defs>
        <clipPath id={id}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        {/* Subtle vignette */}
        <radialGradient id={`vign-${size}`} cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
      </defs>

      {/* Sky + Ground (rotates with roll, translates with pitch) */}
      <g clipPath={`url(#${id})`}>
        <g transform={`rotate(${-roll}, ${cx}, ${cy})`}>
          <g transform={`translate(0, ${pitchPx})`}>
            {/* Sky */}
            <rect
              x={cx - size}
              y={cy - size * 2}
              width={size * 3}
              height={size * 2}
              fill="#3d7ab5"
            />
            {/* Ground */}
            <rect
              x={cx - size}
              y={cy}
              width={size * 3}
              height={size * 2}
              fill="#7a5533"
            />
            {/* Horizon line */}
            <line
              x1={cx - size}
              y1={cy}
              x2={cx + size}
              y2={cy}
              stroke="white"
              strokeWidth={1.5}
            />

            {/* Pitch ladder lines */}
            {pitchLines.map((deg) => {
              const y = cy + deg * (r / 45)
              const isPositive = deg > 0
              const len = Math.abs(deg) === 20 ? r * 0.55 : r * 0.35
              return (
                <g key={deg}>
                  <line
                    x1={cx - len}
                    y1={y}
                    x2={cx + len}
                    y2={y}
                    stroke="white"
                    strokeWidth={1}
                    opacity={0.85}
                  />
                  {/* Pitch value label */}
                  <text
                    x={cx - len - 4}
                    y={y + 3}
                    textAnchor="end"
                    fontSize={size * 0.055}
                    fill="white"
                    opacity={0.7}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {isPositive ? deg : Math.abs(deg)}
                  </text>
                  <text
                    x={cx + len + 4}
                    y={y + 3}
                    textAnchor="start"
                    fontSize={size * 0.055}
                    fill="white"
                    opacity={0.7}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {isPositive ? deg : Math.abs(deg)}
                  </text>
                </g>
              )
            })}
          </g>
        </g>

        {/* Vignette overlay */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={`url(#vign-${size})`}
        />
      </g>

      {/* Bank angle arc */}
      <g>
        {bankTicks.map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180
          const tickR = r - 1
          const len = bankTickLen(deg)
          const x1 = cx + tickR * Math.cos(rad)
          const y1 = cy + tickR * Math.sin(rad)
          const x2 = cx + (tickR - len) * Math.cos(rad)
          const y2 = cy + (tickR - len) * Math.sin(rad)
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="white"
              strokeWidth={1.2}
              opacity={0.8}
            />
          )
        })}

        {/* 0° bank tick (top center) */}
        <line
          x1={cx}
          y1={cy - r + 1}
          x2={cx}
          y2={cy - r + 12}
          stroke="white"
          strokeWidth={1.5}
          opacity={0.9}
        />
      </g>

      {/* Bank angle pointer (fixed inverted triangle at top, points into arc) */}
      <g transform={`rotate(${-roll}, ${cx}, ${cy})`}>
        <polygon
          points={`${cx},${cy - r + 14} ${cx - 5},${cy - r + 4} ${cx + 5},${cy - r + 4}`}
          fill="#E87020"
          stroke="none"
        />
      </g>

      {/* Fixed aircraft reference (orange) */}
      {/* Left wing */}
      <line
        x1={cx - r * 0.55}
        y1={cy}
        x2={cx - r * 0.15}
        y2={cy}
        stroke="#E87020"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Right wing */}
      <line
        x1={cx + r * 0.15}
        y1={cy}
        x2={cx + r * 0.55}
        y2={cy}
        stroke="#E87020"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="#E87020" />
      {/* Fixed top marker triangle */}
      <polygon
        points={`${cx},${cy - r * 0.82} ${cx - 5},${cy - r * 0.68} ${cx + 5},${cy - r * 0.68}`}
        fill="white"
        opacity={0.9}
      />

      {/* Outer bezel ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#1a1e16"
        strokeWidth={size * 0.06}
      />
      {/* Inner bezel highlight */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(236,223,204,0.15)"
        strokeWidth={1}
      />
    </svg>
  )
}
