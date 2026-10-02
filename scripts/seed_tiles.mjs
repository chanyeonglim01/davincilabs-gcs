#!/usr/bin/env node
/**
 * Pre-fill the GCS map tile cache for a flight-test site so the map keeps
 * working offline. Same cache layout the app uses (src/main/tileCacheCore.ts):
 *
 *   <root>/<layer>/<z>/<x>/<y>.<ext>     root = %APPDATA%\davincilabs-gcs\tiles (Windows)
 *
 * Usage (run once per laptop, online):
 *   node scripts/seed_tiles.mjs --lat 36.968 --lon 127.866
 *   node scripts/seed_tiles.mjs --lat 36.968 --lon 127.866 --radius 8 --zmax 17 --layers sat,dark
 *   node scripts/seed_tiles.mjs --dry-run            # only count tiles
 *
 * Defaults: 한국교통대 충주캠퍼스(36.968, 127.866). Radius is scaled down at the
 * high zooms so the download stays small (see RADIUS_SCALE); pass --radius to
 * change the base radius in km.
 *
 * Be a polite client: 4 parallel requests, identifying User-Agent, skips tiles
 * already cached. Keep the area small — these are public tile servers.
 */

import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const SOURCES = {
  sat: {
    ext: 'jpg',
    zmin: 12,
    zmax: 17, // ArcGIS World_Imagery has no tiles past z17 at most rural sites
    url: ({ z, x, y }) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
  },
  dark: {
    ext: 'png',
    zmin: 12,
    zmax: 18,
    url: ({ z, x, y }) => `https://${'abcd'[(x + y) % 4]}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`
  }
}

/** Base radius (km) multiplier per zoom: wide area coarse, campus-size fine. */
const RADIUS_SCALE = { 16: 0.6, 17: 0.4, 18: 0.25 }

const CONCURRENCY = 4
const USER_AGENT = 'DavinciLabsGCS-tile-seeder/0.1'

function parseArgs(argv) {
  const out = { lat: 36.968, lon: 127.866, radius: 8, zmin: null, zmax: null, layers: ['sat', 'dark'], dry: false, out: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--lat') out.lat = Number(next())
    else if (a === '--lon') out.lon = Number(next())
    else if (a === '--radius') out.radius = Number(next())
    else if (a === '--zmin') out.zmin = Number(next())
    else if (a === '--zmax') out.zmax = Number(next())
    else if (a === '--layers') out.layers = next().split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--out') out.out = next()
    else if (a === '--dry-run') out.dry = true
    else if (a === '--help' || a === '-h') {
      console.log('node scripts/seed_tiles.mjs [--lat L --lon L] [--radius km] [--zmin z --zmax z] [--layers sat,dark] [--out dir] [--dry-run]')
      process.exit(0)
    } else throw new Error(`unknown argument: ${a}`)
  }
  for (const l of out.layers) if (!SOURCES[l]) throw new Error(`unknown layer: ${l}`)
  return out
}

function defaultCacheRoot() {
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'davincilabs-gcs', 'tiles')
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'davincilabs-gcs', 'tiles')
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'davincilabs-gcs', 'tiles')
}

const lon2tile = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2tile = (lat, z) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

function tileRange(lat, lon, radiusKm, z) {
  const dLat = radiusKm / 111.32
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const n = 2 ** z
  const clamp = (v) => Math.min(n - 1, Math.max(0, v))
  return {
    x0: clamp(lon2tile(lon - dLon, z)),
    x1: clamp(lon2tile(lon + dLon, z)),
    y0: clamp(lat2tile(lat + dLat, z)),
    y1: clamp(lat2tile(lat - dLat, z))
  }
}

function plan(opts) {
  const jobs = []
  for (const layer of opts.layers) {
    const src = SOURCES[layer]
    const zmin = opts.zmin ?? src.zmin
    const zmax = opts.zmax ?? src.zmax
    for (let z = zmin; z <= zmax; z += 1) {
      const radius = opts.radius * (RADIUS_SCALE[z] ?? 1)
      const { x0, x1, y0, y1 } = tileRange(opts.lat, opts.lon, radius, z)
      let count = 0
      for (let x = x0; x <= x1; x += 1)
        for (let y = y0; y <= y1; y += 1) {
          jobs.push({ layer, z, x, y })
          count += 1
        }
      console.log(`${layer.padEnd(4)} z${String(z).padStart(2)}  radius ${radius.toFixed(1)} km  ${count} tiles`)
    }
  }
  return jobs
}

async function fetchTile(job, root) {
  const src = SOURCES[job.layer]
  const file = join(root, job.layer, String(job.z), String(job.x), `${job.y}.${src.ext}`)
  try {
    await fs.access(file)
    return 'skip'
  } catch {
    // not cached
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(src.url(job), { headers: { 'User-Agent': USER_AGENT } })
      if (res.status === 404) return 'missing'
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = Buffer.from(await res.arrayBuffer())
      if (data.length === 0) throw new Error('empty body')
      await fs.mkdir(dirname(file), { recursive: true })
      const tmp = `${file}.${process.pid}.tmp`
      await fs.writeFile(tmp, data)
      await fs.rename(tmp, file)
      return 'ok'
    } catch (err) {
      if (attempt === 2) {
        console.warn(`  fail ${job.layer}/${job.z}/${job.x}/${job.y}: ${err.message}`)
        return 'fail'
      }
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  return 'fail'
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const root = opts.out ?? defaultCacheRoot()
  console.log(`center ${opts.lat}, ${opts.lon}  base radius ${opts.radius} km  layers ${opts.layers.join(',')}`)
  console.log(`cache root: ${root}`)
  const jobs = plan(opts)
  console.log(`total ${jobs.length} tiles`)
  if (opts.dry) return

  const stats = { ok: 0, skip: 0, missing: 0, fail: 0 }
  let next = 0
  const started = Date.now()
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++]
      const r = await fetchTile(job, root)
      stats[r] += 1
      const done = stats.ok + stats.skip + stats.missing + stats.fail
      if (done % 100 === 0 || done === jobs.length)
        console.log(`${done}/${jobs.length}  ok ${stats.ok}  cached ${stats.skip}  404 ${stats.missing}  fail ${stats.fail}`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)} s`)
  if (stats.fail > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
