/**
 * MotorTestPanel
 *
 * Sends MAV_CMD_DO_MOTOR_TEST (cmd 209) for individual motors or sequential
 * ALL-motor sweeps. Multiple UI-level safety guards prevent accidental
 * spin-up on an armed vehicle or with props attached.
 *
 * Design system:
 *   colors  — #181C14 / #3C3D37 / #ECDFCC plus the link-state palette
 *             (#E06C75 danger, #F0C674 warning, #00FF88 safe)
 *   fonts   — JetBrains Mono (numbers/data) / Space Grotesk (labels/UI)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

const MOTOR_COUNT = 6
const DURATION_PRESETS = [0.5, 1, 2, 3, 5] as const
const HIGH_THROTTLE_THRESHOLD = 70 // % — triggers extra confirm
const LONG_DURATION_THRESHOLD = 3 // seconds — triggers extra confirm

// Selection: numeric motor 1..6, or 'ALL' for sequential.
type MotorSelection = number | 'ALL'

interface RunState {
  selection: MotorSelection
  throttle: number
  duration: number
  startedAt: number // ms epoch
}

// ──────────────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Throttle color ramp:
 *   0..40   → cream (#ECDFCC)
 *   40..70  → amber (#F0C674)
 *   70..100 → red   (#E06C75)
 */
function throttleColor(value: number): string {
  if (value >= HIGH_THROTTLE_THRESHOLD) return '#E06C75'
  if (value >= 40) return '#F0C674'
  return '#ECDFCC'
}

function selectionLabel(s: MotorSelection): string {
  return s === 'ALL' ? 'ALL' : `M${s}`
}

// ──────────────────────────────────────────────────────────────────────────────
// component
// ──────────────────────────────────────────────────────────────────────────────

