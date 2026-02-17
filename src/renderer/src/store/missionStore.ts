import { create } from 'zustand'

// ─── Types (shared with MissionView) ──────────────────────────────────────────
export type ActionKey =
  | 'VTOL_TAKEOFF'
  | 'MC_TAKEOFF'
  | 'FW_TAKEOFF'
  | 'WAYPOINT'
  | 'LOITER'
  | 'VTOL_TRANSITION_FW'
  | 'VTOL_TRANSITION_MC'
  | 'VTOL_LAND'
  | 'MC_LAND'
  | 'FW_LAND'
  | 'RTL'

export interface Waypoint {
  uid: number
  action: ActionKey
  lat: number
  lon: number
  alt: number
  acceptRadius: number
  loiterRadius: number
}

interface MissionStore {
  waypoints: Waypoint[]
  defaultAlt: number
  uidCounter: number

  setWaypoints: (wps: Waypoint[] | ((prev: Waypoint[]) => Waypoint[])) => void
  setDefaultAlt: (alt: number) => void
  nextUid: () => number
  clearMission: () => void
}

export const useMissionStore = create<MissionStore>((set, get) => ({
  waypoints: [],
  defaultAlt: 50,
  uidCounter: 1,

  setWaypoints: (wps) =>
    set((state) => ({
      waypoints: typeof wps === 'function' ? wps(state.waypoints) : wps,
    })),

  setDefaultAlt: (alt) => set({ defaultAlt: alt }),

  nextUid: () => {
    const uid = get().uidCounter
    set({ uidCounter: uid + 1 })
    return uid
  },

  clearMission: () => set({ waypoints: [], uidCounter: 1 }),
}))
