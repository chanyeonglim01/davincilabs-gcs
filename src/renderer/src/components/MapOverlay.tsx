import { useState } from 'react'
import { Header, ViewType } from './Header'
import { MapBackground } from './MapBackground'
import { InstrumentsPanel } from './panels/InstrumentsPanel'
import { AvionicsPanel } from './panels/AvionicsPanel'
import { TelemetryPanel } from './panels/TelemetryPanel'
import { ChartPanel } from './panels/ChartPanel'
import { LogPanel } from './panels/LogPanel'
import { MissionView } from './MissionView'
import { ParameterView } from '@renderer/features/builder'
import { useDraggable } from '@renderer/hooks/useDraggable'

// ─── Draggable wrapper ─────────────────────────────────────────────────────────
interface DraggablePanelProps {
  initialX: number
  initialY: number
  children: (onDragHandle: (e: React.MouseEvent) => void) => React.ReactNode
}

function DraggablePanel({ initialX, initialY, children }: DraggablePanelProps) {
  const { pos, onMouseDown } = useDraggable({ x: initialX, y: initialY })

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        zIndex: 1100
      }}
    >
      {children(onMouseDown)}
    </div>
  )
}

// ─── MapOverlay ────────────────────────────────────────────────────────────────
export function MapOverlay() {
  const [currentView, setCurrentView] = useState<ViewType>('main')
  const [collapsed, setCollapsed] = useState({
    instruments: false,
    chart: false,
    log: false,
    telemetry: false
  })

  const toggle = (key: keyof typeof collapsed) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#181C14'
      }}
    >
      {/* Fixed header — z-index 1200 (topmost) */}
      <Header currentView={currentView} onViewChange={setCurrentView} />

      {/* ── MAIN VIEW ──────────────────────────────────────────────────────────── */}
      {currentView === 'main' && (
        <>
          {/* Full-screen map */}
          <MapBackground />

          {/* Right column: Avionics + Status stacked */}
          <div
            style={{
              position: 'absolute',
              top: '68px',
              right: '20px',
              zIndex: 1100,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <AvionicsPanel />
            <TelemetryPanel
              onDragHandle={() => {}}
              collapsed={collapsed.telemetry}
              onToggle={() => toggle('telemetry')}
            />
          </div>

          {/* Top-left: Instruments (open) */}
          <DraggablePanel initialX={20} initialY={68}>
            {(handle) => (
              <InstrumentsPanel
                onDragHandle={handle}
                collapsed={collapsed.instruments}
                onToggle={() => toggle('instruments')}
              />
            )}
          </DraggablePanel>

          {/* Left: Charts */}
          <DraggablePanel initialX={20} initialY={290}>
            {(handle) => (
              <ChartPanel
                onDragHandle={handle}
                collapsed={collapsed.chart}
                onToggle={() => toggle('chart')}
              />
            )}
          </DraggablePanel>

          {/* Left: Log */}
          <DraggablePanel initialX={20} initialY={624}>
            {(handle) => (
              <LogPanel
                onDragHandle={handle}
                collapsed={collapsed.log}
                onToggle={() => toggle('log')}
              />
            )}
          </DraggablePanel>
        </>
      )}

      {/* ── MISSION VIEW ───────────────────────────────────────────────────────── */}
      {currentView === 'mission' && <MissionView />}

      {/* ── PARAMETER VIEW ─────────────────────────────────────────────────────── */}
      {currentView === 'parameter' && <ParameterView />}
    </div>
  )
}
