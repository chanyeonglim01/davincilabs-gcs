/**
 * Map tile cache — pure helpers (no Electron import, so they can be unit-tested
 * and shared with scripts/seed_tiles.mjs by convention).
 *
 * The renderer requests tiles through a custom scheme instead of the public tile
 * servers directly:
 *
 *   gcs-tiles://tiles/<layer>/<z>/<x>/<y>[@2x]
 *
 * The main process serves the tile from the on-disk cache when present, and
 * otherwise fetches it from the upstream server and stores it. Any area ever
 * viewed online therefore keeps working offline, and `scripts/seed_tiles.mjs`
 * pre-fills the cache for a flight-test site.
 *
 * Cache layout (see tileCachePath): <root>/<layer>/<z>/<x>/<y>[@2x].<ext>
 */

export const TILE_SCHEME = 'gcs-tiles'
export const TILE_HOST = 'tiles'

export type TileLayerId = 'sat' | 'dark'

export interface TileRequest {
  layer: TileLayerId
  z: number
  x: number
  y: number
  /** CARTO serves @2x raster variants; Esri imagery has none. */
  retina: boolean
}

export interface TileSource {
  ext: 'jpg' | 'png'
  contentType: string
  upstream: (req: TileRequest) => string
}

export const TILE_SOURCES: Record<TileLayerId, TileSource> = {
  // ArcGIS World_Imagery addresses tiles as z/y/x (note the order).
  sat: {
    ext: 'jpg',
    contentType: 'image/jpeg',
    upstream: ({ z, x, y }): string =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
  },
  dark: {
    ext: 'png',
    contentType: 'image/png',
    upstream: ({ z, x, y, retina }): string =>
      `https://${'abcd'[(x + y) % 4]}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}${retina ? '@2x' : ''}.png`
  }
}

const MAX_ZOOM = 22

/** Leaflet/Cesium URL template for a cached layer. */
export function tileUrlTemplate(layer: TileLayerId, retina = false): string {
  return `${TILE_SCHEME}://${TILE_HOST}/${layer}/{z}/{x}/{y}${retina ? '{r}' : ''}`
}

/**
 * Parse a `gcs-tiles://tiles/<layer>/<z>/<x>/<y>[@2x]` URL. Returns null for
 * anything malformed or out of range, so the protocol handler can answer 400
 * instead of touching the filesystem with attacker-shaped paths.
 */
export function parseTileUrl(url: string): TileRequest | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${TILE_SCHEME}:` || parsed.host !== TILE_HOST) return null

  const m = /^\/(sat|dark)\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})(@2x)?$/.exec(parsed.pathname)
  if (!m) return null

  const layer = m[1] as TileLayerId
  const z = Number(m[2])
  const x = Number(m[3])
  const y = Number(m[4])
  if (z > MAX_ZOOM) return null
  const n = 2 ** z
  if (x >= n || y >= n) return null

  return { layer, z, x, y, retina: m[5] === '@2x' }
}

/** Absolute cache file path for a tile under `root`. */
export function tileCachePath(root: string, req: TileRequest): string {
  const { ext } = TILE_SOURCES[req.layer]
  const name = `${req.y}${req.retina ? '@2x' : ''}.${ext}`
  return [root, req.layer, String(req.z), String(req.x), name].join('/')
}
