import { useState, useCallback } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Handle,
  Position,
  NodeProps,
  useNodesState,
  useEdgesState,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ParamField {
  key: string
  label: string
  value: number | string
  type: 'number' | 'select'
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: string[]
  mavId?: string
}

type NodeCategory = 'airframe' | 'battery' | 'att' | 'rate' | 'pos' | 'vel' | 'limits'

interface ParamNodeData extends Record<string, unknown> {
  category: NodeCategory
  title: string
  subtitle: string
  fields: ParamField[]
  accentColor: string
}

type ParamNode = Node<ParamNodeData>

// ─── Accent colors per category ───────────────────────────────────────────────
const COLORS: Record<NodeCategory, string> = {
  airframe: '#E87020',  // orange  — frame identity
  battery:  '#ECDFCC',  // cream   — power
  att:      '#FFB74D',  // amber   — attitude P loop
  rate:     '#4FC3F7',  // sky     — rate PID loop
  pos:      '#CE93D8',  // purple  — position P loop
  vel:      '#80CBC4',  // teal    — velocity PID loop
  limits:   '#A5D6A7',  // green   — safety bounds
}

// ─── Handle visibility per category ──────────────────────────────────────────
//   source-only: airframe, battery
//   target-only: rate, limits
//   both:        att, pos, vel
const HAS_LEFT_HANDLE:  NodeCategory[] = ['att', 'rate', 'pos', 'vel', 'limits']
const HAS_RIGHT_HANDLE: NodeCategory[] = ['airframe', 'battery', 'att', 'pos', 'vel']

// ─── Custom Node Component ─────────────────────────────────────────────────────

function ParamNodeComponent({ data, selected }: NodeProps<ParamNode>) {
  const { category, title, subtitle, fields, accentColor } = data as ParamNodeData

  const handleStyle = {
    width: 10,
    height: 10,
    background: accentColor,
    border: '2px solid #181C14'
  }

  return (
    <div
      style={{
        minWidth: '190px',
        background: selected ? 'rgba(40,46,34,0.98)' : 'rgba(28,32,22,0.95)',
        border: `1.5px solid ${selected ? accentColor : accentColor + '55'}`,
        borderRadius: '8px',
        boxShadow: selected
          ? `0 0 0 1px ${accentColor}28, 0 8px 24px rgba(0,0,0,0.7)`
          : '0 4px 16px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        transition: 'all 0.15s ease',
        cursor: 'default'
      }}
    >
      {/* Header */}
      <div style={{ padding: '8px 12px 6px', background: `${accentColor}12`, borderBottom: `1px solid ${accentColor}28` }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: accentColor, textTransform: 'uppercase' }}>
          {title}
        </div>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: '9px', color: 'rgba(236,223,204,0.3)', marginTop: '1px' }}>
          {subtitle}
        </div>
      </div>

      {/* Fields preview */}
      <div style={{ padding: '8px 12px' }}>
        {(fields as ParamField[]).slice(0, 4).map((f) => (
          <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: '10px', color: 'rgba(236,223,204,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {f.label}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'rgba(236,223,204,0.85)', background: 'rgba(60,61,55,0.5)', padding: '1px 6px', borderRadius: '3px' }}>
              {typeof f.value === 'number' ? f.value.toFixed(f.step && f.step < 0.01 ? 4 : f.step && f.step < 0.1 ? 3 : 1) : f.value}
              {f.unit ? ` ${f.unit}` : ''}
            </span>
          </div>
        ))}
        {fields.length > 4 && (
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: '9px', color: 'rgba(236,223,204,0.2)', textAlign: 'center', marginTop: '4px' }}>
            +{fields.length - 4} more
          </div>
        )}
      </div>

      {/* Handles */}
      {HAS_LEFT_HANDLE.includes(category) && (
        <Handle type="target" position={Position.Left} style={handleStyle} />
      )}
      {HAS_RIGHT_HANDLE.includes(category) && (
        <Handle type="source" position={Position.Right} style={handleStyle} />
      )}
    </div>
  )
}

const nodeTypes = { param: ParamNodeComponent }

// ─── Initial graph data ────────────────────────────────────────────────────────
//
//  Control architecture (PX4 VTOL):
//
//  [AIRFRAME] ──► [XY POS P] ──► [XY VEL PID] ──► (thrust vec)
//             ──► [Z  POS P] ──► [Z  VEL PID] ──► (throttle)
//             ──► [ATT P ROLL ] ──► [RATE ROLL ] ──► (mixer)
//             ──► [ATT P PITCH] ──► [RATE PITCH]
//             ──► [ATT P YAW  ] ──► [RATE YAW  ]
//  [BATTERY]  ──────────────────────────────────────► [LIMITS]
//

