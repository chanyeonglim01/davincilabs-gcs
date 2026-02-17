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
  mavId?: string // PX4/MAVLink parameter ID
}

interface ParamNodeData extends Record<string, unknown> {
  category: 'airframe' | 'battery' | 'pid' | 'limits'
  title: string
  subtitle: string
  fields: ParamField[]
  accentColor: string
}

type ParamNode = Node<ParamNodeData>

// ─── Node accent colors (category) ────────────────────────────────────────────
const COLORS = {
  airframe: '#E87020',   // orange — frame identity
  battery:  '#ECDFCC',   // cream — power
  pid:      '#4FC3F7',   // sky blue — control loops
  limits:   '#A5D6A7'    // green — safety bounds
}

// ─── Custom Node Component ─────────────────────────────────────────────────────

function ParamNodeComponent({ data, selected }: NodeProps<ParamNode>) {
  const { category, title, subtitle, fields, accentColor } = data as ParamNodeData

  return (
    <div
      style={{
        minWidth: '180px',
        background: selected
          ? 'rgba(40, 46, 34, 0.98)'
          : 'rgba(28, 32, 22, 0.95)',
        border: `1.5px solid ${selected ? accentColor : accentColor + '60'}`,
        borderRadius: '8px',
        boxShadow: selected
          ? `0 0 0 1px ${accentColor}30, 0 8px 24px rgba(0,0,0,0.7)`
          : '0 4px 16px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        transition: 'all 0.15s ease',
        cursor: 'default'
      }}
    >
      {/* Node header */}
      <div
        style={{
          padding: '8px 12px 6px',
          background: `${accentColor}14`,
          borderBottom: `1px solid ${accentColor}30`
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: accentColor,
            textTransform: 'uppercase'
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '9px',
            color: 'rgba(236,223,204,0.35)',
            marginTop: '1px'
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* Fields preview */}
      <div style={{ padding: '8px 12px' }}>
        {fields.slice(0, 4).map((f) => (
          <div
            key={f.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '3px'
            }}
          >
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '10px',
                color: 'rgba(236,223,204,0.45)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {f.label}
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                color: 'rgba(236,223,204,0.85)',
                background: 'rgba(60,61,55,0.5)',
                padding: '1px 6px',
                borderRadius: '3px'
              }}
            >
              {typeof f.value === 'number' ? f.value.toFixed(f.step && f.step < 0.1 ? 3 : 1) : f.value}
              {f.unit ? ` ${f.unit}` : ''}
            </span>
          </div>
        ))}
        {fields.length > 4 && (
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '9px',
              color: 'rgba(236,223,204,0.25)',
              textAlign: 'center',
              marginTop: '4px'
            }}
          >
            +{fields.length - 4} more
          </div>
        )}
      </div>

      {/* Handles */}
      {category !== 'airframe' && category !== 'battery' && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            width: 10,
            height: 10,
            background: accentColor,
            border: '2px solid #181C14'
          }}
        />
      )}
      {(category === 'airframe' || category === 'battery') && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            width: 10,
            height: 10,
            background: accentColor,
            border: '2px solid #181C14'
          }}
        />
      )}
    </div>
  )
}

const nodeTypes = { param: ParamNodeComponent }

// ─── Initial graph data ────────────────────────────────────────────────────────

