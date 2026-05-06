import { SurveyGridParams, SurveyGridResult } from '@renderer/lib/surveyGrid'

const mono = "'JetBrains Mono', monospace"
const sans = "'Space Grotesk', sans-serif"

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

interface SurveyConfigPanelProps {
  params: SurveyGridParams
  onParamChange: (params: SurveyGridParams) => void
  previewResult: SurveyGridResult | null
  onPreview: () => void
  onApply: () => void
  onCancel: () => void
}

export function SurveyConfigPanel({
  params,
  onParamChange,
  previewResult,
  onPreview,
  onApply,
  onCancel
}: SurveyConfigPanelProps) {
  const set = (key: keyof SurveyGridParams, value: number) =>
    onParamChange({ ...params, [key]: value })

  return (
    <div
      style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        zIndex: 1100,
        background: 'rgba(24,28,20,0.97)',
        border: '1px solid rgba(179,157,219,0.3)',
        borderRadius: '8px',
        padding: '0',
        width: '220px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid rgba(236,223,204,0.08)',
          background: 'rgba(179,157,219,0.06)'
        }}
      >
        <span
          style={{
            fontFamily: mono,
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#B39DDB'
          }}
        >
          SURVEY GRID CONFIG
        </span>
      </div>

      {/* Params */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <ParamRow
          label="Spacing"
          unit="m"
          value={params.spacing}
          min={5}
          max={500}
          step={5}
          onChange={(v) => set('spacing', v)}
        />
        <ParamRow
          label="Angle"
          unit="°"
          value={params.angle}
          min={0}
          max={359}
          step={5}
          onChange={(v) => set('angle', v)}
        />
        <ParamRow
          label="Altitude"
          unit="m"
          value={params.altitude}
          min={1}
          max={2000}
          step={5}
          onChange={(v) => set('altitude', v)}
        />
        <ParamRow
          label="Overshoot"
          unit="m"
          value={params.overshoot}
          min={0}
          max={200}
          step={5}
          onChange={(v) => set('overshoot', v)}
        />
      </div>

      {/* Stats */}
      {previewResult && (
        <div
          style={{
            padding: '6px 12px',
            borderTop: '1px solid rgba(236,223,204,0.06)',
            borderBottom: '1px solid rgba(236,223,204,0.06)',
            background: 'rgba(0,0,0,0.2)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}
        >
          <span style={{ fontFamily: mono, fontSize: '9px', color: '#B39DDB', fontWeight: 700 }}>
            {previewResult.waypoints.length} WPs
          </span>
          <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.35)' }}>
            {fmtDist(previewResult.totalDistance)}
          </span>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          gap: '6px'
        }}
      >
        <ActionBtn label="PREVIEW" color="#B39DDB" onClick={onPreview} />
        <ActionBtn label="CANCEL" color="rgba(236,223,204,0.4)" onClick={onCancel} />
        <ActionBtn
          label="APPLY"
          color="#4FC3F7"
          onClick={onApply}
          disabled={!previewResult || previewResult.waypoints.length === 0}
          primary
        />
      </div>
    </div>
  )
}

interface ParamRowProps {
  label: string
  unit: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}

function ParamRow({ label, unit, value, min, max, step, onChange }: ParamRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span
        style={{
          fontFamily: sans,
          fontSize: '10px',
          color: 'rgba(236,223,204,0.5)',
          minWidth: '64px'
        }}
      >
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          flex: 1,
          fontFamily: mono,
          fontSize: '11px',
          fontWeight: 700,
          background: 'rgba(60,61,55,0.5)',
          border: '1px solid rgba(236,223,204,0.12)',
          borderRadius: '3px',
          color: 'rgba(236,223,204,0.85)',
          padding: '3px 6px',
          outline: 'none',
          textAlign: 'right'
        }}
      />
      <span
        style={{
          fontFamily: mono,
          fontSize: '9px',
          color: 'rgba(236,223,204,0.3)',
          minWidth: '12px'
        }}
      >
        {unit}
      </span>
    </div>
  )
}

interface ActionBtnProps {
  label: string
  color: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}

function ActionBtn({ label, color, onClick, disabled = false, primary = false }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: primary ? 1.2 : 1,
        fontFamily: mono,
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '5px 4px',
        background: primary && !disabled ? `${color}14` : 'transparent',
        border: `1px solid ${disabled ? 'rgba(236,223,204,0.1)' : color + (primary ? '50' : '30')}`,
        borderRadius: '4px',
        color: disabled ? 'rgba(236,223,204,0.2)' : color,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.12s ease'
      }}
    >
      {label}
    </button>
  )
}
