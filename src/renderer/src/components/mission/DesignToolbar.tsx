import { DesignMode } from '@renderer/store/missionStore'

const mono = "'JetBrains Mono', monospace"
const sans = "'Space Grotesk', sans-serif"
const dim  = 'rgba(236,223,204,0.1)'

interface DesignToolbarProps {
  expanded: boolean
  onToggle: () => void
  designMode: DesignMode
  onSetMode: (mode: DesignMode) => void
}

export function DesignToolbar({ expanded, onToggle, designMode, onSetMode }: DesignToolbarProps) {
  const handleWaypoint = () => {
    onSetMode(designMode === 'waypoint' ? 'none' : 'waypoint')
  }

  const handleSurvey = () => {
    onSetMode(designMode === 'survey-polygon' ? 'none' : 'survey-polygon')
  }

  return (
    <div
      style={{
        height: '36px',
        background: 'rgba(24,28,20,0.97)',
        borderBottom: `1px solid ${dim}`,
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: '0',
        flexShrink: 0,
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      {/* Label + toggle */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 8px 4px 0',
          color: expanded ? '#ECDFCC' : 'rgba(236,223,204,0.45)',
        }}
      >
        {/* Pencil icon (SVG) */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <span style={{
          fontFamily: sans, fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          DESIGN
        </span>
        {/* Chevron */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Divider */}
      {expanded && <div style={{ width: 1, height: 18, background: dim, margin: '0 10px' }} />}

      {/* Add Waypoint tool */}
      {expanded && (
        <ToolBtn
          active={designMode === 'waypoint'}
          accentColor="#4FC3F7"
          onClick={handleWaypoint}
          icon={
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8"  y1="12" x2="16" y2="12" />
            </svg>
          }
          label="Add Waypoint"
        />
      )}

      {/* Survey Grid tool */}
      {expanded && (
        <>
          <div style={{ width: 1, height: 18, background: dim, margin: '0 6px' }} />
          <ToolBtn
            active={designMode === 'survey-polygon'}
            accentColor="#B39DDB"
            onClick={handleSurvey}
            icon={
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3"  y1="9"  x2="21" y2="9"  />
                <line x1="3"  y1="15" x2="21" y2="15" />
                <line x1="9"  y1="3"  x2="9"  y2="21" />
                <line x1="15" y1="3"  x2="15" y2="21" />
              </svg>
            }
            label="Survey Grid"
          />
        </>
      )}

      {/* Mode hint when survey-polygon active */}
      {expanded && designMode === 'survey-polygon' && (
        <span style={{
          fontFamily: mono, fontSize: '9px',
          color: 'rgba(179,157,219,0.6)',
          marginLeft: '10px',
          letterSpacing: '0.06em',
        }}>
          클릭으로 꼭짓점 추가 · 첫 점 근처 클릭으로 닫기
        </span>
      )}
    </div>
  )
}

interface ToolBtnProps {
  active: boolean
  accentColor: string
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function ToolBtn({ active, accentColor, onClick, icon, label }: ToolBtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: '10px',
        fontWeight: active ? 700 : 500,
        letterSpacing: '0.06em',
        padding: '4px 10px',
        background: active ? `${accentColor}14` : 'transparent',
        border: `1px solid ${active ? accentColor + '50' : 'rgba(236,223,204,0.12)'}`,
        borderRadius: '4px',
        color: active ? accentColor : 'rgba(236,223,204,0.5)',
        cursor: 'pointer',
        transition: 'all 0.12s ease',
      }}
    >
      <span style={{ color: active ? accentColor : 'rgba(236,223,204,0.4)' }}>{icon}</span>
      {label}
    </button>
  )
}