const INITIAL_NODES: ParamNode[] = [
  {
    id: 'airframe',
    type: 'param',
    position: { x: 60, y: 200 },
    data: {
      category: 'airframe',
      title: 'AIRFRAME',
      subtitle: 'Frame type & mixer',
      accentColor: COLORS.airframe,
      fields: [
        { key: 'SYS_AUTOSTART', label: 'FRAME', value: 'VTOL Duo Tailsitter', type: 'select',
          options: ['Quadrotor X', 'Hexarotor X', 'VTOL Duo Tailsitter', 'VTOL Tiltrotor', 'Octorotor'],
          mavId: 'SYS_AUTOSTART' },
        { key: 'CA_AIRFRAME', label: 'MIXER', value: 4, type: 'number', mavId: 'CA_AIRFRAME' }
      ]
    }
  },
  {
    id: 'battery',
    type: 'param',
    position: { x: 60, y: 420 },
    data: {
      category: 'battery',
      title: 'BATTERY',
      subtitle: 'Power configuration',
      accentColor: COLORS.battery,
      fields: [
        { key: 'BAT1_N_CELLS', label: 'CELLS', value: 6, type: 'number', min: 1, max: 14, mavId: 'BAT1_N_CELLS' },
        { key: 'BAT1_CAPACITY', label: 'CAPACITY', value: 16000, type: 'number', unit: 'mAh', mavId: 'BAT1_CAPACITY' },
        { key: 'BAT1_V_FULL', label: 'V_FULL', value: 4.2, type: 'number', step: 0.01, unit: 'V', mavId: 'BAT1_V_FULL' },
        { key: 'BAT1_V_EMPTY', label: 'V_EMPTY', value: 3.5, type: 'number', step: 0.01, unit: 'V', mavId: 'BAT1_V_EMPTY' }
      ]
    }
  },
  {
    id: 'pid-roll',
    type: 'param',
    position: { x: 360, y: 60 },
    data: {
      category: 'pid',
      title: 'PID ROLL',
      subtitle: 'Roll rate controller',
      accentColor: COLORS.pid,
      fields: [
        { key: 'MC_ROLLRATE_P', label: 'P', value: 0.15, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_ROLLRATE_P' },
        { key: 'MC_ROLLRATE_I', label: 'I', value: 0.20, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_ROLLRATE_I' },
        { key: 'MC_ROLLRATE_D', label: 'D', value: 0.003, type: 'number', step: 0.0001, min: 0, max: 1, mavId: 'MC_ROLLRATE_D' },
        { key: 'MC_ROLL_P', label: 'ATT P', value: 6.5, type: 'number', step: 0.1, min: 0, max: 20, mavId: 'MC_ROLL_P' }
      ]
    }
  },
  {
    id: 'pid-pitch',
    type: 'param',
    position: { x: 360, y: 240 },
    data: {
      category: 'pid',
      title: 'PID PITCH',
      subtitle: 'Pitch rate controller',
      accentColor: COLORS.pid,
      fields: [
        { key: 'MC_PITCHRATE_P', label: 'P', value: 0.15, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_PITCHRATE_P' },
        { key: 'MC_PITCHRATE_I', label: 'I', value: 0.20, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_PITCHRATE_I' },
        { key: 'MC_PITCHRATE_D', label: 'D', value: 0.003, type: 'number', step: 0.0001, min: 0, max: 1, mavId: 'MC_PITCHRATE_D' },
        { key: 'MC_PITCH_P', label: 'ATT P', value: 6.5, type: 'number', step: 0.1, min: 0, max: 20, mavId: 'MC_PITCH_P' }
      ]
    }
  },
  {
    id: 'pid-yaw',
    type: 'param',
    position: { x: 360, y: 420 },
    data: {
      category: 'pid',
      title: 'PID YAW',
      subtitle: 'Yaw rate controller',
      accentColor: COLORS.pid,
      fields: [
        { key: 'MC_YAWRATE_P', label: 'P', value: 0.20, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_YAWRATE_P' },
        { key: 'MC_YAWRATE_I', label: 'I', value: 0.10, type: 'number', step: 0.001, min: 0, max: 5, mavId: 'MC_YAWRATE_I' },
        { key: 'MC_YAWRATE_D', label: 'D', value: 0.0, type: 'number', step: 0.0001, min: 0, max: 1, mavId: 'MC_YAWRATE_D' },
        { key: 'MC_YAW_P', label: 'ATT P', value: 2.8, type: 'number', step: 0.1, min: 0, max: 10, mavId: 'MC_YAW_P' }
      ]
    }
  },
  {
    id: 'limits',
    type: 'param',
    position: { x: 360, y: 600 },
    data: {
      category: 'limits',
      title: 'LIMITS',
      subtitle: 'Rate & angle limits',
      accentColor: COLORS.limits,
      fields: [
        { key: 'MC_ROLLRATE_MAX', label: 'ROLL MAX', value: 220, type: 'number', unit: '°/s', mavId: 'MC_ROLLRATE_MAX' },
        { key: 'MC_PITCHRATE_MAX', label: 'PITCH MAX', value: 220, type: 'number', unit: '°/s', mavId: 'MC_PITCHRATE_MAX' },
        { key: 'MC_YAWRATE_MAX', label: 'YAW MAX', value: 200, type: 'number', unit: '°/s', mavId: 'MC_YAWRATE_MAX' },
        { key: 'MPC_TILTMAX_AIR', label: 'TILT MAX', value: 45, type: 'number', unit: '°', mavId: 'MPC_TILTMAX_AIR' },
        { key: 'MPC_VEL_MANUAL', label: 'VEL MAX', value: 10, type: 'number', unit: 'm/s', mavId: 'MPC_VEL_MANUAL' }
      ]
    }
  }
]

const INITIAL_EDGES: Edge[] = [
  {
    id: 'af-roll',
    source: 'airframe',
    target: 'pid-roll',
    style: { stroke: COLORS.airframe, strokeWidth: 1.5, opacity: 0.6 },
    animated: false
  },
  {
    id: 'af-pitch',
    source: 'airframe',
    target: 'pid-pitch',
    style: { stroke: COLORS.airframe, strokeWidth: 1.5, opacity: 0.6 }
  },
  {
    id: 'af-yaw',
    source: 'airframe',
    target: 'pid-yaw',
    style: { stroke: COLORS.airframe, strokeWidth: 1.5, opacity: 0.6 }
  },
  {
    id: 'af-limits',
    source: 'airframe',
    target: 'limits',
    style: { stroke: COLORS.airframe, strokeWidth: 1.5, opacity: 0.6 }
  },
  {
    id: 'bat-limits',
    source: 'battery',
    target: 'limits',
    style: { stroke: COLORS.battery, strokeWidth: 1.5, opacity: 0.45 }
  }
]

// ─── Edit Panel ────────────────────────────────────────────────────────────────

interface EditPanelProps {
  node: ParamNode | null
  onFieldChange: (nodeId: string, fieldKey: string, value: number | string) => void
  onUpload: () => void
  uploading: boolean
}

function EditPanel({ node, onFieldChange, onUpload, uploading }: EditPanelProps) {
  const mono = "'JetBrains Mono', monospace"
  const grotesk = "'Space Grotesk', sans-serif"
  const border = '1px solid rgba(236,223,204,0.1)'

  if (!node) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '8px',
          padding: '20px'
        }}
      >
        <div
          style={{
            fontFamily: grotesk,
            fontSize: '12px',
            color: 'rgba(236,223,204,0.25)',
            textAlign: 'center',
            lineHeight: 1.6
          }}
        >
          노드를 클릭하면
          <br />
          파라미터를 편집합니다
        </div>
      </div>
    )
  }

  const data = node.data as ParamNodeData

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Edit panel header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: border,
          background: `${data.accentColor}10`
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: data.accentColor
          }}
        >
          {data.title}
        </div>
        <div
          style={{
            fontFamily: grotesk,
            fontSize: '10px',
            color: 'rgba(236,223,204,0.35)',
            marginTop: '2px'
          }}
        >
          {data.subtitle}
        </div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {(data.fields as ParamField[]).map((f) => (
          <div key={f.key} style={{ marginBottom: '14px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px'
              }}
            >
              <span
                style={{
                  fontFamily: grotesk,
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'rgba(236,223,204,0.55)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                {f.label}
              </span>
              {f.mavId && (
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: '9px',
                    color: 'rgba(236,223,204,0.2)',
                    letterSpacing: '0.04em'
                  }}
                >
                  {f.mavId}
                </span>
              )}
            </div>

            {f.type === 'select' ? (
              <select
                value={f.value as string}
                onChange={(e) => onFieldChange(node.id, f.key, e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: mono,
                  fontSize: '11px',
                  background: 'rgba(60,61,55,0.6)',
                  border: `1px solid ${data.accentColor}40`,
                  borderRadius: '4px',
                  color: '#ECDFCC',
                  padding: '6px 8px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {f.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
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
                  style={{
                    flex: 1,
                    fontFamily: mono,
                    fontSize: '12px',
                    background: 'rgba(60,61,55,0.6)',
                    border: `1px solid ${data.accentColor}40`,
                    borderRadius: '4px',
                    color: '#ECDFCC',
                    padding: '6px 8px',
                    outline: 'none'
                  }}
                />
                {f.unit && (
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: '10px',
                      color: 'rgba(236,223,204,0.35)',
                      minWidth: '28px'
                    }}
                  >
                    {f.unit}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Upload button */}
      <div style={{ padding: '12px 16px', borderTop: border }}>
        <button
          onClick={onUpload}
          disabled={uploading}
          style={{
            width: '100%',
            fontFamily: mono,
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '9px',
            background: uploading
              ? 'rgba(236,223,204,0.06)'
              : `${data.accentColor}18`,
            border: `1px solid ${uploading ? 'rgba(236,223,204,0.15)' : data.accentColor + '60'}`,
            borderRadius: '5px',
            color: uploading ? 'rgba(236,223,204,0.3)' : data.accentColor,
            cursor: uploading ? 'default' : 'pointer',
            textTransform: 'uppercase',
            transition: 'all 0.15s ease'
          }}
        >
          {uploading ? 'UPLOADING...' : `UPLOAD ${data.title}`}
        </button>
      </div>
    </div>
  )
}

// ─── ParameterView (main) ──────────────────────────────────────────────────────

function ParameterFlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ParamNode>(INITIAL_NODES)
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  const onNodeClick = useCallback((_: React.MouseEvent, node: ParamNode) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id))
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
        if (!f.mavId) continue
        await window.mavlink?.setParam({
          id: f.mavId,
          value: typeof f.value === 'number' ? f.value : 0,
          type: 9, // MAV_PARAM_TYPE_REAL32
          index: -1 // use name-based lookup
        })
      }
      setUploadMsg(`✓ ${data.title} uploaded`)
    } catch (e) {
      setUploadMsg('✗ Upload failed')
    } finally {
      setUploading(false)
    }
  }, [selectedNode])

  const mono = "'JetBrains Mono', monospace"

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        top: '56px',
        display: 'flex',
        background: '#181C14'
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 10,
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}
      >
        <span
          style={{
            fontFamily: mono,
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'rgba(236,223,204,0.5)',
            textTransform: 'uppercase'
          }}
        >
          PARAMETER BUILDER
        </span>
        {uploadMsg && (
          <span
            style={{
              fontFamily: mono,
              fontSize: '10px',
              color: uploadMsg.startsWith('✓') ? '#A5D6A7' : '#E87020',
              background: 'rgba(24,28,20,0.9)',
              padding: '3px 10px',
              borderRadius: '4px',
              border: '1px solid rgba(236,223,204,0.1)'
            }}
          >
            {uploadMsg}
          </span>
        )}
      </div>

      {/* React Flow canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedNodeId }))}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          style={{ background: '#181C14' }}
          defaultEdgeOptions={{
            type: 'smoothstep'
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgba(236,223,204,0.06)"
          />
          <Controls
            style={{
              background: 'rgba(28,32,22,0.9)',
              border: '1px solid rgba(236,223,204,0.15)',
              borderRadius: '6px'
            }}
          />
          <MiniMap
            style={{
              background: 'rgba(24,28,20,0.9)',
              border: '1px solid rgba(236,223,204,0.12)'
            }}
            nodeColor={(n) => {
              const d = n.data as ParamNodeData
              return d?.accentColor ?? '#3C3D37'
            }}
            maskColor="rgba(24,28,20,0.7)"
          />
        </ReactFlow>
      </div>

      {/* Right edit panel */}
      <div
        style={{
          width: '260px',
          flexShrink: 0,
          background: 'rgba(24,28,20,0.95)',
          borderLeft: '1px solid rgba(236,223,204,0.1)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <EditPanel
          node={selectedNode}
          onFieldChange={handleFieldChange}
          onUpload={handleUpload}
          uploading={uploading}
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
