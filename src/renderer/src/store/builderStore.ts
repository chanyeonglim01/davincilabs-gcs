import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import type { ParamEntry, ParamProgress } from '@renderer/types'

// Data payload stored on each React Flow node
export interface ParamNodeData {
  groupName: string
  params: ParamEntry[]
  [key: string]: unknown // satisfy React Flow Node constraint
}

interface BuilderStore {
  // --- Raw parameters from vehicle ---
  parameters: Record<string, ParamEntry>
  progress: ParamProgress | null
  isLoading: boolean

  // --- Table view ---
  searchQuery: string
  editingId: string | null
  pendingEdits: Record<string, number>

  // --- Flow view ---
  viewMode: 'table' | 'flow'
  nodes: Node<ParamNodeData>[]
  edges: Edge[]

  // --- Actions ---
  setParameter: (param: ParamEntry) => void
  setProgress: (progress: ParamProgress) => void
  setLoading: (loading: boolean) => void
  setSearchQuery: (query: string) => void
  setEditing: (id: string | null) => void
  setPendingEdit: (id: string, value: number) => void
  clearPendingEdit: (id: string) => void
  setViewMode: (mode: 'table' | 'flow') => void
  setNodes: (nodes: Node<ParamNodeData>[]) => void
  setEdges: (edges: Edge[]) => void
  buildFlowGraph: () => void
  clearAll: () => void
}

// PID-related prefix groups for the flow graph
const PID_GROUPS: Record<string, string[]> = {
  'ROLL RATE': ['MC_ROLLRATE_P', 'MC_ROLLRATE_I', 'MC_ROLLRATE_D', 'MC_ROLLRATE_FF'],
  'PITCH RATE': ['MC_PITCHRATE_P', 'MC_PITCHRATE_I', 'MC_PITCHRATE_D', 'MC_PITCHRATE_FF'],
  'YAW RATE': ['MC_YAWRATE_P', 'MC_YAWRATE_I', 'MC_YAWRATE_D', 'MC_YAWRATE_FF'],
  'ROLL ATT': ['MC_ROLL_P'],
  'PITCH ATT': ['MC_PITCH_P'],
  'YAW ATT': ['MC_YAW_P'],
  'VELOCITY XY': ['MPC_XY_VEL_P_ACC', 'MPC_XY_VEL_I_ACC', 'MPC_XY_VEL_D_ACC'],
  'VELOCITY Z': ['MPC_Z_VEL_P_ACC', 'MPC_Z_VEL_I_ACC', 'MPC_Z_VEL_D_ACC'],
  'POSITION XY': ['MPC_XY_P'],
  'POSITION Z': ['MPC_Z_P']
}

function groupParams(params: Record<string, ParamEntry>): Map<string, ParamEntry[]> {
  const groups = new Map<string, ParamEntry[]>()
  const assigned = new Set<string>()

  for (const [groupName, ids] of Object.entries(PID_GROUPS)) {
    const matched = ids
      .map((id) => params[id])
      .filter((p): p is ParamEntry => p !== undefined)
    if (matched.length > 0) {
      groups.set(groupName, matched)
      matched.forEach((p) => assigned.add(p.id))
    }
  }

  // Put unrecognized params in prefix-based groups
  const prefixBuckets = new Map<string, ParamEntry[]>()
  for (const param of Object.values(params)) {
    if (assigned.has(param.id)) continue
    const prefix = param.id.split('_')[0] ?? param.id
    if (!prefixBuckets.has(prefix)) prefixBuckets.set(prefix, [])
    prefixBuckets.get(prefix)!.push(param)
  }
  for (const [prefix, entries] of prefixBuckets) {
    groups.set(prefix, entries.sort((a, b) => a.id.localeCompare(b.id)))
  }

  return groups
}

function buildNodes(groups: Map<string, ParamEntry[]>): Node<ParamNodeData>[] {
  const cols = 3
  const xStep = 280
  const yStep = 220
  let idx = 0

  return Array.from(groups.entries()).map(([groupName, params]) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    idx++
    return {
      id: `group-${groupName}`,
      type: 'paramNode',
      position: { x: 60 + col * xStep, y: 60 + row * yStep },
      data: { groupName, params }
    }
  })
}

export const useBuilderStore = create<BuilderStore>((set, get) => ({
  parameters: {},
  progress: null,
  isLoading: false,
  searchQuery: '',
  editingId: null,
  pendingEdits: {},
  viewMode: 'table',
  nodes: [],
  edges: [],

  setParameter: (param) =>
    set((state) => ({
      parameters: { ...state.parameters, [param.id]: param }
    })),

  setProgress: (progress) => set({ progress }),

  setLoading: (loading) => set({ isLoading: loading }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setEditing: (id) => set({ editingId: id }),

  setPendingEdit: (id, value) =>
    set((state) => ({
      pendingEdits: { ...state.pendingEdits, [id]: value }
    })),

  clearPendingEdit: (id) =>
    set((state) => {
      const next = { ...state.pendingEdits }
      delete next[id]
      return { pendingEdits: next }
    }),

  setViewMode: (mode) => {
    if (mode === 'flow') {
      // Rebuild graph whenever switching to flow view
      get().buildFlowGraph()
    }
    set({ viewMode: mode })
  },

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  buildFlowGraph: () => {
    const { parameters } = get()
    const groups = groupParams(parameters)
    const nodes = buildNodes(groups)
    set({ nodes, edges: [] })
  },

  clearAll: () =>
    set({
      parameters: {},
      progress: null,
      isLoading: false,
      editingId: null,
      pendingEdits: {},
      nodes: [],
      edges: []
    })
}))