const INITIAL_NODES: ParamNode[] = [
  // ── CONFIG ──────────────────────────────────────────────────────────────────
  {
    id: 'airframe',
    type: 'param',
    position: { x: 60, y: 240 },
    data: {
      category: 'airframe',
      title: 'AIRFRAME',
      subtitle: 'Frame type & mixer',
      accentColor: COLORS.airframe,
      fields: [
        { key: 'SYS_AUTOSTART', label: 'TYPE', value: 'VTOL Tailsitter', type: 'select',
          options: ['Quadrotor X', 'Hexarotor X', 'VTOL Duo Tailsitter', 'VTOL Tiltrotor', 'Octorotor'],
          mavId: 'SYS_AUTOSTART' },
        { key: 'CA_AIRFRAME', label: 'MIXER', value: 4, type: 'number', min: 0, max: 15, mavId: 'CA_AIRFRAME' },
        { key: 'SYS_VEHICLE_RESP', label: 'RESPONSE', value: 0.5, type: 'number', step: 0.05, min: 0, max: 1, mavId: 'SYS_VEHICLE_RESP' },
      ]
    }
  },
  {
    id: 'battery',
    type: 'param',
    position: { x: 60, y: 540 },
    data: {
      category: 'battery',
      title: 'BATTERY',
      subtitle: 'Power configuration',
      accentColor: COLORS.battery,
      fields: [
        { key: 'BAT1_N_CELLS', label: 'CELLS', value: 6, type: 'number', min: 1, max: 14, mavId: 'BAT1_N_CELLS' },
        { key: 'BAT1_CAPACITY', label: 'CAPACITY', value: 16000, type: 'number', unit: 'mAh', mavId: 'BAT1_CAPACITY' },
        { key: 'BAT1_V_FULL', label: 'V FULL', value: 4.2, type: 'number', step: 0.01, unit: 'V', mavId: 'BAT1_V_FULL' },
        { key: 'BAT1_V_EMPTY', label: 'V EMPTY', value: 3.5, type: 'number', step: 0.01, unit: 'V', mavId: 'BAT1_V_EMPTY' },
      ]
    }
  },

  // ── POSITION LOOP (P only) ───────────────────────────────────────────────────
  {
    id: 'xy-pos',
    type: 'param',
    position: { x: 320, y: 60 },
    data: {
      category: 'pos',
      title: 'XY POS CTRL',
      subtitle: 'Horizontal position P loop',
      accentColor: COLORS.pos,
      fields: [
        { key: 'MPC_XY_P', label: 'P', value: 0.95, type: 'number', step: 0.05, min: 0, max: 5, mavId: 'MPC_XY_P' },
        { key: 'MPC_XY_VEL_MAX', label: 'VEL MAX', value: 12, type: 'number', step: 0.5, unit: 'm/s', mavId: 'MPC_XY_VEL_MAX' },
      ]
    }
  },
  {
    id: 'z-pos',
    type: 'param',
    position: { x: 320, y: 290 },
    data: {
      category: 'pos',
      title: 'Z POS CTRL',
      subtitle: 'Altitude P loop',
      accentColor: COLORS.pos,
      fields: [
        { key: 'MPC_Z_P', label: 'P', value: 1.0, type: 'number', step: 0.05, min: 0, max: 5, mavId: 'MPC_Z_P' },
        { key: 'MPC_Z_VEL_MAX_UP', label: 'VEL UP', value: 3.0, type: 'number', step: 0.1, unit: 'm/s', mavId: 'MPC_Z_VEL_MAX_UP' },
        { key: 'MPC_Z_VEL_MAX_DN', label: 'VEL DN', value: 1.0, type: 'number', step: 0.1, unit: 'm/s', mavId: 'MPC_Z_VEL_MAX_DN' },
      ]
    }
  },

  // ── VELOCITY LOOP (PID) ──────────────────────────────────────────────────────
  {
    id: 'xy-vel',
    type: 'param',
    position: { x: 580, y: 60 },
    data: {
      category: 'vel',
      title: 'XY VEL CTRL',
      subtitle: 'Horizontal velocity PID (inner)',
      accentColor: COLORS.vel,
      fields: [
        { key: 'MPC_XY_VEL_P_ACC', label: 'P', value: 1.8, type: 'number', step: 0.05, min: 0, max: 20, mavId: 'MPC_XY_VEL_P_ACC' },
        { key: 'MPC_XY_VEL_I_ACC', label: 'I', value: 0.4, type: 'number', step: 0.01, min: 0, max: 20, mavId: 'MPC_XY_VEL_I_ACC' },
        { key: 'MPC_XY_VEL_D_ACC', label: 'D', value: 0.2, type: 'number', step: 0.005, min: 0, max: 5,  mavId: 'MPC_XY_VEL_D_ACC' },
        { key: 'MPC_ACC_HOR',      label: 'ACC MAX', value: 3.0, type: 'number', step: 0.1, unit: 'm/s²', mavId: 'MPC_ACC_HOR' },
      ]
    }
  },
  {
    id: 'z-vel',
    type: 'param',
    position: { x: 580, y: 290 },
    data: {
      category: 'vel',
      title: 'Z VEL CTRL',
      subtitle: 'Vertical velocity PID (inner)',
      accentColor: COLORS.vel,
      fields: [
        { key: 'MPC_Z_VEL_P_ACC', label: 'P', value: 4.0, type: 'number', step: 0.1, min: 0, max: 20, mavId: 'MPC_Z_VEL_P_ACC' },
        { key: 'MPC_Z_VEL_I_ACC', label: 'I', value: 2.0, type: 'number', step: 0.1, min: 0, max: 20, mavId: 'MPC_Z_VEL_I_ACC' },
        { key: 'MPC_Z_VEL_D_ACC', label: 'D', value: 0.0, type: 'number', step: 0.01, min: 0, max: 5,  mavId: 'MPC_Z_VEL_D_ACC' },
        { key: 'MPC_THR_HOVER',   label: 'THR HOVER', value: 0.5, type: 'number', step: 0.01, min: 0.1, max: 0.9, mavId: 'MPC_THR_HOVER' },
      ]
    }
  },

  // ── ATTITUDE LOOP (P only, per axis) ─────────────────────────────────────────
  {
    id: 'att-roll',
    type: 'param',
    position: { x: 840, y: 60 },
    data: {
      category: 'att',
      title: 'ATT P ROLL',
      subtitle: 'Roll attitude P (outer)',
      accentColor: COLORS.att,
      fields: [
        { key: 'MC_ROLL_P', label: 'P', value: 6.5, type: 'number', step: 0.1, min: 0, max: 20, mavId: 'MC_ROLL_P' },
      ]
    }
  },
  {
    id: 'att-pitch',
    type: 'param',
    position: { x: 840, y: 280 },
    data: {
      category: 'att',
      title: 'ATT P PITCH',
      subtitle: 'Pitch attitude P (outer)',
      accentColor: COLORS.att,
      fields: [
        { key: 'MC_PITCH_P', label: 'P', value: 6.5, type: 'number', step: 0.1, min: 0, max: 20, mavId: 'MC_PITCH_P' },
      ]
    }
  },
  {
    id: 'att-yaw',
    type: 'param',
    position: { x: 840, y: 500 },
    data: {
      category: 'att',
      title: 'ATT P YAW',
      subtitle: 'Yaw attitude P (outer)',
      accentColor: COLORS.att,
      fields: [
        { key: 'MC_YAW_P',      label: 'P',     value: 2.8, type: 'number', step: 0.1,  min: 0, max: 10, mavId: 'MC_YAW_P' },
        { key: 'MC_YAW_WEIGHT', label: 'YAW W', value: 0.4, type: 'number', step: 0.05, min: 0, max: 1,  mavId: 'MC_YAW_WEIGHT' },
      ]
    }
  },

  // ── RATE LOOP (PID) ──────────────────────────────────────────────────────────
  {
    id: 'rate-roll',
    type: 'param',
    position: { x: 1100, y: 60 },
    data: {
      category: 'rate',
      title: 'RATE ROLL',
      subtitle: 'Roll rate PID (inner)',
      accentColor: COLORS.rate,
      fields: [
        { key: 'MC_ROLLRATE_P', label: 'P', value: 0.15, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_ROLLRATE_P' },
        { key: 'MC_ROLLRATE_I', label: 'I', value: 0.20, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_ROLLRATE_I' },
        { key: 'MC_ROLLRATE_D', label: 'D', value: 0.003, type: 'number', step: 0.0001, min: 0, max: 1, mavId: 'MC_ROLLRATE_D' },
        { key: 'MC_ROLLRATE_FF', label: 'FF', value: 0.0, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_ROLLRATE_FF' },
      ]
    }
  },
  {
    id: 'rate-pitch',
    type: 'param',
    position: { x: 1100, y: 280 },
    data: {
      category: 'rate',
      title: 'RATE PITCH',
      subtitle: 'Pitch rate PID (inner)',
      accentColor: COLORS.rate,
      fields: [
        { key: 'MC_PITCHRATE_P', label: 'P', value: 0.15, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_PITCHRATE_P' },
        { key: 'MC_PITCHRATE_I', label: 'I', value: 0.20, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_PITCHRATE_I' },
        { key: 'MC_PITCHRATE_D', label: 'D', value: 0.003, type: 'number', step: 0.0001, min: 0, max: 1, mavId: 'MC_PITCHRATE_D' },
        { key: 'MC_PITCHRATE_FF', label: 'FF', value: 0.0, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_PITCHRATE_FF' },
      ]
    }
  },
  {
    id: 'rate-yaw',
    type: 'param',
    position: { x: 1100, y: 500 },
    data: {
      category: 'rate',
      title: 'RATE YAW',
      subtitle: 'Yaw rate PID (inner)',
      accentColor: COLORS.rate,
      fields: [
        { key: 'MC_YAWRATE_P', label: 'P', value: 0.20, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_YAWRATE_P' },
        { key: 'MC_YAWRATE_I', label: 'I', value: 0.10, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_YAWRATE_I' },
        { key: 'MC_YAWRATE_D', label: 'D', value: 0.0,  type: 'number', step: 0.0001, min: 0, max: 1, mavId: 'MC_YAWRATE_D' },
        { key: 'MC_YAWRATE_FF', label: 'FF', value: 0.0, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_YAWRATE_FF' },
      ]
    }
  },

  // ── LIMITS ───────────────────────────────────────────────────────────────────
  {
    id: 'limits',
    type: 'param',
    position: { x: 1370, y: 290 },
    data: {
      category: 'limits',
      title: 'LIMITS',
      subtitle: 'Rate & angle limits',
      accentColor: COLORS.limits,
      fields: [
        { key: 'MC_ROLLRATE_MAX',  label: 'ROLL MAX',  value: 220, type: 'number', unit: '°/s', mavId: 'MC_ROLLRATE_MAX' },
        { key: 'MC_PITCHRATE_MAX', label: 'PITCH MAX', value: 220, type: 'number', unit: '°/s', mavId: 'MC_PITCHRATE_MAX' },
        { key: 'MC_YAWRATE_MAX',   label: 'YAW MAX',   value: 200, type: 'number', unit: '°/s', mavId: 'MC_YAWRATE_MAX' },
        { key: 'MPC_TILTMAX_AIR',  label: 'TILT MAX',  value: 45,  type: 'number', unit: '°',   mavId: 'MPC_TILTMAX_AIR' },
        { key: 'MPC_VEL_MANUAL',   label: 'VEL MANUAL', value: 10, type: 'number', unit: 'm/s', mavId: 'MPC_VEL_MANUAL' },
      ]
    }
  },
]

const EDGE_STYLE_AF = { stroke: COLORS.airframe + 'AA', strokeWidth: 1.5 }
const EDGE_STYLE_POS = { stroke: COLORS.pos + 'AA', strokeWidth: 1.5 }
const EDGE_STYLE_ATT = { stroke: COLORS.att + 'AA', strokeWidth: 1.5 }
const EDGE_STYLE_BAT = { stroke: COLORS.battery + '66', strokeWidth: 1.5 }

const INITIAL_EDGES: Edge[] = [
  // Airframe → position
  { id: 'af-xypos', source: 'airframe', target: 'xy-pos', style: EDGE_STYLE_AF },
  { id: 'af-zpos',  source: 'airframe', target: 'z-pos',  style: EDGE_STYLE_AF },
  // Airframe → attitude (per axis)
  { id: 'af-att-roll',  source: 'airframe', target: 'att-roll',  style: EDGE_STYLE_AF },
  { id: 'af-att-pitch', source: 'airframe', target: 'att-pitch', style: EDGE_STYLE_AF },
  { id: 'af-att-yaw',   source: 'airframe', target: 'att-yaw',   style: EDGE_STYLE_AF },
  // Position → velocity
  { id: 'xypos-xyvel', source: 'xy-pos', target: 'xy-vel', style: EDGE_STYLE_POS },
  { id: 'zpos-zvel',   source: 'z-pos',  target: 'z-vel',  style: EDGE_STYLE_POS },
  // Attitude P → Rate PID (per axis)
  { id: 'att-roll-rate',  source: 'att-roll',  target: 'rate-roll',  style: EDGE_STYLE_ATT },
  { id: 'att-pitch-rate', source: 'att-pitch', target: 'rate-pitch', style: EDGE_STYLE_ATT },
  { id: 'att-yaw-rate',   source: 'att-yaw',   target: 'rate-yaw',   style: EDGE_STYLE_ATT },
  // Battery → limits
  { id: 'bat-limits', source: 'battery', target: 'limits', style: EDGE_STYLE_BAT },
  // Rate → limits
  { id: 'roll-lim',  source: 'rate-roll',  target: 'limits', style: { stroke: COLORS.rate + '55', strokeWidth: 1 } },
  { id: 'pitch-lim', source: 'rate-pitch', target: 'limits', style: { stroke: COLORS.rate + '55', strokeWidth: 1 } },
  { id: 'yaw-lim',   source: 'rate-yaw',   target: 'limits', style: { stroke: COLORS.rate + '55', strokeWidth: 1 } },
]

// ─── Edit Panel ────────────────────────────────────────────────────────────────

interface EditPanelProps {
  node: ParamNode | null
  onFieldChange: (nodeId: string, fieldKey: string, value: number | string) => void
  onUpload: () => void
  uploading: boolean
  uploadMsg: string | null
}

function EditPanel({ node, onFieldChange, onUpload, uploading, uploadMsg }: EditPanelProps) {
  const mono = "'JetBrains Mono', monospace"
  const grotesk = "'Space Grotesk', sans-serif"
  const border = '1px solid rgba(236,223,204,0.1)'

  if (!node) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', padding: '20px' }}>
        <div style={{ fontFamily: grotesk, fontSize: '12px', color: 'rgba(236,223,204,0.22)', textAlign: 'center', lineHeight: 1.7 }}>
          노드를 클릭하면<br />파라미터를 편집합니다
        </div>
      </div>
    )
  }

  const data = node.data as ParamNodeData

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: border, background: `${data.accentColor}0E` }}>
        <div style={{ fontFamily: mono, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: data.accentColor }}>
          {data.title}
        </div>
        <div style={{ fontFamily: grotesk, fontSize: '10px', color: 'rgba(236,223,204,0.3)', marginTop: '2px' }}>
          {data.subtitle}
        </div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {(data.fields as ParamField[]).map((f) => (
          <div key={f.key} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontFamily: grotesk, fontSize: '10px', fontWeight: 600, color: 'rgba(236,223,204,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {f.label}
              </span>
              {f.mavId && (
                <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.18)', letterSpacing: '0.04em' }}>
                  {f.mavId}
                </span>
              )}
            </div>

            {f.type === 'select' ? (
              <select
                value={f.value as string}
                onChange={(e) => onFieldChange(node.id, f.key, e.target.value)}
                style={{ width: '100%', fontFamily: mono, fontSize: '11px', background: 'rgba(60,61,55,0.6)', border: `1px solid ${data.accentColor}38`, borderRadius: '4px', color: '#ECDFCC', padding: '6px 8px', outline: 'none', cursor: 'pointer' }}
              >
                {f.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  value={f.value as number}
                  min={f.min}
                  max={f.max}
                  step={f.step ?? 1}
                  onChange={(e) => onFieldChange(node.id, f.key, parseFloat(e.target.value))}
                  style={{ flex: 1, fontFamily: mono, fontSize: '12px', background: 'rgba(60,61,55,0.6)', border: `1px solid ${data.accentColor}38`, borderRadius: '4px', color: '#ECDFCC', padding: '6px 8px', outline: 'none' }}
                />
                {f.unit && (
                  <span style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(236,223,204,0.3)', minWidth: '32px' }}>
                    {f.unit}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Upload */}
      <div style={{ padding: '12px 16px', borderTop: border }}>
        {uploadMsg && (
          <div style={{ fontFamily: mono, fontSize: '10px', textAlign: 'center', marginBottom: '8px', color: uploadMsg.startsWith('✓') ? '#A5D6A7' : '#E87020' }}>
            {uploadMsg}
          </div>
        )}
        <button
          onClick={onUpload}
          disabled={uploading}
          style={{ width: '100%', fontFamily: mono, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', padding: '9px', background: uploading ? 'rgba(236,223,204,0.05)' : `${data.accentColor}18`, border: `1px solid ${uploading ? 'rgba(236,223,204,0.12)' : data.accentColor + '55'}`, borderRadius: '5px', color: uploading ? 'rgba(236,223,204,0.25)' : data.accentColor, cursor: uploading ? 'default' : 'pointer', textTransform: 'uppercase', transition: 'all 0.15s ease' }}
        >
          {uploading ? 'UPLOADING...' : `UPLOAD ${data.title}`}
        </button>
      </div>
    </div>
  )
}

// ─── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items: [NodeCategory, string][] = [
    ['airframe', 'Config'],
    ['battery',  'Power'],
    ['pos',      'Position P'],
    ['vel',      'Velocity PID'],
    ['att',      'Attitude P'],
    ['rate',     'Rate PID'],
    ['limits',   'Limits'],
  ]
  return (
    <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, display: 'flex', gap: '10px', flexWrap: 'wrap', maxWidth: 600 }}>
      {items.map(([cat, label]) => (
        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[cat] }} />
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: '9px', color: 'rgba(236,223,204,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── ParameterFlowCanvas ──────────────────────────────────────────────────────

function ParameterFlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ParamNode>(INITIAL_NODES)
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  const onNodeClick = useCallback((_: React.MouseEvent, node: ParamNode) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id))
    setUploadMsg(null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  const handleFieldChange = useCallback(
    (nodeId: string, fieldKey: string, value: number | string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const data = n.data as ParamNodeData
          return {
            ...n,
            data: {
              ...data,
              fields: (data.fields as ParamField[]).map((f) =>
                f.key === fieldKey ? { ...f, value } : f
              )
            }
          }
        })
      )
    },
    [setNodes]
  )

  const handleUpload = useCallback(async () => {
    if (!selectedNode) return
    const data = selectedNode.data as ParamNodeData
    setUploading(true)
    setUploadMsg(null)
    try {
      const fields = data.fields as ParamField[]
      for (const f of fields) {
        if (!f.mavId || typeof f.value !== 'number') continue
        await window.mavlink?.setParam({
          id: f.mavId,
          value: f.value,
          type: 9, // MAV_PARAM_TYPE_REAL32
          index: -1
        })
      }
      setUploadMsg(`✓ ${data.title} uploaded (${fields.filter(f => f.mavId).length} params)`)
    } catch {
      setUploadMsg('✗ Upload failed')
    } finally {
      setUploading(false)
    }
  }, [selectedNode])

  const mono = "'JetBrains Mono', monospace"

  return (
    <div style={{ position: 'absolute', inset: 0, top: '56px', display: 'flex', background: '#181C14' }}>
      {/* Toolbar */}
      <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(236,223,204,0.45)', textTransform: 'uppercase' }}>
          PARAMETER BUILDER
        </span>
        <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.2)', letterSpacing: '0.06em' }}>
          PX4 Control Architecture
        </span>
      </div>

      {/* React Flow canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedNodeId }))}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          style={{ background: '#181C14' }}
          defaultEdgeOptions={{ type: 'smoothstep' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(236,223,204,0.05)" />
          <Controls style={{ background: 'rgba(28,32,22,0.9)', border: '1px solid rgba(236,223,204,0.12)', borderRadius: '6px' }} />
          <MiniMap
            style={{ background: 'rgba(24,28,20,0.9)', border: '1px solid rgba(236,223,204,0.1)' }}
            nodeColor={(n) => (n.data as ParamNodeData)?.accentColor ?? '#3C3D37'}
            maskColor="rgba(24,28,20,0.7)"
          />
        </ReactFlow>
        <Legend />
      </div>

      {/* Right edit panel */}
      <div style={{ width: '270px', flexShrink: 0, background: 'rgba(24,28,20,0.96)', borderLeft: '1px solid rgba(236,223,204,0.08)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column' }}>
        <EditPanel
          node={selectedNode}
          onFieldChange={handleFieldChange}
          onUpload={handleUpload}
          uploading={uploading}
          uploadMsg={uploadMsg}
        />
      </div>
    </div>
  )
}

export function ParameterView() {
  return (
    <ReactFlowProvider>
      <ParameterFlowCanvas />
    </ReactFlowProvider>
  )
}
