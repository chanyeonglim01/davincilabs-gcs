import { CesiumMap } from './CesiumMap'

export function MapView() {
  return (
    <div className="w-full h-full rounded-lg overflow-hidden">
      <CesiumMap />
    </div>
  )
}
