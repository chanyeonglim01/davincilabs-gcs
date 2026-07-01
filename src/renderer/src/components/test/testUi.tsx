/**
 * Shared test-tooling components.
 *
 * Both MotorTestPanel and CtrlSurfaceTestPanel compose these so the two pages
 * read as siblings — Mission-Planner-minimal: one compact safety line in the
 * header (no stacked banners) and a cream-only status chip. Style tokens live
 * in ./testStyles.
 */
import { CREAM } from './testStyles'

interface TestHeaderProps {
  title: string
  safety: string
  armed: boolean
  linked: boolean
}

/**
 * Header strip — title, a single compact safety line, and a cream-only status
 * chip. Armed state is shown by a filled dot + brighter text, never red.
 */
export function TestHeader({ title, safety, armed, linked }: TestHeaderProps): React.JSX.Element {
  const chipText = armed ? 'ARMED' : linked ? 'DISARMED' : 'NO LINK'
  const chipColor = armed ? CREAM : linked ? 'rgba(236,223,204,0.7)' : 'rgba(236,223,204,0.4)'
  return (
    <div
      style={{
        marginBottom: '20px',
        paddingBottom: '14px',
        borderBottom: '1px solid rgba(236,223,204,0.08)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '15px',
            fontWeight: 700,
            letterSpacing: '0.18em'
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px'
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: armed ? CREAM : 'transparent',
              border: `1px solid ${linked ? 'rgba(236,223,204,0.7)' : 'rgba(236,223,204,0.25)'}`
            }}
          />
          <span style={{ color: chipColor, letterSpacing: '0.08em' }}>{chipText}</span>
        </div>
      </div>
      <div
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '11px',
          letterSpacing: '0.01em',
          color: 'rgba(236,223,204,0.5)',
          marginTop: '8px'
        }}
      >
        ⚠ {safety}
      </div>
    </div>
  )
}

interface ReadoutCell {
  label: string
  value: string
}

interface StatusReadoutProps {
  cells: ReadoutCell[]
  /** 0..1 — renders a thin progress bar under the cells when defined. */
  progress?: number
  /** transient message (errors, results) shown under the readout. */
  note?: string
}

/**
 * Instrument-style status strip — a row of label/value cells with an optional
 * progress bar and message line. Replaces the old boxed "STATUS" panel; reads
 * like a cockpit readout rather than a text dump.
 */
export function StatusReadout({ cells, progress, note }: StatusReadoutProps): React.JSX.Element {
  return (
    <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(236,223,204,0.1)' }}>
      <div style={{ display: 'flex', gap: '16px' }}>
        {cells.map((c) => (
          <div key={c.label} style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(236,223,204,0.35)',
                marginBottom: '5px'
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '14px',
                fontWeight: 700,
                color: CREAM,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
      {progress !== undefined && (
        <div
          style={{
            marginTop: '12px',
            width: '100%',
            height: '4px',
            background: 'rgba(236,223,204,0.08)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
              height: '100%',
              background: 'rgba(236,223,204,0.55)',
              transition: 'width 0.05s linear'
            }}
          />
        </div>
      )}
      {note && (
        <div
          style={{
            marginTop: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.02em',
            color: 'rgba(236,223,204,0.5)'
          }}
        >
          {note}
        </div>
      )}
    </div>
  )
}
