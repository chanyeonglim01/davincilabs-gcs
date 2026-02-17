import { Activity, Map, Settings, Home } from 'lucide-react'
import { useState } from 'react'

export function Sidebar() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <aside className="w-16 bg-surface border-r border-border flex flex-col items-center py-3 gap-2">
      <button
        onClick={() => setActiveTab('home')}
        className={`p-2.5 rounded-lg transition-all ${
          activeTab === 'home'
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
            : 'text-text-secondary hover:text-foreground hover:bg-surface-elevated'
        }`}
      >
        <Home className="w-5 h-5" />
      </button>

      <button
        onClick={() => setActiveTab('telemetry')}
        className={`p-2.5 rounded-lg transition-all ${
          activeTab === 'telemetry'
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
            : 'text-text-secondary hover:text-foreground hover:bg-surface-elevated'
        }`}
      >
        <Activity className="w-5 h-5" />
      </button>

      <button
        onClick={() => setActiveTab('mission')}
        className={`p-2.5 rounded-lg transition-all ${
          activeTab === 'mission'
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
            : 'text-text-secondary hover:text-foreground hover:bg-surface-elevated'
        }`}
      >
        <Map className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      <button
        onClick={() => setActiveTab('settings')}
        className={`p-2.5 rounded-lg transition-all ${
          activeTab === 'settings'
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
            : 'text-text-secondary hover:text-foreground hover:bg-surface-elevated'
        }`}
      >
        <Settings className="w-5 h-5" />
      </button>
    </aside>
  )
}
