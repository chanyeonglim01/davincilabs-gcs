import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { ShieldCheck, Plane, Pause, ArrowDown, AlertTriangle } from 'lucide-react'
import type { Command } from '@renderer/types'

export function CommandButtons() {
  const [confirmDialog, setConfirmDialog] = useState<Command | null>(null)
  const [loading, setLoading] = useState(false)

  const sendCommand = async (cmd: Command) => {
    if (!window.mavlink) {
      console.error('MAVLink API not available')
      setConfirmDialog(null)
      return
    }

    setLoading(true)
    try {
      const result = await window.mavlink.sendCommand(cmd)
      console.log('Command result:', result)
    } catch (error) {
      console.error('Command error:', error)
    } finally {
      setLoading(false)
      setConfirmDialog(null)
    }
  }

  const commands = [
    {
      type: 'ARM' as const,
      label: 'ARM',
      icon: ShieldCheck,
      className: 'bg-primary hover:bg-primary/90'
    },
    {
      type: 'TAKEOFF' as const,
      label: 'TAKEOFF',
      params: { altitude: 10 },
      icon: Plane,
      className: 'bg-secondary hover:bg-secondary/90'
    },
    {
      type: 'HOLD' as const,
      label: 'HOLD',
      icon: Pause,
      className: 'bg-warning hover:bg-warning/90'
    },
    {
      type: 'LAND' as const,
      label: 'LAND',
      icon: ArrowDown,
      className: 'bg-warning hover:bg-warning/90'
    },
    {
      type: 'DISARM' as const,
      label: 'EMERGENCY',
      icon: AlertTriangle,
      className: 'bg-danger hover:bg-danger/90'
    }
  ]

  return (
    <>
      <div className="grid grid-cols-5 gap-3">
        {commands.map((cmd) => {
          const Icon = cmd.icon
          return (
            <Button
              key={cmd.label}
              onClick={() => setConfirmDialog({ type: cmd.type, params: cmd.params })}
              disabled={loading}
              className={`h-12 px-6 font-medium text-sm ${cmd.className}`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {cmd.label}
            </Button>
          )
        })}
      </div>

      {confirmDialog && (
        <Dialog open onOpenChange={() => setConfirmDialog(null)}>
          <DialogContent className="bg-gray-800 text-white border-gray-600">
            <DialogHeader>
              <DialogTitle>Confirm {confirmDialog.type}</DialogTitle>
            </DialogHeader>
            <p className="text-gray-300">
              Are you sure you want to execute {confirmDialog.type}?
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDialog(null)}
                disabled={loading}
                className="bg-gray-700 hover:bg-gray-600 border-gray-600"
              >
                Cancel
              </Button>
              <Button
                onClick={() => sendCommand(confirmDialog)}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500"
              >
                {loading ? 'Sending...' : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
