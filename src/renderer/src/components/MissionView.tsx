import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useMissionStore, ActionKey, Waypoint } from '@renderer/store/missionStore'

// ─── MAVLink command IDs ───────────────────────────────────────────────────────
const MAV_CMD = {
  WAYPOINT:        16,
  LOITER_UNLIM:    17,
  RTL:             20,
  LAND:            21,
  TAKEOFF:         22,
  VTOL_TAKEOFF:    84,
  VTOL_LAND:       85,
  VTOL_TRANSITION: 3000,
} as const

// ─── Action definitions ────────────────────────────────────────────────────────
interface ActionDef {
  label: string
  short: string
  color: string
  mavCmd: number
  hasAlt: boolean
  icon: string
  group: 'vtol' | 'mc' | 'fw' | 'common'
}

const ACTIONS: Record<ActionKey, ActionDef> = {
  VTOL_TAKEOFF:       { label: 'VTOL Takeoff',    short: 'T/O',  color: '#A5D6A7', mavCmd: MAV_CMD.VTOL_TAKEOFF,   hasAlt: true,  icon: '↑', group: 'vtol'   },
  VTOL_TRANSITION_FW: { label: 'Transition → FW', short: '→FW',  color: '#FFB74D', mavCmd: MAV_CMD.VTOL_TRANSITION, hasAlt: false, icon: '⇒', group: 'vtol'   },
  VTOL_TRANSITION_MC: { label: 'Transition → MC', short: '→MC',  color: '#FFB74D', mavCmd: MAV_CMD.VTOL_TRANSITION, hasAlt: false, icon: '⇐', group: 'vtol'   },
  VTOL_LAND:          { label: 'VTOL Land',        short: 'LND',  color: '#E87020', mavCmd: MAV_CMD.VTOL_LAND,      hasAlt: true,  icon: '↓', group: 'vtol'   },
  MC_TAKEOFF:         { label: 'MC Takeoff',       short: 'MC↑',  color: '#80CBC4', mavCmd: MAV_CMD.TAKEOFF,        hasAlt: true,  icon: '↑', group: 'mc'     },
  MC_LAND:            { label: 'MC Land',          short: 'MC↓',  color: '#80CBC4', mavCmd: MAV_CMD.LAND,           hasAlt: false, icon: '↓', group: 'mc'     },
  FW_TAKEOFF:         { label: 'FW Takeoff',       short: 'FW↑',  color: '#CE93D8', mavCmd: MAV_CMD.TAKEOFF,        hasAlt: true,  icon: '↑', group: 'fw'     },
  FW_LAND:            { label: 'FW Land',          short: 'FW↓',  color: '#CE93D8', mavCmd: MAV_CMD.LAND,           hasAlt: false, icon: '↓', group: 'fw'     },
  WAYPOINT:           { label: 'Waypoint',         short: 'WP',   color: '#4FC3F7', mavCmd: MAV_CMD.WAYPOINT,       hasAlt: true,  icon: '●', group: 'common' },
  LOITER:             { label: 'Loiter',           short: 'LTR',  color: '#B39DDB', mavCmd: MAV_CMD.LOITER_UNLIM,   hasAlt: true,  icon: '⟳', group: 'common' },
  RTL:                { label: 'Return to Launch', short: 'RTL',  color: '#FF8A80', mavCmd: MAV_CMD.RTL,            hasAlt: false, icon: '⌂', group: 'common' },
}

const ACTION_KEYS = Object.keys(ACTIONS) as ActionKey[]

const GROUPS: { key: string; label: string }[] = [
  { key: 'vtol', label: 'VTOL' },
  { key: 'mc',   label: 'MC'   },
  { key: 'fw',   label: 'FW'   },
  { key: 'common', label: 'NAV' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────
function haversineM(a: Waypoint, b: Waypoint): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLon / 2)
  const c = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c))
}

function totalDistance(wps: Waypoint[]): number {
  let d = 0
  for (let i = 1; i < wps.length; i++) {
    if (ACTIONS[wps[i].action].hasAlt && ACTIONS[wps[i - 1].action].hasAlt) {
      d += haversineM(wps[i - 1], wps[i])
    }
  }
  return d
}

function altColor(alt: number): string {
  if (alt <= 30)  return '#A5D6A7'
  if (alt <= 120) return '#ECDFCC'
  if (alt <= 400) return '#FFB74D'
  return '#E87020'
}

