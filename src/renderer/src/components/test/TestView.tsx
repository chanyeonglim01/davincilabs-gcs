/**
 * TestView
 *
 * Top-level container for vehicle test/diagnostic tooling. Tabbed shell that
 * mirrors the structural language of MissionView / ParameterView so the
 * navigation feels native.
 *
 * Active tabs:
 *   - Motor Test    (DO_MOTOR_TEST / cmd 209)
 *   - Surface Test  (CTRL_SURF_TEST / cmd 31010)
 *
 * Placeholder tabs that will be filled in later milestones:
 *   - Sensor Test
 *   - Calibration
 */
import { useState } from 'react'
import { MotorTestPanel } from './MotorTestPanel'
import { CtrlSurfaceTestPanel } from './CtrlSurfaceTestPanel'

type TestTab = 'motor' | 'ctrlsurf' | 'sensor' | 'calibration'

interface TabDef {
  id: TestTab
  label: string
  short: string
  enabled: boolean
}

const TABS: TabDef[] = [
  { id: 'motor', label: 'Motor Test', short: 'MOTOR', enabled: true },
  { id: 'ctrlsurf', label: 'Surface Test', short: 'SURFACE', enabled: true },
  { id: 'sensor', label: 'Sensor Test', short: 'SENSOR', enabled: false },
  { id: 'calibration', label: 'Calibration', short: 'CAL', enabled: false }
]

export function TestView(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TestTab>('motor')

  return (
    <div
      style={{
        position: 'absolute',
        top: '56px',
        left: 0,
        right: 0,
        bottom: 0,
        background: '#181C14',
        color: '#ECDFCC',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* ── Tab strip ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '2px',
          padding: '20px 28px 0',
          borderBottom: '1px solid rgba(236, 223, 204, 0.08)',
          flexShrink: 0
        }}
      >
        {TABS.map((tab) => {
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              disabled={!tab.enabled}
              onClick={() => tab.enabled && setActiveTab(tab.id)}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                padding: '10px 18px',
                background: active ? 'rgba(236, 223, 204, 0.08)' : 'transparent',
                border: '1px solid',
                borderColor: active ? 'rgba(236, 223, 204, 0.2)' : 'transparent',
                borderBottomColor: active ? '#181C14' : 'transparent',
                borderRadius: '4px 4px 0 0',
                color: active
                  ? '#ECDFCC'
                  : tab.enabled
                    ? 'rgba(236, 223, 204, 0.45)'
                    : 'rgba(236, 223, 204, 0.18)',
                cursor: tab.enabled ? 'pointer' : 'not-allowed',
                marginBottom: '-1px',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              {tab.label}
              {!tab.enabled && (
                <span
                  style={{
                    fontSize: '8px',
                    letterSpacing: '0.18em',
                    marginLeft: '8px',
                    color: 'rgba(236, 223, 204, 0.25)'
                  }}
                >
                  SOON
                </span>
              )}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '10px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(236, 223, 204, 0.32)',
            paddingBottom: '14px'
          }}
        >
          Vehicle Diagnostics
        </div>
      </div>

      {/* ── Tab body ──────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '32px 28px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}
      >
        {activeTab === 'motor' && <MotorTestPanel />}
        {activeTab === 'ctrlsurf' && <CtrlSurfaceTestPanel />}
        {activeTab !== 'motor' && activeTab !== 'ctrlsurf' && (
          <PlaceholderPanel label={TABS.find((t) => t.id === activeTab)!.label} />
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Placeholder for tabs that aren't implemented yet
// ──────────────────────────────────────────────────────────────────────────────
interface PlaceholderProps {
  label: string
}

function PlaceholderPanel({ label }: PlaceholderProps): React.JSX.Element {
  return (
    <div
      style={{
        background: 'rgba(60, 61, 55, 0.4)',
        border: '1px dashed rgba(236, 223, 204, 0.15)',
        borderRadius: '6px',
        padding: '40px',
        textAlign: 'center',
        color: 'rgba(236, 223, 204, 0.4)',
        fontFamily: "'Space Grotesk', sans-serif",
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontSize: '12px',
        maxWidth: '480px'
      }}
    >
      {label} — coming soon
    </div>
  )
}
