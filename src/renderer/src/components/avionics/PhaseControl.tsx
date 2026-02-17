import { Button } from '@renderer/components/ui/button'

export function PhaseControl() {
  const handlePhaseChange = (phase: string) => {
    console.log('Phase changed to:', phase)
    // TODO: Send phase change command via MAVLink
  }

  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <div className="mb-3">
        <h3 className="text-2xl font-bold text-secondary">PHASE: AUTO</h3>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={() => handlePhaseChange('standby')}
          className="h-12 bg-primary hover:bg-primary/90 text-white font-medium"
        >
          Standby
        </Button>
        <Button
          onClick={() => handlePhaseChange('takeoff')}
          className="h-12 bg-primary hover:bg-primary/90 text-white font-medium"
        >
          Take-off
        </Button>
        <Button
          onClick={() => handlePhaseChange('hold')}
          className="h-12 bg-primary hover:bg-primary/90 text-white font-medium"
        >
          Hold
        </Button>
      </div>
    </div>
  )
}
