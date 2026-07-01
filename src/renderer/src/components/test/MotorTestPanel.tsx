/**
 * MotorTestPanel
 *
 * Sends MAV_CMD_DO_MOTOR_TEST (cmd 209). param1 carries a motor bitmask (bit
 * i-1 = motor i), so any set of motors spins simultaneously at the test PWM for
 * the chosen duration, then an explicit stop is sent.
 *
 * Mission-Planner-minimal layout, strictly the three GCS tokens
 * (#181C14 / #3C3D37 / #ECDFCC). State is shown through brightness and copy,
 * never hue. Shares its chrome with CtrlSurfaceTestPanel via ./testUi.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import { ConfirmModal } from '@renderer/components/ui/ConfirmModal'
import { CREAM, panelShell, sectionLabel, pillStyle, primaryBtn, secondaryBtn } from './testStyles'
import { TestHeader, StatusReadout } from './testUi'

const MOTOR_COUNT = 6
const DURATION_PRESETS = [1, 2, 3, 5] as const
const HIGH_THROTTLE_THRESHOLD = 70 // % — triggers extra confirm
const LONG_DURATION_THRESHOLD = 3 // seconds — triggers extra confirm
const SEQ_GAP_MS = 150 // settle margin before the stop — absorbs IPC/UDP/FCS latency

interface RunState {
  motors: number[] // motors spinning together (1-based)
  throttle: number
  duration: number
  startedAt: number // ms epoch
}

/** selected motors → DO_MOTOR_TEST bitmask (bit i-1 = motor i). */
function motorMask(set: Set<number>): number {
  let m = 0
  for (const n of set) m |= 1 << (n - 1)
  return m
}

