import { useState } from 'react'
import { Header } from './Header'
import { MapBackground } from './MapBackground'
import { InstrumentsPanel } from './panels/InstrumentsPanel'
import { AvionicsPanel } from './panels/AvionicsPanel'
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
        zIndex: 1100  // above Leaflet controls (1000)
      }}
    >
      {children(onMouseDown)}
    </div>
  )
}

// ─── MapOverlay ────────────────────────────────────────────────────────────────
export function MapOverlay() {
  const [collapsed, setCollapsed] = useState({
    instruments: false,  // open: instruments always visible on startup
    telemetry: true,     // collapsed: bottom bar
    chart: true,         // collapsed: bottom bar
    log: true            // collapsed: bottom bar
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
      {/* Full-screen map — no stacking context wrapper, natural layer */}
      <MapBackground />

      {/* Fixed header — z-index 1200 (topmost) */}
      <Header />

      {/* ── FIXED PANELS ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '68px',
          right: '20px',
          zIndex: 1100
        }}
      >
        <AvionicsPanel />
      </div>

      {/* ── DRAGGABLE PANELS ─────────────────────────────────────────────────── */}
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

      {/* Bottom row: STATUS | LOG | CHARTS — all collapsed on startup */}
      <DraggablePanel initialX={20} initialY={730}>
        {(handle) => (
          <TelemetryPanel
            onDragHandle={handle}
            collapsed={collapsed.telemetry}
            onToggle={() => toggle('telemetry')}
          />
        )}
      </DraggablePanel>

      <DraggablePanel initialX={250} initialY={730}>
        {(handle) => (
          <LogPanel
            onDragHandle={handle}
            collapsed={collapsed.log}
            onToggle={() => toggle('log')}
          />
        )}
      </DraggablePanel>

      <DraggablePanel initialX={644} initialY={730}>
        {(handle) => (
          <ChartPanel
            onDragHandle={handle}
            collapsed={collapsed.chart}
            onToggle={() => toggle('chart')}
          />
        )}
      </DraggablePanel>
    </div>
  )
}