function markerHtml(seq: number, def: ActionDef): string {
  return `
    <div style="width:32px;height:32px;border-radius:50%;
      background:${def.color}22;border:2px solid ${def.color};
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 10px ${def.color}44;cursor:pointer;">
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:${def.color};line-height:1;">
        ${seq}
      </span>
    </div>`
}

// ─── Style constants ───────────────────────────────────────────────────────────
const mono = "'JetBrains Mono', monospace"
const sans = "'Space Grotesk', sans-serif"
const bg   = 'rgba(24,28,20,0.95)'
const dim  = 'rgba(236,223,204,0.1)'

const miniBtn: React.CSSProperties = {
  fontFamily: mono, fontSize: '10px',
  background: 'transparent', border: `1px solid ${dim}`,
  borderRadius: '3px', color: 'rgba(236,223,204,0.55)',
  padding: '1px 5px', cursor: 'pointer', lineHeight: 1.4,
}

const smallInput: React.CSSProperties = {
  fontFamily: mono, fontSize: '10px',
  background: 'rgba(60,61,55,0.5)', border: '1px solid rgba(236,223,204,0.12)',
  borderRadius: '3px', color: 'rgba(236,223,204,0.8)',
  padding: '3px 6px', outline: 'none',
}

// ─── MissionView ───────────────────────────────────────────────────────────────
export function MissionView() {
  const { waypoints, defaultAlt, setWaypoints, setDefaultAlt, nextUid, clearMission } = useMissionStore()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef          = useRef<L.Map | null>(null)
  const markersRef      = useRef<Map<number, L.Marker>>(new Map())
  const polylineRef     = useRef<L.Polyline | null>(null)

  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [uploading, setUploading]      = useState(false)
  const [uploadMsg, setUploadMsg]      = useState<string | null>(null)

  // ── Drag-to-reorder state ─────────────────────────────────────────────────────
  const dragUidRef = useRef<number | null>(null)
  const [draggingUid, setDraggingUid] = useState<number | null>(null)
  const [dropTarget, setDropTarget]   = useState<{ uid: number; above: boolean } | null>(null)

  // ── Map init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [37.5665, 126.978],
      zoom: 14,
      zoomControl: false,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map)

    L.control.zoom({ position: 'bottomleft' }).addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      const store = useMissionStore.getState()
      const uid   = store.nextUid()
      store.setWaypoints((prev) => [
        ...prev,
        {
          uid,
          action: 'WAYPOINT',
          lat: parseFloat(e.latlng.lat.toFixed(7)),
          lon: parseFloat(e.latlng.lng.toFixed(7)),
          alt: store.defaultAlt,
          acceptRadius: 5,
          loiterRadius: 50,
        },
      ])
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── Sync markers + polyline ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()
    polylineRef.current?.remove()
    polylineRef.current = null

    let seq = 0
    const navPoints: [number, number][] = []

    waypoints.forEach((wp) => {
      const def = ACTIONS[wp.action]
      if (!def.hasAlt) return
      seq++

      const marker = L.marker([wp.lat, wp.lon], {
        icon: L.divIcon({ html: markerHtml(seq, def), iconSize: [32, 32], iconAnchor: [16, 16], className: '' }),
        draggable: true,
      })

      marker.on('dragend', (e) => {
        const ll = (e.target as L.Marker).getLatLng()
        setWaypoints((prev) =>
          prev.map((w) =>
            w.uid === wp.uid
              ? { ...w, lat: parseFloat(ll.lat.toFixed(7)), lon: parseFloat(ll.lng.toFixed(7)) }
              : w
          )
        )
      })

      marker.on('click', () => setSelectedUid((prev) => (prev === wp.uid ? null : wp.uid)))
      marker.addTo(map)
      markersRef.current.set(wp.uid, marker)
      navPoints.push([wp.lat, wp.lon])
    })

    if (navPoints.length >= 2) {
      polylineRef.current = L.polyline(navPoints, {
        color: 'rgba(79,195,247,0.55)',
        weight: 2,
        dashArray: '8 5',
      }).addTo(map)
    }
  }, [waypoints]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const updateWp = (uid: number, changes: Partial<Waypoint>) =>
    setWaypoints((prev) => prev.map((w) => (w.uid === uid ? { ...w, ...changes } : w)))

  const removeWp = (uid: number) => {
    setWaypoints((prev) => prev.filter((w) => w.uid !== uid))
    setSelectedUid((prev) => (prev === uid ? null : prev))
  }

  const moveWp = (uid: number, dir: -1 | 1) =>
    setWaypoints((prev) => {
      const idx = prev.findIndex((w) => w.uid === uid)
      if (idx < 0) return prev
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })

  // ── Drag handlers ─────────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, uid: number) => {
    dragUidRef.current = uid
    e.dataTransfer.effectAllowed = 'move'
    // Defer opacity update so the card is still visible in drag image
    setTimeout(() => setDraggingUid(uid), 0)
  }

  const handleDragOver = (e: React.DragEvent, uid: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const above = e.clientY < rect.top + rect.height / 2
    setDropTarget({ uid, above })
  }

  const handleDrop = (e: React.DragEvent, targetUid: number) => {
    e.preventDefault()
    const fromUid = dragUidRef.current
    if (fromUid === null || fromUid === targetUid) { setDropTarget(null); return }

    setWaypoints((prev) => {
      const fromIdx  = prev.findIndex((w) => w.uid === fromUid)
      const toIdx    = prev.findIndex((w) => w.uid === targetUid)
      if (fromIdx < 0 || toIdx < 0) return prev

      const arr  = [...prev]
      const [item] = arr.splice(fromIdx, 1)
      // Re-compute toIdx after splice
      const newToIdx = arr.findIndex((w) => w.uid === targetUid)
      const insertAt = dropTarget?.above ? newToIdx : newToIdx + 1
      arr.splice(insertAt, 0, item)
      return arr
    })
    dragUidRef.current = null
    setDraggingUid(null)
    setDropTarget(null)
  }

  const handleDragEnd = () => {
    dragUidRef.current = null
    setDraggingUid(null)
    setDropTarget(null)
  }

  const addWp = (action: ActionKey) => {
    const def  = ACTIONS[action]
    const last = waypoints[waypoints.length - 1]
    const uid  = nextUid()
    setWaypoints((prev) => [
      ...prev,
      {
        uid, action,
        lat: last ? last.lat + 0.001 : 37.5665,
        lon: last ? last.lon + 0.001 : 126.978,
        alt: def.hasAlt ? defaultAlt : 0,
        acceptRadius: 5,
        loiterRadius: 50,
      },
    ])
  }

  const handleUpload = async () => {
    if (waypoints.length === 0) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const result = await window.mavlink?.uploadMission(waypoints)
      if (result?.success) {
        setUploadMsg(`✓ ${result.count} items uploaded`)
      } else {
        setUploadMsg(`✗ ${result?.error ?? 'Upload failed'}`)
      }
    } catch (err) {
      setUploadMsg(`✗ ${err instanceof Error ? err.message : 'Upload failed'}`)
    } finally {
      setUploading(false)
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const distM   = totalDistance(waypoints)
  const distStr = distM >= 1000 ? `${(distM / 1000).toFixed(2)} km` : `${Math.round(distM)} m`

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'absolute', inset: 0, top: '56px', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: '44px', background: bg, borderBottom: `1px solid ${dim}`,
        backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: '20px', flexShrink: 0, zIndex: 10,
      }}>
        <Stat label="ITEMS" value={String(waypoints.length)} />
        <Divider />
        <Stat label="DIST" value={waypoints.length >= 2 ? distStr : '—'} />
        <Divider />

        {/* Default altitude */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: sans, fontSize: '11px', color: 'rgba(236,223,204,0.4)', letterSpacing: '0.08em' }}>
            DEFAULT ALT
          </span>
          <input
            type="number" value={defaultAlt} min={1} max={2000} step={5}
            onChange={(e) => setDefaultAlt(Number(e.target.value))}
            style={{
              width: '64px', fontFamily: mono, fontSize: '13px', fontWeight: 700,
              background: 'rgba(60,61,55,0.6)', border: '1px solid rgba(236,223,204,0.25)',
              borderRadius: '4px', color: '#ECDFCC', padding: '3px 8px',
              outline: 'none', textAlign: 'right',
            }}
          />
          <span style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(236,223,204,0.35)' }}>m</span>
          <button
            onClick={() => setWaypoints((prev) => prev.map((w) => (ACTIONS[w.action].hasAlt ? { ...w, alt: defaultAlt } : w)))}
            style={{
              fontFamily: mono, fontSize: '9px', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '3px 8px', background: 'rgba(236,223,204,0.06)',
              border: '1px solid rgba(236,223,204,0.2)', borderRadius: '3px',
              color: 'rgba(236,223,204,0.55)', cursor: 'pointer',
            }}
          >
            APPLY ALL
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {uploadMsg && (
          <span style={{ fontFamily: mono, fontSize: '10px', color: uploadMsg.startsWith('✓') ? '#A5D6A7' : '#E87020' }}>
            {uploadMsg}
          </span>
        )}

        <button
          onClick={() => { clearMission(); setUploadMsg(null) }}
          style={{
            fontFamily: mono, fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '5px 12px', background: 'transparent',
            border: '1px solid rgba(236,223,204,0.18)', borderRadius: '4px',
            color: 'rgba(236,223,204,0.45)', cursor: 'pointer',
          }}
        >
          CLEAR
        </button>

        <button
          onClick={handleUpload}
          disabled={uploading || waypoints.length === 0}
          style={{
            fontFamily: mono, fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '5px 16px',
            background: waypoints.length === 0 ? 'transparent' : 'rgba(79,195,247,0.12)',
            border: `1px solid ${waypoints.length === 0 ? 'rgba(236,223,204,0.1)' : 'rgba(79,195,247,0.45)'}`,
            borderRadius: '4px',
            color: waypoints.length === 0 ? 'rgba(236,223,204,0.2)' : '#4FC3F7',
            cursor: waypoints.length === 0 ? 'default' : 'pointer',
          }}
        >
          {uploading ? 'UPLOADING…' : 'UPLOAD MISSION'}
        </button>
      </div>

      {/* ── Map + Panel ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        <div ref={mapContainerRef} style={{ flex: 1 }} />

        {/* Right panel */}
        <div style={{
          width: '320px', flexShrink: 0, background: bg,
          borderLeft: `1px solid ${dim}`, backdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* Panel header */}
          <div style={{
            padding: '10px 14px', borderBottom: `1px solid ${dim}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontFamily: mono, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(236,223,204,0.6)' }}>
              MISSION ITEMS
            </span>
            <button
              onClick={() => addWp('VTOL_TAKEOFF')}
              style={{
                fontFamily: mono, fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '3px 8px', background: 'rgba(165,214,167,0.08)',
                border: '1px solid rgba(165,214,167,0.3)', borderRadius: '3px',
                color: '#A5D6A7', cursor: 'pointer',
              }}
            >
              + VTOL T/O
            </button>
          </div>

          {/* Empty hint */}
          {waypoints.length === 0 && (
            <div style={{ padding: '24px 16px', fontFamily: sans, fontSize: '12px', color: 'rgba(236,223,204,0.3)', lineHeight: 1.7 }}>
              지도를 클릭해서 웨이포인트 추가
              <br />
              <span style={{ fontSize: '11px', color: 'rgba(236,223,204,0.2)' }}>
                VTOL: T/O → →FW → WP → →MC → LND
                <br />MC: MC↑ → WP → MC↓
                <br />FW: FW↑ → WP → FW↓
              </span>
            </div>
          )}

          {/* Waypoint cards */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {waypoints.map((wp, idx) => {
              const def        = ACTIONS[wp.action]
              const isSelected = selectedUid === wp.uid

              const isDragging   = draggingUid === wp.uid
              const isDropAbove  = dropTarget?.uid === wp.uid && dropTarget.above
              const isDropBelow  = dropTarget?.uid === wp.uid && !dropTarget.above

              return (
                <div
                  key={wp.uid}
                  draggable
                  onDragStart={(e) => handleDragStart(e, wp.uid)}
                  onDragOver={(e) => handleDragOver(e, wp.uid)}
                  onDrop={(e) => handleDrop(e, wp.uid)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedUid((prev) => (prev === wp.uid ? null : wp.uid))}
                  style={{
                    background: isSelected ? 'rgba(60,61,55,0.7)' : 'rgba(40,44,32,0.6)',
                    border: `1px solid ${isSelected ? def.color + '60' : dim}`,
                    borderLeft: `3px solid ${def.color}`,
                    borderRadius: '6px', padding: '10px 12px',
                    cursor: 'grab', transition: 'opacity 0.1s ease',
                    opacity: isDragging ? 0.35 : 1,
                    boxShadow: isDropAbove
                      ? 'inset 0 3px 0 0 rgba(79,195,247,0.7)'
                      : isDropBelow
                      ? 'inset 0 -3px 0 0 rgba(79,195,247,0.7)'
                      : 'none',
                  }}
                >
                  {/* Top row: drag handle + seq + action select + move + delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {/* Drag handle */}
                    <span
                      style={{
                        fontFamily: mono, fontSize: '10px',
                        color: 'rgba(236,223,204,0.2)',
                        cursor: 'grab', userSelect: 'none',
                        letterSpacing: '-2px', lineHeight: 1,
                        flexShrink: 0,
                      }}
                      title="드래그하여 순서 변경"
                    >
                      ⠿
                    </span>
                    <span style={{ fontFamily: mono, fontSize: '11px', fontWeight: 700, color: def.color, minWidth: '18px' }}>
                      {idx + 1}
                    </span>
                    <select
                      value={wp.action}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateWp(wp.uid, { action: e.target.value as ActionKey })}
                      style={{
                        flex: 1, fontFamily: mono, fontSize: '11px', fontWeight: 600,
                        background: 'rgba(60,61,55,0.5)', border: 'none', outline: 'none',
                        color: def.color, cursor: 'pointer', padding: '2px 0',
                      }}
                    >
                      {ACTION_KEYS.map((k) => (
                        <option key={k} value={k} style={{ color: ACTIONS[k].color, background: '#1e2318' }}>
                          {ACTIONS[k].label}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button onClick={(e) => { e.stopPropagation(); moveWp(wp.uid, -1) }}
                        style={{ ...miniBtn, opacity: idx === 0 ? 0.2 : 0.6 }} disabled={idx === 0}>↑</button>
                      <button onClick={(e) => { e.stopPropagation(); moveWp(wp.uid, 1) }}
                        style={{ ...miniBtn, opacity: idx === waypoints.length - 1 ? 0.2 : 0.6 }}
                        disabled={idx === waypoints.length - 1}>↓</button>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeWp(wp.uid) }}
                      style={{ ...miniBtn, color: '#E87020', opacity: 0.7 }}>✕</button>
                  </div>

                  {/* ALT block (prominent) — with lat/lon below */}
                  {def.hasAlt && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: 'rgba(0,0,0,0.25)', borderRadius: '5px',
                        padding: '6px 10px', marginBottom: isSelected ? '8px' : 0,
                      }}
                    >
                      {/* ALT input — big */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: sans, fontSize: '10px', color: 'rgba(236,223,204,0.5)', letterSpacing: '0.08em', minWidth: '26px' }}>
                          ALT
                        </span>
                        <input
                          type="number" value={wp.alt} min={0} max={2000} step={5}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateWp(wp.uid, { alt: Number(e.target.value) })}
                          style={{
                            flex: 1, fontFamily: mono, fontSize: '18px', fontWeight: 700,
                            background: 'transparent', border: 'none', outline: 'none',
                            color: altColor(wp.alt), textAlign: 'right', padding: 0,
                          }}
                        />
                        <span style={{ fontFamily: mono, fontSize: '13px', color: 'rgba(236,223,204,0.45)', minWidth: '18px' }}>m</span>
                      </div>

                      {/* LAT / LON — small hint below ALT */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.3)', whiteSpace: 'nowrap' }}>
                          {wp.lat >= 0 ? 'N' : 'S'}{Math.abs(wp.lat).toFixed(5)}°
                        </span>
                        <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.2)' }}>·</span>
                        <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.3)', whiteSpace: 'nowrap' }}>
                          {wp.lon >= 0 ? 'E' : 'W'}{Math.abs(wp.lon).toFixed(5)}°
                        </span>
                      </div>
                    </div>
                  )}

                  {/* VTOL transition toggle */}
                  {!def.hasAlt && (wp.action === 'VTOL_TRANSITION_FW' || wp.action === 'VTOL_TRANSITION_MC') && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: isSelected ? '8px' : 0 }}>
                      {(['VTOL_TRANSITION_FW', 'VTOL_TRANSITION_MC'] as ActionKey[]).map((k) => (
                        <button
                          key={k}
                          onClick={(e) => { e.stopPropagation(); updateWp(wp.uid, { action: k }) }}
                          style={{
                            flex: 1, fontFamily: mono, fontSize: '10px', fontWeight: 700, padding: '5px',
                            background: wp.action === k ? `${ACTIONS[k].color}20` : 'transparent',
                            border: `1px solid ${wp.action === k ? ACTIONS[k].color + '80' : 'rgba(236,223,204,0.15)'}`,
                            borderRadius: '4px',
                            color: wp.action === k ? ACTIONS[k].color : 'rgba(236,223,204,0.4)',
                            cursor: 'pointer',
                          }}
                        >
                          {k === 'VTOL_TRANSITION_FW' ? '→ FIXED-WING' : '→ MULTIROTOR'}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Expanded: editable lat/lon + radii */}
                  {isSelected && def.hasAlt && (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <CoordInput label="LAT" value={wp.lat} step={0.00001} onChange={(v) => updateWp(wp.uid, { lat: v })} />
                        <CoordInput label="LON" value={wp.lon} step={0.00001} onChange={(v) => updateWp(wp.uid, { lon: v })} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: sans, fontSize: '10px', color: 'rgba(236,223,204,0.35)', minWidth: '72px' }}>Accept Rad</span>
                        <input type="number" value={wp.acceptRadius} min={1} max={500} step={1}
                          onChange={(e) => updateWp(wp.uid, { acceptRadius: Number(e.target.value) })}
                          style={{ ...smallInput, width: '56px', textAlign: 'right' }} />
                        <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.3)' }}>m</span>
                      </div>
                      {wp.action === 'LOITER' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: sans, fontSize: '10px', color: 'rgba(236,223,204,0.35)', minWidth: '72px' }}>Loiter Rad</span>
                          <input type="number" value={wp.loiterRadius} min={10} max={2000} step={10}
                            onChange={(e) => updateWp(wp.uid, { loiterRadius: Number(e.target.value) })}
                            style={{ ...smallInput, width: '56px', textAlign: 'right' }} />
                          <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.3)' }}>m</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bottom: grouped quick-add buttons */}
          <div style={{ borderTop: `1px solid ${dim}`, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {GROUPS.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  fontFamily: sans, fontSize: '8px', fontWeight: 700,
                  color: 'rgba(236,223,204,0.25)', letterSpacing: '0.1em',
                  minWidth: '28px', textTransform: 'uppercase',
                }}>
                  {label}
                </span>
                {ACTION_KEYS.filter((k) => ACTIONS[k].group === key).map((k) => (
                  <button key={k} onClick={() => addWp(k)}
                    style={{
                      fontFamily: mono, fontSize: '9px', fontWeight: 700,
                      letterSpacing: '0.05em', padding: '3px 7px',
                      background: `${ACTIONS[k].color}10`,
                      border: `1px solid ${ACTIONS[k].color}40`,
                      borderRadius: '4px', color: ACTIONS[k].color, cursor: 'pointer',
                    }}
                  >
                    + {ACTIONS[k].short}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Altitude Profile Strip ──────────────────────────────────────────── */}
      <AltitudeProfile waypoints={waypoints} />
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontFamily: sans, fontSize: '11px', color: 'rgba(236,223,204,0.4)', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: '13px', fontWeight: 700, color: '#ECDFCC' }}>{value}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: 'rgba(236,223,204,0.1)' }} />
}

function CoordInput({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontFamily: sans, fontSize: '9px', color: 'rgba(236,223,204,0.35)' }}>{label}</span>
      <input type="number" value={value} step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ ...smallInput, width: '100%' }} />
    </div>
  )
}

// ─── Altitude Profile ──────────────────────────────────────────────────────────
interface AltPoint {
  dist: number      // cumulative distance (m)
  alt: number
  seq: number       // 1-based nav waypoint index
  action: ActionKey
  uid: number
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

function AltitudeProfile({ waypoints }: { waypoints: Waypoint[] }) {
  const [collapsed, setCollapsed] = useState(false)

  // Only nav waypoints with altitude
  const navWps = waypoints.filter((w) => ACTIONS[w.action].hasAlt)

  // Build chart data
  let cumDist = 0
  const data: AltPoint[] = navWps.map((wp, i) => {
    if (i > 0) cumDist += haversineM(navWps[i - 1], wp)
    return { dist: cumDist, alt: wp.alt, seq: i + 1, action: wp.action, uid: wp.uid }
  })

  const CHART_H = 130

  return (
    <div
      style={{
        flexShrink: 0,
        background: 'rgba(20,24,16,0.98)',
        borderTop: '1px solid rgba(236,223,204,0.1)',
        backdropFilter: 'blur(12px)',
        transition: 'height 0.2s ease',
        overflow: 'hidden',
        height: collapsed ? '32px' : `${CHART_H + 32}px`,
      }}
    >
      {/* Header row */}
      <div
        style={{
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '12px',
          borderBottom: collapsed ? 'none' : '1px solid rgba(236,223,204,0.07)',
        }}
      >
        <span style={{ fontFamily: mono, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(236,223,204,0.45)' }}>
          ALTITUDE PROFILE
        </span>
        {navWps.length < 2 && !collapsed && (
          <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.2)' }}>
            — 웨이포인트를 2개 이상 추가하면 표시됩니다
          </span>
        )}
        <div style={{ flex: 1 }} />
        {/* Stats */}
        {data.length >= 2 && (
          <>
            <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.3)' }}>
              MAX {Math.max(...data.map((d) => d.alt))}m
            </span>
            <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.2)' }}>·</span>
            <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(236,223,204,0.3)' }}>
              TOTAL {fmtDist(data[data.length - 1].dist)}
            </span>
          </>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={{
            fontFamily: mono, fontSize: '9px', fontWeight: 700,
            background: 'transparent', border: '1px solid rgba(236,223,204,0.15)',
            borderRadius: '3px', color: 'rgba(236,223,204,0.4)',
            padding: '2px 8px', cursor: 'pointer',
          }}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {/* Chart area */}
      {!collapsed && (
        <div style={{ height: CHART_H, padding: '8px 8px 4px 0' }}>
          {data.length < 1 ? null : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 14, right: 24, bottom: 4, left: 44 }}>
                <defs>
                  <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4FC3F7" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4FC3F7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="dist"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(v: number) => fmtDist(v)}
                  tick={{ fontFamily: mono, fontSize: 9, fill: 'rgba(236,223,204,0.3)' }}
                  axisLine={{ stroke: 'rgba(236,223,204,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="alt"
                  tickFormatter={(v: number) => `${v}m`}
                  tick={{ fontFamily: mono, fontSize: 9, fill: 'rgba(236,223,204,0.3)' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />

                {/* Vertical reference lines at each waypoint */}
                {data.map((d) => (
                  <ReferenceLine
                    key={d.uid}
                    x={d.dist}
                    stroke={ACTIONS[d.action].color}
                    strokeOpacity={0.2}
                    strokeDasharray="3 3"
                  />
                ))}

                <Tooltip content={<AltTooltip />} cursor={{ stroke: 'rgba(79,195,247,0.3)', strokeWidth: 1 }} />

                <Area
                  type="monotone"
                  dataKey="alt"
                  stroke="#4FC3F7"
                  strokeWidth={1.5}
                  fill="url(#altGrad)"
                  dot={<WaypointDot />}
                  activeDot={{ r: 5, fill: '#4FC3F7', strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}

// Custom dot: colored circle + seq number label
function WaypointDot(props: {
  cx?: number; cy?: number; payload?: AltPoint
}) {
  const { cx = 0, cy = 0, payload } = props
  if (!payload) return null
  const def = ACTIONS[payload.action]
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={def.color + '28'} stroke={def.color} strokeWidth={1.5} />
      <text
        x={cx} y={cy + 0.5}
        textAnchor="middle" dominantBaseline="central"
        fill={def.color} fontSize={8} fontWeight={700}
        fontFamily="'JetBrains Mono',monospace"
      >
        {payload.seq}
      </text>
      {/* Altitude label above dot */}
      <text
        x={cx} y={cy - 14}
        textAnchor="middle"
        fill={altColor(payload.alt)} fontSize={8} fontWeight={700}
        fontFamily="'JetBrains Mono',monospace"
      >
        {payload.alt}m
      </text>
    </g>
  )
}

// Custom tooltip
function AltTooltip({ active, payload }: { active?: boolean; payload?: { payload: AltPoint }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const def = ACTIONS[d.action]
  return (
    <div style={{
      background: 'rgba(24,28,20,0.97)',
      border: `1px solid ${def.color}60`,
      borderRadius: '5px',
      padding: '6px 10px',
      fontFamily: mono,
      fontSize: '10px',
      pointerEvents: 'none',
    }}>
      <div style={{ color: def.color, fontWeight: 700, marginBottom: '3px' }}>
        {d.seq}. {def.label}
      </div>
      <div style={{ color: altColor(d.alt), fontWeight: 700 }}>{d.alt} m</div>
      <div style={{ color: 'rgba(236,223,204,0.4)', marginTop: '2px' }}>{fmtDist(d.dist)}</div>
    </div>
  )
}
