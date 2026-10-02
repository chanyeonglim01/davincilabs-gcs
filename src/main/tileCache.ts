/**
 * Map tile cache — Electron side.
 *
 * Registers the `gcs-tiles://` scheme and serves map tiles from an on-disk
 * cache, filling it from the upstream tile servers when online. See
 * tileCacheCore.ts for the URL contract and cache layout.
 *
 * Cache root: <appData>/davincilabs-gcs/tiles — deliberately NOT userData, so
 * the dev build (app name "davincilabs-gcs") and the packaged build (product
 * name "DavinciLabs GCS") share one cache and `scripts/seed_tiles.mjs` has a
 * single, predictable target.
 */

import { app, net, protocol } from 'electron'
import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { log } from './crashLog'
import { TILE_SCHEME, TILE_SOURCES, parseTileUrl, tileCachePath } from './tileCacheCore'

const UPSTREAM_USER_AGENT = 'DavinciLabsGCS/0.1 (+map tile cache)'

/** Must run before app.whenReady() — privileged schemes cannot be added later. */
export function registerTileScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: TILE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

export function tileCacheRoot(): string {
  return join(app.getPath('appData'), 'davincilabs-gcs', 'tiles')
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function writeTile(file: string, data: Buffer): Promise<void> {
  // Write-then-rename so a crash mid-write never leaves a truncated tile that
  // would be served as a broken image forever.
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    await fs.mkdir(dirname(file), { recursive: true })
    await fs.writeFile(tmp, data)
    await fs.rename(tmp, file)
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => undefined)
    // Another writer (a second request for the same tile, or scripts/seed_tiles.mjs
    // running alongside the app) can win the rename on Windows with EPERM — the
    // tile is on disk either way, so that is not worth a log line.
    if (await fileExists(file)) return
    log('TileCache', `write failed ${file}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Call after app.whenReady(). */
export function installTileCache(): void {
  const root = tileCacheRoot()
  let hits = 0
  let fetched = 0
  let misses = 0

  // One upstream request per tile at a time: the two map views ask for the
  // same tiles within the same frame when they share a viewport.
  // Buffer<ArrayBuffer> (not ArrayBufferLike): that is what Response accepts.
  type TileBytes = Buffer<ArrayBuffer>
  const inflight = new Map<string, Promise<TileBytes | null>>()

  const fetchUpstream = (file: string, url: string): Promise<TileBytes | null> => {
    const pending = inflight.get(file)
    if (pending) return pending
    const task = (async (): Promise<TileBytes | null> => {
      const res = await net.fetch(url, { headers: { 'User-Agent': UPSTREAM_USER_AGENT } })
      if (!res.ok) return null
      const data = Buffer.from(await res.arrayBuffer())
      if (data.length === 0) return null
      await writeTile(file, data)
      return data
    })()
    inflight.set(file, task)
    task.finally(() => inflight.delete(file)).catch(() => undefined)
    return task
  }

  protocol.handle(TILE_SCHEME, async (request): Promise<Response> => {
    const req = parseTileUrl(request.url)
    if (!req) return new Response(null, { status: 400 })

    const source = TILE_SOURCES[req.layer]
    const file = tileCachePath(root, req)
    const headers = {
      'Content-Type': source.contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=86400'
    }

    try {
      const cached = await fs.readFile(file)
      hits += 1
      return new Response(cached, { status: 200, headers })
    } catch {
      // not cached yet
    }

    try {
      const data = await fetchUpstream(file, source.upstream(req))
      if (!data) {
        misses += 1
        return new Response(null, { status: 404 })
      }
      fetched += 1
      return new Response(data, { status: 200, headers })
    } catch {
      // Offline (or upstream unreachable) and nothing cached: let Leaflet show
      // its transparent error tile instead of hanging on a retry.
      misses += 1
      return new Response(null, { status: 504 })
    }
  })

  log('TileCache', `scheme ${TILE_SCHEME}:// -> ${root}`)
  // Light-weight visibility into cache behaviour without spamming the log.
  setInterval(() => {
    if (hits + fetched + misses === 0) return
    log('TileCache', `hits=${hits} fetched=${fetched} misses=${misses}`)
    hits = 0
    fetched = 0
    misses = 0
  }, 60_000).unref()
}
