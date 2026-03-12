// ─── Survey Grid Generator ─────────────────────────────────────────────────────
// Boustrophedon (S-curve) sweep-line grid over a geographic polygon.
// Pure function — no side effects.

export interface SurveyGridParams {
  spacing: number    // metres between sweep lines (5–500)
  angle: number      // degrees, 0 = N-S sweeps, 90 = E-W sweeps
  altitude: number   // metres MSL for generated waypoints
  overshoot: number  // metres to extend each sweep line beyond polygon edge
}

export interface SurveyGridResult {
  waypoints: { lat: number; lon: number }[]
  totalDistance: number  // metres (sum of segment lengths)
}

const DEG2RAD = Math.PI / 180
const R_EARTH = 6371000  // metres

// Convert (lat, lon) to local (x_m, y_m) relative to origin
function toLocal(lat: number, lon: number, originLat: number, originLon: number): [number, number] {
  const x = (lon - originLon) * DEG2RAD * R_EARTH * Math.cos(originLat * DEG2RAD)
  const y = (lat - originLat) * DEG2RAD * R_EARTH
  return [x, y]
}

// Convert local (x_m, y_m) back to (lat, lon)
function fromLocal(x: number, y: number, originLat: number, originLon: number): [number, number] {
  const lat = originLat + (y / R_EARTH) / DEG2RAD
  const lon = originLon + (x / (R_EARTH * Math.cos(originLat * DEG2RAD))) / DEG2RAD
  return [lat, lon]
}

function rotate(x: number, y: number, angleDeg: number): [number, number] {
  const a = angleDeg * DEG2RAD
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return [x * cos - y * sin, x * sin + y * cos]
}

// Segment intersection: returns x-coordinate of intersection of horizontal line y=ySweep
// with edge (x1,y1)→(x2,y2), or null if no crossing.
function sweepIntersect(
  x1: number, y1: number,
  x2: number, y2: number,
  ySweep: number,
): number | null {
  if ((y1 <= ySweep && y2 > ySweep) || (y2 <= ySweep && y1 > ySweep)) {
    const t = (ySweep - y1) / (y2 - y1)
    return x1 + t * (x2 - x1)
  }
  return null
}

export function generateSurveyGrid(
  polygon: [number, number][],  // [lat, lon][]
  params: SurveyGridParams,
): SurveyGridResult {
  if (polygon.length < 3) return { waypoints: [], totalDistance: 0 }

  const spacing = Math.max(5, Math.min(500, params.spacing))

  // 1. Compute centroid in geo space
  const originLat = polygon.reduce((s, p) => s + p[0], 0) / polygon.length
  const originLon = polygon.reduce((s, p) => s + p[1], 0) / polygon.length

  // 2. Convert polygon to local coordinates
  const local: [number, number][] = polygon.map(([lat, lon]) =>
    toLocal(lat, lon, originLat, originLon)
  )

  // 3. Rotate by -angle so sweeps are horizontal (along X)
  const rotated: [number, number][] = local.map(([x, y]) => rotate(x, y, -params.angle))

  // 4. Bounding box in rotated space
  const xs = rotated.map((p) => p[0])
  const ys = rotated.map((p) => p[1])
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)

  // 5. Generate sweep lines
  const firstY = minY + spacing / 2
  const sweepLines: number[] = []
  for (let y = firstY; y <= maxY; y += spacing) {
    sweepLines.push(y)
  }
  if (sweepLines.length === 0) sweepLines.push((minY + maxY) / 2)

  // 6. For each sweep line, find edge intersections
  const n = rotated.length
  const waypointsLocal: [number, number][] = []

  for (let li = 0; li < sweepLines.length; li++) {
    const ySweep = sweepLines[li]
    const xCrossings: number[] = []

    for (let i = 0; i < n; i++) {
      const [x1, y1] = rotated[i]
      const [x2, y2] = rotated[(i + 1) % n]
      const x = sweepIntersect(x1, y1, x2, y2, ySweep)
      if (x !== null) xCrossings.push(x)
    }

    if (xCrossings.length < 2) continue

    xCrossings.sort((a, b) => a - b)

    // Pair up entry/exit crossings (even-odd rule)
    for (let i = 0; i < xCrossings.length - 1; i += 2) {
      const xLeft  = xCrossings[i]     - params.overshoot
      const xRight = xCrossings[i + 1] + params.overshoot
      const xClampLeft  = Math.max(xLeft,  minX - params.overshoot)
      const xClampRight = Math.min(xRight, maxX + params.overshoot)

      // Boustrophedon: alternate direction
      if (li % 2 === 0) {
        waypointsLocal.push([xClampLeft,  ySweep])
        waypointsLocal.push([xClampRight, ySweep])
      } else {
        waypointsLocal.push([xClampRight, ySweep])
        waypointsLocal.push([xClampLeft,  ySweep])
      }
    }
  }

  // 7. Safety cap
  const MAX_WP = 500
  const capped = waypointsLocal.slice(0, MAX_WP)

  // 8. Rotate back and convert to geo
  const waypoints: { lat: number; lon: number }[] = capped.map(([rx, ry]) => {
    const [lx, ly] = rotate(rx, ry, params.angle)
    const [lat, lon] = fromLocal(lx, ly, originLat, originLon)
    return {
      lat: parseFloat(lat.toFixed(7)),
      lon: parseFloat(lon.toFixed(7)),
    }
  })

  // 9. Compute total path distance
  let totalDistance = 0
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1]
    const b = waypoints[i]
    const dLat = (b.lat - a.lat) * DEG2RAD
    const dLon = (b.lon - a.lon) * DEG2RAD
    const s1 = Math.sin(dLat / 2)
    const s2 = Math.sin(dLon / 2)
    const c = s1 * s1 + Math.cos(a.lat * DEG2RAD) * Math.cos(b.lat * DEG2RAD) * s2 * s2
    totalDistance += R_EARTH * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c))
  }

  return { waypoints, totalDistance }
}
