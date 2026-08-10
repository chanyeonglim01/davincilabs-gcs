import './assets/main.css'

// Must be set before Cesium module is first imported (lazy-loaded)
;(window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium'

import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { installGlobalErrorReporters, installPerformanceTimelineGuard } from './lib/errorReporting'

// Catch failures that throw outside React's render phase (async callbacks,
// Cesium/Leaflet render loops, rejected promises, lost WebGL contexts).
installGlobalErrorReporters()

// Keep React's dev-build performance.measure() output from filling the renderer.
installPerformanceTimelineGuard()

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
