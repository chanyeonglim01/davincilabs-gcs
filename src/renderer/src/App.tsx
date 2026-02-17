import { useMavlink } from './hooks/useMavlink'
import { MapOverlay } from './components/MapOverlay'
import './assets/gcs.css'

function App(): React.JSX.Element {
  useMavlink()

  return (
    <div className="app-container">
      <MapOverlay />
    </div>
  )
}

export default App
