import { useState } from 'react'
import { Header } from './Header'
import { MapBackground } from './MapBackground'
import { InstrumentsPanel } from './panels/InstrumentsPanel'
import { AvionicsPanel } from './panels/AvionicsPanel'
import { CommandsPanel } from './panels/CommandsPanel'
import { TelemetryPanel } from './panels/TelemetryPanel'
import { ChartPanel } from './panels/ChartPanel'
import { LogPanel } from './panels/LogPanel'
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
        zIndex: 20
      }}
    >
      {children(onMouseDown)}
    </div>
  )
}

// ─── MapOverlay ────────────────────────────────────────────────────────────────
export function MapOverlay() {
  const [collapsed, setCollapsed] = useState({
    instruments: false,
    telemetry: false,
    chart: false,
    log: false
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
      {/* Full-screen map */}
      <MapBackground />

      {/* Fixed header */}
      <Header />

      {/* ── FIXED PANELS ─────────────────────────────────────────────────────── */}
      {/* Top-right: Avionics display */}
      <div
        style={{
          position: 'absolute',
          top: '68px',
          right: '20px',
          zIndex: 20
        }}
      >
        <AvionicsPanel />
      </div>

      {/* Below avionics: Commands */}
      <div
        style={{
          position: 'absolute',
          top: '300px',
          right: '20px',
          zIndex: 20
        }}
      >
        <CommandsPanel />
      </div>

      {/* ── DRAGGABLE PANELS ─────────────────────────────────────────────────── */}
      {/* Instruments - initially top-left */}
      <DraggablePanel initialX={20} initialY={68}>
        {(handle) => (
          <InstrumentsPanel
            onDragHandle={handle}
            collapsed={collapsed.instruments}
            onToggle={() => toggle('instruments')}
          />
        )}
      </DraggablePanel>

      {/* Telemetry numbers - initially bottom-right area */}
      <DraggablePanel initialX={20} initialY={420}>
        {(handle) => (
          <TelemetryPanel
            onDragHandle={handle}
            collapsed={collapsed.telemetry}
            onToggle={() => toggle('telemetry')}
          />
        )}
      </DraggablePanel>

      {/* Chart - initially bottom-center */}
      <DraggablePanel initialX={280} initialY={580}>
        {(handle) => (
          <ChartPanel
            onDragHandle={handle}
            collapsed={collapsed.chart}
            onToggle={() => toggle('chart')}
          />
        )}
      </DraggablePanel>

      {/* Log - initially bottom-left */}
      <DraggablePanel initialX={20} initialY={580}>
        {(handle) => (
          <LogPanel
            onDragHandle={handle}
            collapsed={collapsed.log}
            onToggle={() => toggle('log')}
          />
        )}
      </DraggablePanel>
    </div>
  )
}
