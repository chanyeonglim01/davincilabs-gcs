/**
 * Electron Store Configuration
 * Persistent storage for app settings
 */

import Store from 'electron-store'
import type { ConnectionConfig } from '../renderer/src/types'
import type { MissionWaypoint } from './mavlink/mission'

/**
 * [2026-08-18] 마지막으로 업로드한 미션.
 *  Mission Planner / QGC 처럼 "직전 미션"을 GCS 가 기억해 재시작 후 되살린다.
 *  업로드에 넘긴 페이로드를 **그대로** 보관한다(렌더러 Waypoint 는 uid 등 여분 필드를
 *  갖지만 구조적 복제로 함께 넘어오므로, 원본 그대로 저장해야 복원 시 손실이 없다).
 *  ⚠보드 영속화는 아님 — 보드는 재부팅 시 미션을 잃는다. 그건 별건(보드 수정 필요).
 */
export interface PersistedMission {
  waypoints: (MissionWaypoint & { uid?: number })[]
  count: number
  savedAt: number
}

interface StoreSchema {
  connection: ConnectionConfig
  lastMission: PersistedMission | null
  recentFiles: string[]
  windowBounds: {
    width: number
    height: number
    x?: number
    y?: number
  }
}

export const store = new Store<StoreSchema>({
  defaults: {
    connection: {
      mode: 'simulink',
      host: '127.0.0.1',
      port: 14560, // GCS listens here (Simulink sends to 14560) — 14550 좀비 SITL 회피
      remotePort: 14561, // GCS sends here (Simulink listens on 14561)
      sysid: 1,
      compid: 1
    },
    lastMission: null,
    recentFiles: [],
    windowBounds: {
      width: 1440,
      height: 900
    }
  }
})

/**
 * Get connection configuration
 */
export function getConnectionConfig(): ConnectionConfig {
  return store.get('connection')
}

/**
 * Set connection configuration
 */
export function setConnectionConfig(config: ConnectionConfig): void {
  store.set('connection', config)
}

/**
 * Get window bounds
 */
export function getWindowBounds(): StoreSchema['windowBounds'] {
  return store.get('windowBounds')
}

/**
 * Set window bounds
 */
export function setWindowBounds(bounds: StoreSchema['windowBounds']): void {
  store.set('windowBounds', bounds)
}

/**
 * 마지막 업로드 미션 조회 (없으면 null)
 */
export function getLastMission(): PersistedMission | null {
  return store.get('lastMission') ?? null
}

/**
 * 마지막 업로드 미션 저장. 업로드가 **성공**했을 때만 부른다 —
 * 실패한 업로드를 기억하면 다음 실행에서 기체에 없는 미션을 있는 것처럼 보여준다.
 */
export function setLastMission(mission: PersistedMission | null): void {
  store.set('lastMission', mission)
}