export function MotorTestPanel(): React.JSX.Element {
  const { telemetry, connection } = useTelemetryStore()
  const isArmed = telemetry?.status.armed ?? false
  const isLinked = connection.linkState === 'LINKED'

  const [selection, setSelection] = useState<MotorSelection>(1)
  const [throttle, setThrottle] = useState<number>(20)
  const [duration, setDuration] = useState<number>(1)
  const [run, setRun] = useState<RunState | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const [statusText, setStatusText] = useState<string | null>(null)
  const [statusKind, setStatusKind] = useState<'info' | 'warn' | 'error'>('info')

  // 50ms ticker only while a test is running. The same effect also auto-clears
  // run state when the duration elapses (the FCS is responsible for actually
  // stopping the motor — we are merely tracking the local timer here).
  useEffect(() => {
    if (!run) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if ((t - run.startedAt) / 1000 >= run.duration) {
        setRun(null)
        setStatusKind('info')
        setStatusText(`Test completed: ${selectionLabel(run.selection)} (${run.duration}s)`)
      }
    }, 50)
    return () => window.clearInterval(id)
  }, [run])

  const inProgress = run !== null

  // ── send helpers ────────────────────────────────────────────────────────────
  const sendMotorTest = useCallback(
    async (motor: number, t: number, d: number): Promise<boolean> => {
      if (!window.mavlink?.motorTest) {
        setStatusKind('error')
        setStatusText('MAVLink bridge unavailable')
        return false
      }
      try {
        const result = await window.mavlink.motorTest({
          motor,
          throttle: t,
          duration: d,
          throttleType: 'percent',
          motorCount: motor === 0 ? MOTOR_COUNT : undefined
        })
        if (!result.success) {
          setStatusKind('error')
          setStatusText(result.error ?? 'Motor test failed')
          return false
        }
        return true
      } catch (err) {
        setStatusKind('error')
        setStatusText(err instanceof Error ? err.message : 'IPC error')
        return false
      }
    },
    []
  )

  const stopAll = useCallback(async () => {
    // motor=0 sequential, throttle=0, duration=0 → effective stop
    await sendMotorTest(0, 0, 0)
    setRun(null)
    setStatusKind('warn')
    setStatusText('STOP ALL sent')
  }, [sendMotorTest])

  const handleStart = useCallback(async () => {
    if (isArmed || inProgress) return

    if (throttle >= HIGH_THROTTLE_THRESHOLD) {
      const ok = window.confirm(
        `High throttle (${throttle}%) — make absolutely sure props are removed.\n\nProceed?`
      )
      if (!ok) return
    }
    if (duration > LONG_DURATION_THRESHOLD) {
      const ok = window.confirm(`Long duration (${duration}s). Proceed?`)
      if (!ok) return
    }

    const motorParam = selection === 'ALL' ? 0 : selection
    const ok = await sendMotorTest(motorParam, throttle, duration)
    if (!ok) return

    setRun({ selection, throttle, duration, startedAt: Date.now() })
    setStatusKind('info')
    setStatusText(`Running ${selectionLabel(selection)} @ ${throttle}% for ${duration}s`)
  }, [isArmed, inProgress, throttle, duration, selection, sendMotorTest])

  // Keyboard ←/→ on slider track
  const sliderRef = useRef<HTMLInputElement>(null)
  const sliderPercent = `${throttle}%`
  const trackColor = useMemo(() => throttleColor(throttle), [throttle])

  const elapsed = run ? Math.min((now - run.startedAt) / 1000, run.duration) : 0
  const progressPct = run && run.duration > 0 ? (elapsed / run.duration) * 100 : 0

  // ── styles ──────────────────────────────────────────────────────────────────
  const sectionLabel: React.CSSProperties = {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'rgba(236, 223, 204, 0.55)',
    marginBottom: '10px'
  }

  const motorPill = (n: MotorSelection): React.CSSProperties => {
    const active = selection === n
    return {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: '0.04em',
      padding: '8px 0',
      minWidth: '52px',
      textAlign: 'center',
      borderRadius: '4px',
      border: `1px solid ${active ? 'rgba(236,223,204,0.55)' : 'rgba(236,223,204,0.14)'}`,
      background: active ? 'rgba(236,223,204,0.12)' : 'rgba(60,61,55,0.5)',
      color: active ? '#ECDFCC' : 'rgba(236,223,204,0.5)',
      cursor: inProgress ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease',
      opacity: inProgress ? 0.45 : 1,
      userSelect: 'none'
    }
  }

  const durationPill = (d: number): React.CSSProperties => {
    const active = duration === d
    return {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '11px',
      fontWeight: 600,
      padding: '6px 14px',
      borderRadius: '3px',
      border: `1px solid ${active ? 'rgba(236,223,204,0.55)' : 'rgba(236,223,204,0.14)'}`,
      background: active ? 'rgba(236,223,204,0.1)' : 'transparent',
      color: active ? '#ECDFCC' : 'rgba(236,223,204,0.45)',
      cursor: inProgress ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease',
      opacity: inProgress ? 0.45 : 1
    }
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: 'rgba(60, 61, 55, 0.45)',
        border: '1px solid rgba(236, 223, 204, 0.12)',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(12px)',
        maxWidth: '720px',
        width: '100%',
        color: '#ECDFCC'
      }}
    >
      {/* Header strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '14px',
          borderBottom: '1px solid rgba(236,223,204,0.08)'
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.18em'
            }}
          >
            MOTOR TEST
          </div>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'rgba(236,223,204,0.4)',
              marginTop: '4px'
            }}
          >
            MAV_CMD_DO_MOTOR_TEST · cmd 209
          </div>
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
              background: isArmed ? '#E06C75' : isLinked ? '#00FF88' : 'rgba(236,223,204,0.25)',
              boxShadow: isArmed
                ? '0 0 8px rgba(224,108,117,0.8)'
                : isLinked
                  ? '0 0 8px rgba(0,255,136,0.6)'
                  : 'none'
            }}
          />
          <span style={{ color: isArmed ? '#E06C75' : 'rgba(236,223,204,0.65)' }}>
            {isArmed ? 'ARMED' : isLinked ? 'SAFE · DISARMED' : 'NO LINK'}
          </span>
        </div>
      </div>

      {/* Safety advisories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
        {isArmed && (
          <SafetyBanner
            tone="error"
            text="Vehicle is ARMED — motor test disabled. Disarm before testing."
          />
        )}
        <SafetyBanner
          tone="warn"
          text="Remove propellers before running motor tests. ESCs will spin the rotor at the requested throttle."
        />
      </div>

      {/* Motor selection */}
      <div style={{ marginBottom: '24px' }}>
        <div style={sectionLabel}>Motor Selection</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Array.from({ length: MOTOR_COUNT }, (_, i) => i + 1).map((n) => (
            <div
              key={n}
              onClick={() => !inProgress && setSelection(n)}
              style={motorPill(n)}
              role="button"
              aria-pressed={selection === n}
            >
              M{n}
            </div>
          ))}
          <div
            onClick={() => !inProgress && setSelection('ALL')}
            style={{ ...motorPill('ALL'), minWidth: '90px' }}
            role="button"
            aria-pressed={selection === 'ALL'}
          >
            ALL
          </div>
        </div>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '10px',
            letterSpacing: '0.12em',
            color: 'rgba(236,223,204,0.35)',
            marginTop: '8px',
            textTransform: 'uppercase'
          }}
        >
          {selection === 'ALL'
            ? 'Sequential sweep · M1 → M6, each motor for the chosen duration'
            : `Single motor · M${selection}`}
        </div>
      </div>

      {/* Throttle slider */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}
        >
          <div style={sectionLabel}>Throttle</div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: trackColor,
              transition: 'color 0.15s ease'
            }}
          >
            {throttle}
            <span style={{ fontSize: '14px', opacity: 0.6, marginLeft: '2px' }}>%</span>
          </div>
        </div>

        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={100}
          step={1}
          value={throttle}
          disabled={inProgress}
          onChange={(e) => setThrottle(parseInt(e.target.value, 10))}
          className="dl-throttle-slider"
          style={
            {
              width: '100%',
              cursor: inProgress ? 'not-allowed' : 'pointer',
              opacity: inProgress ? 0.4 : 1,
              ['--dl-thumb-color' as string]: trackColor,
              ['--dl-fill-pct' as string]: sliderPercent
            } as React.CSSProperties
          }
          aria-label="Throttle percent"
        />

        {/* Tick marks */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            color: 'rgba(236,223,204,0.3)',
            marginTop: '6px',
            letterSpacing: '0.04em'
          }}
        >
          <span>0</span>
          <span>25</span>
          <span style={{ color: '#F0C674' }}>50</span>
          <span style={{ color: '#F0C674' }}>70</span>
          <span style={{ color: '#E06C75' }}>100</span>
        </div>
      </div>

      {/* Duration */}
      <div style={{ marginBottom: '24px' }}>
        <div style={sectionLabel}>Duration</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {DURATION_PRESETS.map((d) => (
            <div
              key={d}
              onClick={() => !inProgress && setDuration(d)}
              style={durationPill(d)}
              role="button"
              aria-pressed={duration === d}
            >
              {d}s
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={handleStart}
          disabled={isArmed || inProgress || !isLinked}
          style={{
            flex: 1,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            padding: '12px 18px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            border: '1px solid',
            transition: 'all 0.15s ease',
            cursor: isArmed || inProgress || !isLinked ? 'not-allowed' : 'pointer',
            opacity: isArmed || inProgress || !isLinked ? 0.4 : 1,
            borderColor: '#00FF88',
            background: 'rgba(0, 255, 136, 0.08)',
            color: '#00FF88'
          }}
          title={
            isArmed
              ? 'Disarm vehicle first'
              : !isLinked
                ? 'No telemetry link'
                : inProgress
                  ? 'Test in progress'
                  : 'Start motor test'
          }
        >
          ▶ START TEST
        </button>
        <button
          onClick={() => void stopAll()}
          style={{
            flex: 1,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            padding: '12px 18px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            border: '1px solid #E06C75',
            background: 'rgba(224, 108, 117, 0.12)',
            color: '#E06C75',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          ■ STOP ALL
        </button>
      </div>

      {/* Status / progress */}
      <div
        style={{
          background: 'rgba(24, 28, 20, 0.6)',
          border: '1px solid rgba(236,223,204,0.08)',
          borderRadius: '4px',
          padding: '14px 16px',
          minHeight: '70px'
        }}
      >
        <div style={sectionLabel}>Status</div>
        {run ? (
          <>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                color: '#ECDFCC',
                marginBottom: '8px'
              }}
            >
              {selectionLabel(run.selection)} spinning at {run.throttle}% — {elapsed.toFixed(1)} /{' '}
              {run.duration.toFixed(1)} s
            </div>
            <div
              style={{
                width: '100%',
                height: '6px',
                background: 'rgba(236,223,204,0.08)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: throttleColor(run.throttle),
                  transition: 'width 0.05s linear'
                }}
              />
            </div>
          </>
        ) : (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              color:
                statusKind === 'error'
                  ? '#E06C75'
                  : statusKind === 'warn'
                    ? '#F0C674'
                    : 'rgba(236,223,204,0.65)'
            }}
          >
            {statusText ?? 'Idle — configure motor / throttle / duration, then START TEST.'}
          </div>
        )}
      </div>

      {/* Slider scoped CSS — keeps the design system tokens contained */}
      <style>{`
        .dl-throttle-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          background: linear-gradient(
            90deg,
            var(--dl-thumb-color) 0%,
            var(--dl-thumb-color) var(--dl-fill-pct),
            rgba(236, 223, 204, 0.1) var(--dl-fill-pct),
            rgba(236, 223, 204, 0.1) 100%
          );
          border-radius: 3px;
          outline: none;
          transition: background 0.15s ease;
        }
        .dl-throttle-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ECDFCC;
          border: 2px solid var(--dl-thumb-color);
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
          cursor: pointer;
          transition: transform 0.1s ease;
        }
        .dl-throttle-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .dl-throttle-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ECDFCC;
          border: 2px solid var(--dl-thumb-color);
          cursor: pointer;
        }
        .dl-throttle-slider:focus-visible {
          outline: 1px solid rgba(236, 223, 204, 0.5);
          outline-offset: 4px;
        }
      `}</style>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// SafetyBanner — lightweight inline notice
// ──────────────────────────────────────────────────────────────────────────────
interface SafetyBannerProps {
  tone: 'warn' | 'error'
  text: string
}

function SafetyBanner({ tone, text }: SafetyBannerProps): React.JSX.Element {
  const color = tone === 'error' ? '#E06C75' : '#F0C674'
  const bg = tone === 'error' ? 'rgba(224, 108, 117, 0.08)' : 'rgba(240, 198, 116, 0.06)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        background: bg,
        border: `1px solid ${color}30`,
        borderRadius: '3px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        color
      }}
    >
      <span style={{ fontSize: '13px', lineHeight: 1 }}>⚠</span>
      <span style={{ letterSpacing: '0.02em' }}>{text}</span>
    </div>
  )
}
