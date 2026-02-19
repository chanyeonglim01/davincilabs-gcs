import { useEffect, useRef, useState } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

export function CesiumMap(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const entityRef = useRef<Cesium.Entity | null>(null)
  const [error, setError] = useState<string | null>(null)

  const telemetry = useTelemetryStore((state) => state.telemetry)
  const history = useTelemetryStore((state) => state.history)

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const container = containerRef.current

    try {
      // Must explicitly set baseLayer — default uses Ion/Bing which requires a token
      const viewer = new Cesium.Viewer(container, {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        shadows: false,
        shouldAnimate: true,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        baseLayer: new Cesium.ImageryLayer(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maximumLevel: 19,
            credit: 'Tiles \u00a9 Esri'
          })
        )
      })

      // Set initial camera position (Seoul, South Korea as default)
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(126.978, 37.5665, 500000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0.0
        }
      })

      viewer.scene.globe.enableLighting = false

      viewerRef.current = viewer

      // Force layout recalculation and render
      setTimeout(() => {
        viewer.forceResize()
        viewer.scene.requestRender()
      }, 300)

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      console.error('[CesiumMap] init error:', e)
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [])

  // Update drone position
  useEffect(() => {
    if (!viewerRef.current || !telemetry) return

    const { lat, lon, relative_alt } = telemetry.position
    const heading = telemetry.heading

    if (lat === 0 && lon === 0) return

    const position = Cesium.Cartesian3.fromDegrees(lon, lat, relative_alt)

    if (!entityRef.current) {
      entityRef.current = viewerRef.current.entities.add({
        name: 'Drone',
        position: position,
        billboard: {
          image: createDroneIcon(heading),
          width: 96,
          height: 112,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
        },
        label: {
          text: `ALT: ${relative_alt.toFixed(0)}m`,
          font: "11px 'JetBrains Mono', monospace",
          fillColor: Cesium.Color.fromCssColorString('#ECDFCC'),
          outlineColor: Cesium.Color.fromCssColorString('#181C14'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -56),
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
        }
      })

      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, relative_alt + 500),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0.0
        },
        duration: 2
      })
    } else {
      entityRef.current.position = new Cesium.ConstantPositionProperty(position)
      if (entityRef.current.billboard) {
        entityRef.current.billboard.image = new Cesium.ConstantProperty(createDroneIcon(heading))
      }
      if (entityRef.current.label) {
        entityRef.current.label.text = new Cesium.ConstantProperty(
          `ALT: ${relative_alt.toFixed(0)}m`
        )
      }
    }
  }, [telemetry])

  // Draw path trail
  useEffect(() => {
    if (!viewerRef.current || history.length < 2) return

    const viewer = viewerRef.current
    const oldPath = viewer.entities.getById('path')
    if (oldPath) viewer.entities.remove(oldPath)

    const positions = history
      .filter((t) => t.position.lat !== 0 && t.position.lon !== 0)
      .map((t) =>
        Cesium.Cartesian3.fromDegrees(t.position.lon, t.position.lat, t.position.relative_alt)
      )

    if (positions.length > 1) {
      viewer.entities.add({
        id: 'path',
        name: 'Flight Path',
        polyline: {
          positions: positions,
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.CYAN
          }),
          clampToGround: false
        }
      })
    }
  }, [history])

  if (error) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#181C14',
        color: '#ECDFCC',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        padding: '20px',
        gap: '8px'
      }}>
        <span style={{ color: 'rgba(236,223,204,0.4)', fontSize: '9px' }}>CESIUM ERROR</span>
        <span style={{ textAlign: 'center', lineHeight: 1.6 }}>{error}</span>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

function createDroneIcon(heading: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="112" viewBox="0 -16 96 112">
    <g transform="rotate(${heading}, 48, 36)">
      <line x1="48" y1="-14" x2="48" y2="20" stroke="#E87020" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="48" cy="52" rx="6" ry="24" fill="#111" fill-opacity="0.5"/>
      <path d="M48 42 L4 60 L5 66 L48 53 L91 66 L92 60 Z" fill="#111" fill-opacity="0.4"/>
      <ellipse cx="48" cy="52" rx="4.5" ry="22" fill="#FFFFFF"/>
      <path d="M48 42 L4 60 L5 65 L48 53 L91 65 L92 60 Z" fill="#FFFFFF" fill-opacity="0.92"/>
      <path d="M48 42 L4 60 L5 62 L48 44 Z" fill="#00CFFF" fill-opacity="0.5"/>
      <path d="M48 42 L92 60 L91 62 L48 44 Z" fill="#00CFFF" fill-opacity="0.5"/>
      <path d="M48 31 L32 37 L32 40 L48 34 L64 40 L64 37 Z" fill="#FFFFFF" fill-opacity="0.75"/>
      <path d="M43 71 L35 84 L38 85 L46 73 Z" fill="#FFFFFF" fill-opacity="0.65"/>
      <path d="M53 71 L61 84 L58 85 L50 73 Z" fill="#FFFFFF" fill-opacity="0.65"/>
      <circle cx="7" cy="61" r="5.5" fill="#1a1a2a" stroke="#FFFFFF" stroke-width="1.5"/>
      <circle cx="89" cy="61" r="5.5" fill="#1a1a2a" stroke="#FFFFFF" stroke-width="1.5"/>
      <circle cx="48" cy="52" r="7" fill="#1a1a2a" stroke="#FFFFFF" stroke-width="1.8"/>
      <circle cx="48" cy="52" r="3" fill="#00CFFF"/>
      <ellipse cx="48" cy="29" rx="3" ry="3.5" fill="#00CFFF"/>
    </g>
  </svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
