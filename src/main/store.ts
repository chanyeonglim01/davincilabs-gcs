/**
 * Electron Store Configuration
 * Persistent storage for app settings
 */

import Store from 'electron-store'
import type { ConnectionConfig } from '../renderer/src/types'

interface StoreSchema {
  connection: ConnectionConfig
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
      port: 14550,       // GCS listens here (Simulink sends to 14550)
      remotePort: 14551, // GCS sends here (Simulink listens on 14551)
      sysid: 1,
      compid: 1
    },
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
