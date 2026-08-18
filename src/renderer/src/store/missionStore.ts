import { create } from 'zustand'

// ─── Types (shared with MissionView) ──────────────────────────────────────────
export type DesignMode = 'none' | 'waypoint' | 'survey-polygon'

export type ActionKey =
  | 'VTOL_TAKEOFF'
  | 'WAYPOINT'
  | 'LOITER'
  | 'VTOL_TRANSITION_FW'
  | 'VTOL_TRANSITION_MC'
  | 'VTOL_LAND'
  | 'RTL'

export interface Waypoint {
  uid: number
  action: ActionKey
  lat: number
  lon: number
  alt: number
  acceptRadius: number
  loiterRadius: number
  speed?: number      // m/s — undefined = drone default
  heading?: number    // deg 0~360 — undefined = next-WP direction
  holdTime?: number   // sec at WP — undefined = 0 (pass through)
}

interface MissionStore {
  waypoints: Waypoint[]
  defaultAlt: number
  uidCounter: number
  designMode: DesignMode

  setWaypoints: (wps: Waypoint[] | ((prev: Waypoint[]) => Waypoint[])) => void
  setDefaultAlt: (alt: number) => void
  nextUid: () => number
  clearMission: () => void
  setDesignMode: (mode: DesignMode) => void
  /** [2026-08-18] 저장된 미션 복원. uid 충돌을 막으려 uidCounter 도 함께 올린다. */
  restoreMission: (wps: Waypoint[]) => void
}

export const useMissionStore = create<MissionStore>((set, get) => ({
  waypoints: [],
  defaultAlt: 50,
  uidCounter: 1,
  designMode: 'none',

  setWaypoints: (wps) =>
    set((state) => ({
      waypoints: typeof wps === 'function' ? wps(state.waypoints) : wps
    })),

  setDefaultAlt: (alt) => set({ defaultAlt: alt }),

  nextUid: () => {
    const uid = get().uidCounter
    set({ uidCounter: uid + 1 })
    return uid
  },

  clearMission: () => set({ waypoints: [], uidCounter: 1, designMode: 'none' }),

  setDesignMode: (mode) => set({ designMode: mode }),

  restoreMission: (wps) =>
    set({
      waypoints: wps,
      // 복원된 uid 최대값 다음부터 발급 — 안 그러면 새 WP 가 기존 uid 와 겹쳐
      // 드래그/삭제가 엉뚱한 웨이포인트에 적용된다.
      uidCounter: wps.reduce((m, w) => Math.max(m, w.uid ?? 0), 0) + 1
    })
}))