function motorListLabel(motors: number[]): string {
  if (motors.length === MOTOR_COUNT) return 'ALL'
  return motors
    .slice()
    .sort((a, b) => a - b)
    .map((n) => `M${n}`)
    .join(',')
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function MotorTestPanel(): React.JSX.Element {
  const { telemetry, connection } = useTelemetryStore()
  const isArmed = telemetry?.status.armed ?? false
  const isLinked = connection.linkState === 'LINKED'

  const [selected, setSelected] = useState<Set<number>>(() => new Set([1]))
  const [throttle, setThrottle] = useState<number>(20)
  const [duration, setDuration] = useState<number>(1)
  const [customDur, setCustomDur] = useState<string>('') // custom seconds (non-empty = custom mode)
  const [run, setRun] = useState<RunState | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const [statusText, setStatusText] = useState<string | null>(null)

  const [confirm, setConfirm] = useState<{
    message: string
    onConfirm: () => void
  } | null>(null)

  // Abort flag for the sequential sweep (set by STOP).
  const abortRef = useRef(false)

  // 50ms ticker only while a test is running — advances the progress bar. The
  // sequence runner (performTest) owns timing/clearing of `run`.
  useEffect(() => {
    if (!run) return
    const id = window.setInterval(() => setNow(Date.now()), 50)
    return () => window.clearInterval(id)
  }, [run])

  // Safety: if the panel unmounts (tab switch) mid-sweep, abort and send a
  // best-effort stop so a motor never keeps spinning out of view.
  useEffect(() => {
    return () => {
      abortRef.current = true
      void window.mavlink?.motorTest?.({
        motor: 0,
        throttle: 0,
        duration: 0,
        throttleType: 'percent',
        motorCount: MOTOR_COUNT
      })
    }
  }, [])

  const inProgress = run !== null

  const sendMotorTest = useCallback(
    async (motor: number, t: number, d: number): Promise<boolean> => {
      if (!window.mavlink?.motorTest) {
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
          setStatusText(result.error ?? 'Motor test failed')
          return false
        }
        return true
      } catch (err) {
        setStatusText(err instanceof Error ? err.message : 'IPC error')
        return false
      }
    },
    []
  )

  const stopAll = useCallback(async () => {
    abortRef.current = true
    await sendMotorTest(0, 0, 0)
    setRun(null)
    setStatusText('STOP sent')
  }, [sendMotorTest])

  // Spin all selected motors together: one DO_MOTOR_TEST carrying a bitmask of
  // the chosen motors. The FCS drives every masked motor at the test PWM for
  // `duration`, then we send an explicit stop.
  const performTest = useCallback(async () => {
    const motors = [...selected].sort((a, b) => a - b)
    if (motors.length === 0) return

    abortRef.current = false
    const ok = await sendMotorTest(motorMask(selected), throttle, duration)
    if (!ok) {
      setRun(null)
      return
    }
    setRun({ motors, throttle, duration, startedAt: Date.now() })
    setStatusText(null)
    await sleep(duration * 1000 + SEQ_GAP_MS)
    if (abortRef.current) return

    await sendMotorTest(0, 0, 0)
    setRun(null)
    setStatusText(`Complete · ${motorListLabel(motors)}`)
  }, [selected, throttle, duration, sendMotorTest])

  const handleStart = useCallback(() => {
    if (isArmed || inProgress || selected.size === 0) return

    const warnings: string[] = []
    if (throttle >= HIGH_THROTTLE_THRESHOLD)
      warnings.push(`High throttle (${throttle}%) — make absolutely sure props are removed.`)
    if (duration > LONG_DURATION_THRESHOLD) warnings.push(`Long duration (${duration}s).`)
    if (selected.size > 1) warnings.push(`${selected.size} motors will spin simultaneously.`)

    if (warnings.length === 0) {
      void performTest()
      return
    }

    setConfirm({
      message: `${warnings.join('\n')}\n\nProceed?`,
      onConfirm: () => {
        setConfirm(null)
        void performTest()
      }
    })
  }, [isArmed, inProgress, selected, throttle, duration, performTest])

  const elapsed = run ? Math.min((now - run.startedAt) / 1000, run.duration) : 0
  const progressPct = run && run.duration > 0 ? (elapsed / run.duration) * 100 : 0
  const startDisabled = isArmed || inProgress || !isLinked || selected.size === 0

  return (
    <div style={panelShell}>
      <TestHeader
        title="MOTOR TEST"
        safety="Remove propellers and keep clear. Test only while disarmed."
        armed={isArmed}
        linked={isLinked}
      />

      {/* Motor selection */}
      <div style={{ marginBottom: '22px' }}>
        <div style={sectionLabel}>Motor</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Array.from({ length: MOTOR_COUNT }, (_, i) => i + 1).map((n) => (
            <div
              key={n}
              onClick={() => {
                if (inProgress) return
                setSelected((prev) => {
                  const next = new Set(prev)
                  if (next.has(n)) next.delete(n)
                  else next.add(n)
                  return next
                })
              }}
              style={pillStyle(selected.has(n), inProgress)}
              role="button"
              aria-pressed={selected.has(n)}
            >
              M{n}
            </div>
          ))}
          <div
            onClick={() => {
              if (inProgress) return
              setSelected((prev) =>
                prev.size === MOTOR_COUNT
                  ? new Set()
                  : new Set(Array.from({ length: MOTOR_COUNT }, (_, i) => i + 1))
              )
            }}
            style={{ ...pillStyle(selected.size === MOTOR_COUNT, inProgress), minWidth: '64px' }}
            role="button"
            aria-pressed={selected.size === MOTOR_COUNT}
          >
            ALL
          </div>
        </div>
      </div>

      {/* Throttle + Duration row */}
      <div style={{ display: 'flex', gap: '28px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}
          >
            <div style={sectionLabel}>Throttle</div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '22px',
                fontWeight: 700,
                color: CREAM
              }}
            >
              {throttle}
              <span style={{ fontSize: '12px', opacity: 0.6, marginLeft: '2px' }}>%</span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={throttle}
            disabled={inProgress}
            onChange={(e) => setThrottle(parseInt(e.target.value, 10))}
            className="dl-test-slider"
            style={
              {
                width: '100%',
                cursor: inProgress ? 'not-allowed' : 'pointer',
                opacity: inProgress ? 0.4 : 1,
                ['--dl-fill-pct' as string]: `${throttle}%`
              } as React.CSSProperties
            }
            aria-label="Throttle percent"
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '9px',
              color: 'rgba(236,223,204,0.3)',
              marginTop: '6px'
            }}
          >
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>70</span>
            <span>100</span>
          </div>
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <div style={sectionLabel}>Duration</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {DURATION_PRESETS.map((d) => (
              <div
                key={d}
                onClick={() => {
                  if (inProgress) return
                  setDuration(d)
                  setCustomDur('')
                }}
                style={{
                  ...pillStyle(customDur === '' && duration === d, inProgress),
                  minWidth: '44px'
                }}
                role="button"
                aria-pressed={customDur === '' && duration === d}
              >
                {d}s
              </div>
            ))}
            <input
              type="text"
              inputMode="decimal"
              value={customDur}
              placeholder="sec"
              disabled={inProgress}
              onChange={(e) => {
                const txt = e.target.value
                setCustomDur(txt)
                const n = parseFloat(txt)
                if (Number.isFinite(n) && n > 0) setDuration(n)
              }}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '8px 10px',
                width: '60px',
                textAlign: 'center',
                borderRadius: '4px',
                border: `1px solid ${customDur !== '' ? 'rgba(236,223,204,0.55)' : 'rgba(236,223,204,0.14)'}`,
                background: customDur !== '' ? 'rgba(236,223,204,0.12)' : 'rgba(60,61,55,0.5)',
                color: CREAM,
                outline: 'none',
                cursor: inProgress ? 'not-allowed' : 'text',
                opacity: inProgress ? 0.45 : 1
              }}
              aria-label="Custom duration seconds"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        <button
          onClick={handleStart}
          disabled={startDisabled}
          style={primaryBtn(startDisabled)}
          title={
            isArmed
              ? 'Disarm vehicle first'
              : !isLinked
                ? 'No telemetry link'
                : selected.size === 0
                  ? 'Select at least one motor'
                  : 'Start motor test'
          }
        >
          ▶ Start
        </button>
        <button onClick={() => void stopAll()} style={secondaryBtn}>
          ■ Stop
        </button>
      </div>

      {/* Status — instrument readout */}
      <StatusReadout
        cells={[
          { label: 'State', value: run ? 'RUNNING' : 'IDLE' },
          { label: 'Motor', value: run ? motorListLabel(run.motors) : '—' },
          { label: 'Throttle', value: `${run ? run.throttle : throttle}%` },
          {
            label: 'Time',
            value: run ? `${elapsed.toFixed(1)} / ${run.duration.toFixed(1)}s` : `${duration}s`
          }
        ]}
        progress={run ? progressPct / 100 : throttle / 100}
        note={!run ? (statusText ?? undefined) : undefined}
      />

      {/* Slider scoped CSS — cream tokens only */}
      <style>{`
        .dl-test-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          background: linear-gradient(
            90deg,
            rgba(236, 223, 204, 0.55) 0%,
            rgba(236, 223, 204, 0.55) var(--dl-fill-pct),
            rgba(236, 223, 204, 0.1) var(--dl-fill-pct),
            rgba(236, 223, 204, 0.1) 100%
          );
          border-radius: 3px;
          outline: none;
        }
        .dl-test-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ECDFCC;
          border: 2px solid rgba(60, 61, 55, 0.9);
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
          cursor: pointer;
          transition: transform 0.1s ease;
        }
        .dl-test-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
        .dl-test-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ECDFCC;
          border: 2px solid rgba(60, 61, 55, 0.9);
          cursor: pointer;
        }
        .dl-test-slider:disabled::-webkit-slider-thumb { background: rgba(236,223,204,0.4); }
        .dl-test-slider:focus-visible {
          outline: 1px solid rgba(236, 223, 204, 0.5);
          outline-offset: 4px;
        }
      `}</style>

      <ConfirmModal
        open={confirm !== null}
        label="MOTOR TEST"
        message={confirm?.message ?? ''}
        confirmText="PROCEED"
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
