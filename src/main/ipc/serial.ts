/**
 * Serial Port IPC Handlers
 *
 * Exposes a read-only enumeration of serial devices to the renderer.
 * The actual serial transport is intentionally NOT implemented yet — the
 * GCS still talks UDP/MAVLink. The renderer uses this only to populate the
 * COM port dropdown so that hardware selection UX can be built ahead of the
 * radio/USB transport landing.
 */

import { ipcMain } from 'electron'
import { SerialPort } from 'serialport'
import type { SerialPortInfo } from '../../renderer/src/types'

export function registerSerialHandlers(): void {
  ipcMain.handle('serial:list-ports', async (): Promise<SerialPortInfo[]> => {
    try {
      const ports = await SerialPort.list()
      return ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer,
        serialNumber: p.serialNumber,
        pnpId: p.pnpId,
        vendorId: p.vendorId,
        productId: p.productId,
        // Friendly name for UI: prefer manufacturer + path tail
        friendlyName: buildFriendlyName(p.path, p.manufacturer)
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'serial enumeration failed'
      console.error('[Serial] list error:', message)
      return []
    }
  })
}

function buildFriendlyName(path: string, manufacturer?: string): string {
  // On macOS paths look like /dev/cu.usbserial-XXXX — pick the trailing token.
  const tail = path.split('/').pop() ?? path
  if (manufacturer && manufacturer.trim().length > 0) {
    return `${tail} (${manufacturer})`
  }
  return tail
}
