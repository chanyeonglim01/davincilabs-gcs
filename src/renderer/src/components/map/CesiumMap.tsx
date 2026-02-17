import { useEffect, useRef } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

// Set Cesium Ion default token (public token for testing)
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg0NTE4Mn0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk'

export function CesiumMap(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const entityRef = useRef<Cesium.Entity | null>(null)

  const telemetry = useTelemetryStore((state) => state.telemetry)
  const history = useTelemetryStore((state) => state.history)

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const viewer = new Cesium.Viewer(containerRef.current, {
      terrainProvider: Cesium.createWorldTerrain(),
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
      shouldAnimate: true
    })

    // Set initial camera position (Seoul, South Korea as default)
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(126.978, 37.5665, 5000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0
      }
    })

    // Enable lighting
    viewer.scene.globe.enableLighting = true

    viewerRef.current = viewer

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

    // Skip if position is invalid
    if (lat === 0 && lon === 0) return

    const position = Cesium.Cartesian3.fromDegrees(lon, lat, relative_alt)

    if (!entityRef.current) {
      // Create drone entity
      entityRef.current = viewerRef.current.entities.add({
        name: 'Drone',
        position: position,
        billboard: {
          image: createDroneIcon(heading),
          width: 32,
          height: 32,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
        },
        label: {
          text: `ALT: ${relative_alt.toFixed(0)}m`,
          font: '12px sans-serif',
          fillColor: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -40),
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
        }
      })

      // Fly to drone position on first update
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
      // Update position
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

    // Remove old path entity
    const oldPath = viewer.entities.getById('path')
    if (oldPath) {
      viewer.entities.remove(oldPath)
    }

    // Create new path from history
    const positions = history
      .filter((t) => t.position.lat !== 0 && t.position.lon !== 0)
      .map((t) =>
        Cesium.Cartesian3.fromDegrees(
          t.position.lon,
          t.position.lat,
          t.position.relative_alt
        )
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

  return (
    <div ref={containerRef} className="w-full h-full bg-black" />
  )
}

// Helper function to create drone icon with heading rotation
function createDroneIcon(heading: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')

  if (!ctx) return ''

  // Translate to center and rotate
  ctx.translate(16, 16)
  ctx.rotate((heading * Math.PI) / 180)

  // Draw drone shape (simple triangle pointing up)
  ctx.fillStyle = '#00BFFF' // Electric Blue
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 2

  ctx.beginPath()
  ctx.moveTo(0, -12) // Top point
  ctx.lineTo(-8, 8) // Bottom left
  ctx.lineTo(8, 8) // Bottom right
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Draw center dot
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(0, 0, 3, 0, 2 * Math.PI)
  ctx.fill()

  return canvas.toDataURL()
}
