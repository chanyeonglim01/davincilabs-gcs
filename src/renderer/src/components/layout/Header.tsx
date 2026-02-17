import { useTelemetryStore } from '@renderer/store/telemetryStore'
import logoImage from '@renderer/assets/images/davincilabs.png'

export function Header() {
  const connection = useTelemetryStore((state) => state.connection)

  return (
    <header className="h-12 border-b border-border bg-surface px-4 flex items-center justify-between">
      {/* Left - Logo */}
      <div className="flex items-center gap-3">
        <img src={logoImage} alt="Davinci Labs" className="h-6 brightness-0 invert" />
        <div className="h-4 w-px bg-border" />
        <span className="text-sm font-medium text-text-secondary">GCS</span>
      </div>

      {/* Center - Title */}
      <div className="flex-1 text-center">
        <h2 className="text-sm font-medium text-text-secondary tracking-wide">
          Advanced Air Mobility Ground Control System
        </h2>
      </div>

      {/* Right - Connection Status + Port */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${connection.connected ? 'bg-secondary animate-pulse' : 'bg-danger'}`}
          />
          <span className="text-xs font-medium text-foreground">
            {connection.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">Port:</span>
          <select className="bg-surface-elevated text-foreground text-xs px-2 py-1 rounded border border-border hover:border-border-hover transition-colors">
            <option>COM3 / USB</option>
            <option>UDP 14551</option>
          </select>
        </div>
      </div>
    </header>
  )
}
