import { useRef } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import { AirspeedIndicator } from './AirspeedIndicator'
import { AltimeterIndicator } from './AltimeterIndicator'

interface Props {
  onDragHandle: (e: React.MouseEvent) => void
  collapsed: boolean
  onToggle: () => void
}

// Classic VSI: 0 at 9-o'clock (left), UP clockwise, DOWN counter-clockwise
// svgNeedleAngle: 0 m/s → 180° (left), +10 → 360°/0° (right via top), -10 → 0° (right via bottom)
function VsiIndicator({ vspeed, size = 140 }: { vspeed: number; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.42
  const maxVs = 10
  const clamped = Math.max(-maxVs, Math.min(maxVs, vspeed))
  const svgNeedleAngle = 180 + (clamped / maxVs) * 180

  const isClimb = vspeed > 0.05
  const isDescent = vspeed < -0.05
  const needleColor = isClimb ? '#6db56d' : isDescent ? '#c46060' : '#ECDFCC'

  // polarToXY: 0° = top (12 o'clock), clockwise
  const polarToXY = (angleDeg: number, radius: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const id = `vsi-${size}`

  // UP ticks: 270°→90° clockwise (through top). DOWN ticks: 270°→90° counter-clockwise (through bottom)
  const upTicks = Array.from({ length: 11 }, (_, i) => ({ vs: i, angle: 270 + (i / maxVs) * 180, key: `u${i}` }))
  const downTicks = Array.from({ length: 10 }, (_, i) => ({ vs: i + 1, angle: 270 - ((i + 1) / maxVs) * 180, key: `d${i + 1}` }))

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#222620" />
          <stop offset="100%" stopColor="#181b14" />
        </radialGradient>
      </defs>

      {/* Bezel */}
      <circle cx={cx} cy={cy} r={r + size * 0.06} fill="#111410" />
      <circle cx={cx} cy={cy} r={r + size * 0.04} fill="rgba(236,223,204,0.06)" />

      {/* Face */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-bg)`} />

      {/* Tick marks - UP side */}
      {upTicks.map(({ vs, angle, key }) => {
        const isMajor = vs === 0 || vs % 5 === 0
        const isMed = vs % 2 === 0
        const outer = polarToXY(angle, r - 2)
        const inner = polarToXY(angle, r - (isMajor ? size * 0.13 : isMed ? size * 0.08 : size * 0.05))
        return (
          <line key={key}
            x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
            stroke={isMajor ? 'rgba(236,223,204,0.8)' : 'rgba(236,223,204,0.38)'}
            strokeWidth={isMajor ? 1.4 : 0.7}
          />
        )
      })}

      {/* Tick marks - DOWN side */}
      {downTicks.map(({ vs, angle, key }) => {
        const isMajor = vs % 5 === 0
        const isMed = vs % 2 === 0
        const outer = polarToXY(angle, r - 2)
        const inner = polarToXY(angle, r - (isMajor ? size * 0.13 : isMed ? size * 0.08 : size * 0.05))
        return (
          <line key={key}
            x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
            stroke={isMajor ? 'rgba(236,223,204,0.8)' : 'rgba(236,223,204,0.38)'}
            strokeWidth={isMajor ? 1.4 : 0.7}
          />
        )
      })}

      {/* Scale labels:
          UP-5  at 12 o'clock (270+90=360°=0°)
          10    at 3 o'clock  (270+180=450°=90°) — represents both UP and DOWN max
          DOWN-5 at 6 o'clock (180°) is covered by the digital box → omit */}
      {[
        { vs: 5,  angle: 360 },   // UP-5  @ 12 o'clock
        { vs: 10, angle: 90  },   // max   @ 3 o'clock
      ].map(({ vs, angle }) => {
        const pos = polarToXY(angle, r - size * 0.23)
        return (
          <text key={`l${vs}`} x={pos.x} y={pos.y + 3.5}
            textAnchor="middle" fontSize={size * 0.073}
            dominantBaseline="central"
            fill="rgba(236,223,204,0.72)" fontFamily="JetBrains Mono, monospace"
          >{vs}</text>
        )
      })}

      {/* UP / DOWN indicators near needle rest (9 o'clock) */}
      <line
        x1={cx - r * 0.58} y1={cy - size * 0.06}
        x2={cx - r * 0.3}  y2={cy - size * 0.06}
        stroke="rgba(236,223,204,0.28)" strokeWidth={0.8}
      />
      <text x={cx - r * 0.27} y={cy - size * 0.04}
        textAnchor="start" fontSize={size * 0.055}
        dominantBaseline="central"
        fill="rgba(236,223,204,0.42)" fontFamily="Space Grotesk, sans-serif" letterSpacing="0.08em"
      >UP</text>

      <line
        x1={cx - r * 0.58} y1={cy + size * 0.09}
        x2={cx - r * 0.3}  y2={cy + size * 0.09}
        stroke="rgba(236,223,204,0.28)" strokeWidth={0.8}
      />
      <text x={cx - r * 0.27} y={cy + size * 0.11}
        textAnchor="start" fontSize={size * 0.055}
        dominantBaseline="central"
        fill="rgba(236,223,204,0.42)" fontFamily="Space Grotesk, sans-serif" letterSpacing="0.08em"
      >DOWN</text>

      {/* Needle - drawn pointing right, rotated to correct position */}
      <g transform={`rotate(${svgNeedleAngle}, ${cx}, ${cy})`}>
        <line
          x1={cx} y1={cy}
          x2={cx + r * 0.74} y2={cy}
          stroke={needleColor}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={cx} y1={cy}
          x2={cx - r * 0.18} y2={cy}
          stroke={needleColor}
          strokeWidth={3.5}
          strokeLinecap="round"
          opacity={0.55}
        />
      </g>

      {/* Center cap */}
      <circle cx={cx} cy={cy} r={size * 0.05} fill="#2a2e28" stroke="rgba(236,223,204,0.3)" strokeWidth={1.5} />

      {/* Digital readout box */}
      <rect
        x={cx - 25} y={cy + r * 0.3}
        width={50} height={19}
        fill="#0a0c09"
        stroke="rgba(236,223,204,0.2)"
        strokeWidth={1}
        rx={2}
      />
      <text
        x={cx} y={cy + r * 0.3 + 9.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.105}
        fontWeight={700}
        fill={needleColor}
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="-0.02em"
      >
        {vspeed >= 0 ? '+' : ''}{vspeed.toFixed(1)}
      </text>
      <text
        x={cx} y={cy + r * 0.3 + 26}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.055}
        fill="rgba(236,223,204,0.35)"
        fontFamily="Space Grotesk, sans-serif"
        letterSpacing="0.12em"
      >
        M/S
      </text>
    </svg>
  )
}

// heading: raw 0-360° value. Unwrap computed during render, applied via JSX style.
function HeadingDial({ heading, size = 140 }: { heading: number; size?: number }) {
  const rawHeading = ((heading % 360) + 360) % 360  // 0-360 for digital display
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.42
  const id = `hdg-${size}`

  // Heading unwrap — shortest-path delta 누적
  const prevHdgRef = useRef<number | null>(null)
  const accRef = useRef(0)

  if (prevHdgRef.current === null) {
    prevHdgRef.current = heading
    accRef.current = heading
  } else if (heading !== prevHdgRef.current) {
    let delta = heading - prevHdgRef.current
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    prevHdgRef.current = heading
    accRef.current += delta
  }

  // Cardinal + intercardinal labels
  const cardinals = [
    { label: 'N', deg: 0 },
    { label: 'NE', deg: 45 },
    { label: 'E', deg: 90 },
    { label: 'SE', deg: 135 },
    { label: 'S', deg: 180 },
    { label: 'SW', deg: 225 },
    { label: 'W', deg: 270 },
    { label: 'NW', deg: 315 },
  ]

  const polarToXY = (angleDeg: number, radius: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  // Every 10° tick on the rotating card
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2a2e24" />
          <stop offset="100%" stopColor="#1a1e16" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>

      {/* Bezel */}
      <circle cx={cx} cy={cy} r={r + size * 0.06} fill="#111410" />
      <circle cx={cx} cy={cy} r={r + size * 0.04} fill="rgba(236,223,204,0.06)" />

      {/* Face */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-bg)`} />

      {/* Rotating compass card */}
      <g clipPath={`url(#${id}-clip)`}>
        <g style={{ transform: `rotate(${-accRef.current}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'none' }}>
          {/* Ticks */}
          {ticks.map((deg) => {
            const isMajor = deg % 90 === 0
            const isMed = deg % 30 === 0
            const outer = polarToXY(deg, r - 2)
            const inner = polarToXY(deg, r - (isMajor ? size * 0.14 : isMed ? size * 0.09 : size * 0.05))
            return (
              <line
                key={deg}
                x1={outer.x} y1={outer.y}
                x2={inner.x} y2={inner.y}
                stroke="rgba(236,223,204,0.55)"
                strokeWidth={isMajor ? 1.5 : 0.7}
              />
            )
          })}

          {/* Cardinal / intercardinal labels */}
          {cardinals.map(({ label, deg }) => {
            const pos = polarToXY(deg, r - size * 0.22)
            const isCardinal = label.length === 1
            const isNorth = label === 'N'
            return (
              <text
                key={label}
                x={pos.x} y={pos.y + 3}
                textAnchor="middle"
                fontSize={isCardinal ? size * 0.085 : size * 0.055}
                fontWeight={isCardinal ? 700 : 400}
                fill={isNorth ? '#E87020' : 'rgba(236,223,204,0.75)'}
                fontFamily="Space Grotesk, sans-serif"
              >
                {label}
              </text>
            )
          })}
        </g>
      </g>

      {/* Fixed lubber line (top, aircraft nose) */}
      <polygon
        points={`${cx},${cy - r + 2} ${cx - 5},${cy - r + 12} ${cx + 5},${cy - r + 12}`}
        fill="#E87020"
      />

      {/* Center cap */}
      <circle cx={cx} cy={cy} r={size * 0.04} fill="#3C3D37" stroke="rgba(236,223,204,0.3)" strokeWidth={1} />

      {/* Digital heading box - opaque background covers S/SE/SW rotating labels */}
      <rect
        x={cx - 25} y={cy + r * 0.3}
        width={50} height={19}
        fill="#0a0c09"
        stroke="rgba(236,223,204,0.2)"
        strokeWidth={1}
        rx={2}
      />
      <text
        x={cx} y={cy + r * 0.3 + 9.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.105}
        fontWeight={700}
        fill="#ECDFCC"
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="-0.02em"
      >
        {Math.round(rawHeading).toString().padStart(3, '0')}°
      </text>
    </svg>
  )
}

export function InstrumentsPanel({ onDragHandle, collapsed, onToggle }: Props) {
  const { telemetry } = useTelemetryStore()

  const heading = telemetry?.heading ?? 0
  const airspeed = telemetry?.velocity?.airspeed ?? 0
  const altitude = telemetry?.position?.relative_alt ?? 0
  const vspeed = -(telemetry?.velocity?.vz ?? 0)

  return (
    <div
      style={{
        background: 'rgba(24, 28, 20, 0.88)',
        border: '1px solid rgba(236, 223, 204, 0.12)',
        borderRadius: '6px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        width: '643px'
      }}
    >
      {/* Drag Handle */}
      <div
        onMouseDown={onDragHandle}
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: collapsed ? 'none' : '1px solid rgba(236, 223, 204, 0.08)',
          cursor: 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Grip dots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', opacity: 0.35 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', gap: '2px' }}>
                {[0, 1].map((j) => (
                  <div
                    key={j}
                    style={{
                      width: '2px',
                      height: '2px',
                      borderRadius: '50%',
                      background: '#ECDFCC'
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '9px',
              fontWeight: 600,
              color: 'rgba(236, 223, 204, 0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em'
            }}
          >
            INSTRUMENTS
          </span>
        </div>
        <span style={{ color: 'rgba(236, 223, 204, 0.3)', fontSize: '10px' }}>
          {collapsed ? '▲' : '▼'}
        </span>
      </div>

      {/* Content */}
      {!collapsed && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          gap: '0px'
        }}>
          {/* Airspeed */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <AirspeedIndicator airspeed={airspeed} size={140} />
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'rgba(236, 223, 204, 0.35)'
            }}>AIRSPEED</span>
          </div>

          <div style={{ width: '1px', height: '120px', background: 'rgba(236, 223, 204, 0.08)', margin: '0 8px' }} />

          {/* Altitude */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <AltimeterIndicator altitude={altitude} size={140} />
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'rgba(236, 223, 204, 0.35)'
            }}>ALTITUDE</span>
          </div>

          <div style={{ width: '1px', height: '120px', background: 'rgba(236, 223, 204, 0.08)', margin: '0 8px' }} />

          {/* Heading */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <HeadingDial heading={heading} size={140} />
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'rgba(236, 223, 204, 0.35)'
            }}>HEADING</span>
          </div>

          <div style={{ width: '1px', height: '120px', background: 'rgba(236, 223, 204, 0.08)', margin: '0 8px' }} />

          {/* V/Speed */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <VsiIndicator vspeed={vspeed} size={140} />
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'rgba(236, 223, 204, 0.35)'
            }}>VERTICAL SPEED</span>
          </div>
        </div>
      )}
    </div>
  )
}
