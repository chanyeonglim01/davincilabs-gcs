import './assets/main.css'

// Must be set before Cesium module is first imported (lazy-loaded)
;(window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium'

import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
