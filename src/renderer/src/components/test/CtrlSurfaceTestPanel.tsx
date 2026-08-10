/**
 * CtrlSurfaceTestPanel
 *
 * Ground-bench control-surface test. Engages CTRL_SURF_TEST (cmd 31010) so the
 * aileron / elevator / rudder track either the GCS deflection values below or
 * the RC sticks. The FCS only accepts the override while disarmed and on the
 * ground, and auto-releases after a timeout.
 *
 * Mission-Planner-minimal layout, strictly the three GCS tokens
 * (#181C14 / #3C3D37 / #ECDFCC). Shares its chrome with MotorTestPanel via
 * ./testUi. State is shown through brightness and copy, never hue.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import { ConfirmModal } from '@renderer/components/ui/ConfirmModal'
import type { CtrlSurfSource } from '@renderer/types'
import { CREAM, panelShell, sectionLabel, pillStyle, primaryBtn, secondaryBtn } from './testStyles'
import { TestHeader, StatusReadout } from './testUi'

const TIMEOUT_S = 5 // matches Simulink ctrlSurfTest.timeout_s (auto-release)
const LARGE_DEFLECTION = 60 // % — surfaces this far trigger a confirm

interface Axis {
  key: 'dA' | 'dE' | 'dR'
  label: string
  sub: string
}

const AXES: Axis[] = [
  { key: 'dA', label: 'Aileron', sub: 'Roll · dA' },
  { key: 'dE', label: 'Elevator', sub: 'Pitch · dE' },
  { key: 'dR', label: 'Rudder', sub: 'Yaw · dR' }
]

interface EngagedState {
  source: CtrlSurfSource
  dA: number
  dE: number
  dR: number
  startedAt: number // ms epoch
}

export function CtrlSurfaceTestPanel(): React.JSX.Element {
  // Both are booleans that change rarely; selecting them individually keeps this
  // panel out of the 30 Hz telemetry re-render path.
  const isArmed = useTelemetryStore((state) => state.telemetry?.status.armed ?? false)
  const isLinked = useTelemetryStore((state) => state.connection.linkState === 'LINKED')

  const [source, setSource] = useState<CtrlSurfSource>('gcs')
  const [defl, setDefl] = useState<{ dA: number; dE: number; dR: number }>({ dA: 0, dE: 0, dR: 0 })
  const [engaged, setEngaged] = useState<EngagedState | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const [statusText, setStatusText] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)

  const blocked = isArmed || !isLinked
  const gcsMode = source === 'gcs'

  const send = useCallback(
    async (enable: boolean, src: CtrlSurfSource, d: { dA: number; dE: number; dR: number }) => {
      if (!window.mavlink?.ctrlSurfTest) {
        setStatusText('MAVLink bridge unavailable')
        return false
      }
      const result = await window.mavlink.ctrlSurfTest({
        enable,
        source: src,
        dA: d.dA / 100,
        dE: d.dE / 100,
        dR: d.dR / 100
      })
      if (!result.success) {
        setStatusText(result.error ?? 'Control surface test failed')
        return false
      }
      return true
    },
    []
  )

  const apply = useCallback(async () => {
    const payloadDefl = gcsMode ? defl : { dA: 0, dE: 0, dR: 0 }
    const ok = await send(true, source, payloadDefl)
    if (!ok) return
    setEngaged({ source, ...payloadDefl, startedAt: Date.now() })
    setStatusText(null)
  }, [gcsMode, defl, source, send])

  const release = useCallback(
    async (reason?: string) => {
      await send(false, source, { dA: 0, dE: 0, dR: 0 })
      setEngaged(null)
      setStatusText(reason ?? 'Released')
    },
    [send, source]
  )

  // While engaged: advance the countdown, auto-release on the FCS timeout, and
  // bail out immediately if the vehicle arms or the link drops. State changes
  // live in the interval callback (deferred), not the effect body.
  useEffect(() => {
    if (!engaged) return
    const id = window.setInterval(() => {
      if (isArmed || !isLinked) {
        void release(isArmed ? 'Released — vehicle armed' : 'Released — link lost')
        return
      }
      const t = Date.now()
      setNow(t)
      if ((t - engaged.startedAt) / 1000 >= TIMEOUT_S) {
        setEngaged(null)
        setStatusText('Auto-released (timeout) — re-apply to extend')
      }
    }, 50)
    return () => window.clearInterval(id)
  }, [engaged, isArmed, isLinked, release])

  // Release on unmount (tab switch) so surfaces never stay deflected out of view.
  useEffect(() => {
    return () => {
      void window.mavlink?.ctrlSurfTest?.({
        enable: false,
        source: 'gcs',
        dA: 0,
        dE: 0,
        dR: 0
      })
    }
  }, [])

  const handleApply = useCallback(() => {
    if (blocked) return
    const big = gcsMode && AXES.some((a) => Math.abs(defl[a.key]) >= LARGE_DEFLECTION)
    if (!big) {
      void apply()
      return
    }
    setConfirm({
      message: `Large deflection commanded (≥${LARGE_DEFLECTION}%).\nClear the area around the control surfaces.\n\nProceed?`,
      onConfirm: () => {
        setConfirm(null)
        void apply()
      }
    })
  }, [blocked, gcsMode, defl, apply])

  const elapsed = engaged ? Math.min((now - engaged.startedAt) / 1000, TIMEOUT_S) : 0
  const remaining = engaged ? Math.max(0, TIMEOUT_S - elapsed) : 0
  // idle gauge = largest commanded deflection magnitude (GCS source only)
  const idleGauge = gcsMode
    ? Math.max(Math.abs(defl.dA), Math.abs(defl.dE), Math.abs(defl.dR)) / 100
    : 0

  // bipolar fill anchored at centre (50%)
  const sliderFill = (value: number): string => {
    const pct = (value + 100) / 2
    const lo = Math.min(50, pct)
    const hi = Math.max(50, pct)
    const dim = 'rgba(236,223,204,0.1)'
    const fill = 'rgba(236,223,204,0.5)'
    return `linear-gradient(90deg, ${dim} 0% ${lo}%, ${fill} ${lo}% ${hi}%, ${dim} ${hi}% 100%)`
  }

  return (
    <div style={panelShell}>
      <TestHeader
        title="CONTROL SURFACE TEST"
        safety="Surfaces will move. Keep clear and test only while disarmed."
        armed={isArmed}
        linked={isLinked}
      />

      {/* Source */}
      <div style={{ marginBottom: '22px' }}>
        <div style={sectionLabel}>Drive Source</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div
            onClick={() => !engaged && setSource('gcs')}
            style={{ ...pillStyle(source === 'gcs', engaged !== null), minWidth: '110px' }}
            role="button"
            aria-pressed={source === 'gcs'}
          >
            GCS VALUES
          </div>
          <div
            onClick={() => !engaged && setSource('rc')}
            style={{ ...pillStyle(source === 'rc', engaged !== null), minWidth: '110px' }}
            role="button"
            aria-pressed={source === 'rc'}
          >
            RC STICKS
          </div>
          <div
            style={{
              marginLeft: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.04em',
              color: 'rgba(236,223,204,0.4)'
            }}
          >
            {gcsMode ? 'follows values below' : 'follows RC sticks'}
          </div>
        </div>
      </div>

      {/* Deflection sliders (GCS source only) */}
      <div style={{ marginBottom: '22px', opacity: gcsMode ? 1 : 0.4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}
        >
          <div style={{ ...sectionLabel, marginBottom: 0 }}>Deflection</div>
          <div
            onClick={() => !engaged && gcsMode && setDefl({ dA: 0, dE: 0, dR: 0 })}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(236,223,204,0.45)',
              cursor: !engaged && gcsMode ? 'pointer' : 'not-allowed',
              opacity: !engaged && gcsMode ? 1 : 0.4,
              userSelect: 'none'
            }}
            role="button"
          >
            Center all
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {AXES.map((axis) => {
            const value = defl[axis.key]
            const disabled = !gcsMode || engaged !== null
            return (
              <div key={axis.key}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: '5px'
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '12px',
                      letterSpacing: '0.06em',
                      color: 'rgba(236,223,204,0.85)'
                    }}
                  >
                    {axis.label}
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: '9px',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'rgba(236,223,204,0.35)',
                        marginLeft: '8px'
                      }}
                    >
                      {axis.sub}
                    </span>
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '15px',
                      fontWeight: 700,
                      color: value === 0 ? 'rgba(236,223,204,0.5)' : CREAM
                    }}
                  >
                    {value > 0 ? '+' : ''}
                    {value}
                    <span style={{ fontSize: '11px', opacity: 0.6, marginLeft: '1px' }}>%</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={value}
                  disabled={disabled}
                  onChange={(e) =>
                    setDefl((prev) => ({ ...prev, [axis.key]: parseInt(e.target.value, 10) }))
                  }
                  className="dl-defl-slider"
                  style={
                    {
                      width: '100%',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      ['--dl-defl-fill' as string]: sliderFill(value)
                    } as React.CSSProperties
                  }
                  aria-label={`${axis.label} deflection percent`}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        <button
          onClick={handleApply}
          disabled={blocked}
          style={primaryBtn(blocked)}
          title={isArmed ? 'Disarm vehicle first' : !isLinked ? 'No telemetry link' : 'Engage test'}
        >
          {engaged ? 'Re-apply' : 'Apply'}
        </button>
        <button onClick={() => void release()} style={secondaryBtn}>
          Release
        </button>
      </div>

      {/* Status — instrument readout */}
      <StatusReadout
        cells={[
          { label: 'State', value: engaged ? 'ENGAGED' : 'IDLE' },
          { label: 'Source', value: (engaged ? engaged.source : source) === 'gcs' ? 'GCS' : 'RC' },
          {
            label: 'Deflection',
            value:
              (engaged ? engaged.source : source) === 'rc'
                ? 'sticks'
                : engaged
                  ? `${fmt(engaged.dA)} ${fmt(engaged.dE)} ${fmt(engaged.dR)}`
                  : `${fmt(defl.dA)} ${fmt(defl.dE)} ${fmt(defl.dR)}`
          },
          {
            label: 'Time',
            value: engaged ? `${remaining.toFixed(1)}s` : `${TIMEOUT_S}s`
          }
        ]}
        progress={engaged ? elapsed / TIMEOUT_S : idleGauge}
        note={!engaged ? (statusText ?? undefined) : undefined}
      />

      {/* Slider scoped CSS — cream tokens only */}
      <style>{`
        .dl-defl-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          background: var(--dl-defl-fill);
          border-radius: 3px;
          outline: none;
        }
        .dl-defl-slider::-webkit-slider-thumb {
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
        .dl-defl-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
        .dl-defl-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ECDFCC;
          border: 2px solid rgba(60, 61, 55, 0.9);
          cursor: pointer;
        }
        .dl-defl-slider:disabled::-webkit-slider-thumb { background: rgba(236,223,204,0.4); }
        .dl-defl-slider:focus-visible {
          outline: 1px solid rgba(236, 223, 204, 0.5);
          outline-offset: 4px;
        }
      `}</style>

      <ConfirmModal
        open={confirm !== null}
        label="SURFACE TEST"
        message={confirm?.message ?? ''}
        confirmText="PROCEED"
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

function fmt(v: number): string {
  return `${v > 0 ? '+' : ''}${v}`
}
