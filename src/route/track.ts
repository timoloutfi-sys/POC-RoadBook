import type { RawPoint } from './route'

const K = 111320

/** Tracé fin : les points du GPX, simplifiés seulement là où ils n'apportent rien. */
export interface Track {
  n: number
  /** Distance cumulée (m) le long du tracé. */
  d: Float64Array
  lat: Float64Array
  lon: Float64Array
  /** Altitude lissée (m). */
  ele: Float32Array
  /** Altitude brute du GPX aux mêmes points (pour le stockage). */
  raw: Float32Array
  total: number
}

/** Tolérances de simplification : écart au tracé (m) et écart d'altitude (m). */
export const TOL_GEO = 2.5
export const TOL_ELE = 0.5
/** Fenêtre de lissage de l'altitude (m). */
export const ELE_WINDOW = 60

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000, t = Math.PI / 180
  const x = Math.sin(((lat2 - lat1) * t) / 2) ** 2 + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(((lon2 - lon1) * t) / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

/** Altitude lissée par moyenne glissante sur `win` mètres, calculée sur la ligne brisée exacte. */
function smoothElevation(d: Float64Array, e: ArrayLike<number>, win: number): Float32Array {
  const n = d.length, I = new Float64Array(n)
  for (let i = 1; i < n; i++) I[i] = I[i - 1] + ((e[i - 1] + e[i]) / 2) * (d[i] - d[i - 1])
  let seg = 0
  const integral = (x: number) => {
    x = Math.min(Math.max(x, 0), d[n - 1])
    while (seg > 0 && d[seg] > x) seg--
    while (seg < n - 2 && d[seg + 1] < x) seg++
    const dd = d[seg + 1] - d[seg]
    if (dd <= 0) return I[seg]
    const s = (e[seg + 1] - e[seg]) / dd, u = x - d[seg]
    return I[seg] + e[seg] * u + 0.5 * s * u * u
  }
  const out = new Float32Array(n), h = win / 2
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, d[i] - h), b = Math.min(d[n - 1], d[i] + h)
    out[i] = b > a ? (integral(b) - integral(a)) / (b - a) : e[i]
  }
  return out
}

/**
 * Simplifie les points du GPX (Douglas-Peucker itératif) : un point est gardé si le tracé ou l'altitude
 * s'écartent de la ligne droite entre ses voisins gardés. Le tracé d'origine n'est jamais modifié :
 * on en garde une représentation plus légère, assez fine pour la position, les virages et la pente.
 */
export function buildTrack(raw: RawPoint[], tolGeo = TOL_GEO, tolEle = TOL_ELE): Track {
  // Points confondus : inutiles.
  const pts: RawPoint[] = []
  for (const p of raw) {
    const q = pts[pts.length - 1]
    if (!q || haversine(q.lat, q.lon, p.lat, p.lon) > 0.3) pts.push(p)
  }
  const n0 = pts.length
  if (n0 < 2) throw new Error('Tracé vide.')
  const d0 = new Float64Array(n0)
  for (let i = 1; i < n0; i++) d0[i] = d0[i - 1] + haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon)
  const es = smoothElevation(d0, pts.map(p => p.ele), ELE_WINDOW)
  const lat0 = pts[0].lat, cl = Math.cos((lat0 * Math.PI) / 180)
  const x = new Float64Array(n0), y = new Float64Array(n0)
  for (let i = 0; i < n0; i++) { x[i] = (pts[i].lon - pts[0].lon) * cl * K; y[i] = (pts[i].lat - lat0) * K }

  const keep = new Uint8Array(n0)
  keep[0] = 1; keep[n0 - 1] = 1
  const stack: [number, number][] = [[0, n0 - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    if (b - a < 2) continue
    const dx = x[b] - x[a], dy = y[b] - y[a], len = Math.hypot(dx, dy), span = d0[b] - d0[a]
    let worst = -1, ws = 1
    for (let k = a + 1; k < b; k++) {
      const h = len > 0 ? Math.abs((x[k] - x[a]) * dy - (y[k] - y[a]) * dx) / len : Math.hypot(x[k] - x[a], y[k] - y[a])
      const v = Math.abs(es[k] - (es[a] + ((es[b] - es[a]) * (d0[k] - d0[a])) / (span || 1)))
      const s = Math.max(h / tolGeo, v / tolEle)
      if (s > ws) { ws = s; worst = k }
    }
    if (worst > 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]) }
  }
  let n = 0
  for (let i = 0; i < n0; i++) n += keep[i]
  const t: Track = { n, d: new Float64Array(n), lat: new Float64Array(n), lon: new Float64Array(n), ele: new Float32Array(n), raw: new Float32Array(n), total: d0[n0 - 1] }
  let k = 0
  for (let i = 0; i < n0; i++) if (keep[i]) { t.d[k] = d0[i]; t.lat[k] = pts[i].lat; t.lon[k] = pts[i].lon; t.ele[k] = es[i]; t.raw[k] = pts[i].ele; k++ }
  return t
}

/** Plus grand indice de point dont la distance est ≤ dist (borné à n − 2 pour avoir un segment). */
export function segAt(t: Track, dist: number): number {
  let lo = 0, hi = t.n - 2
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (t.d[m] <= dist) lo = m; else hi = m - 1 }
  return lo
}

/** Position et altitude à la distance dist (m), par interpolation entre deux points du tracé. */
export function trackAt(t: Track, dist: number) {
  const x = Math.min(Math.max(dist, 0), t.total), i = segAt(t, x), dd = t.d[i + 1] - t.d[i], f = dd > 0 ? (x - t.d[i]) / dd : 0
  return { lat: t.lat[i] + (t.lat[i + 1] - t.lat[i]) * f, lon: t.lon[i] + (t.lon[i + 1] - t.lon[i]) * f, ele: t.ele[i] + (t.ele[i + 1] - t.ele[i]) * f, i }
}

/** Au-delà de cette distance au tracé (m), on est hors parcours. */
export const OFF_ROUTE_M = 150

export interface Projection { dist: number; off: number; i: number }

/**
 * Projette une position sur le tracé : distance parcourue (m) au mètre près, écart au tracé (m).
 * Recherche locale autour de `hint` (m), puis sur tout le tracé si l'écart dépasse OFF_ROUTE_M
 * (demi-tour, raccourci, reprise).
 */
export function project(t: Track, lat: number, lon: number, hint = 0, back = 150, ahead = 800): Projection {
  const cl = Math.cos((lat * Math.PI) / 180)
  const scan = (i0: number, i1: number): Projection => {
    let best: Projection = { dist: 0, off: Infinity, i: i0 }
    for (let i = i0; i <= Math.min(i1, t.n - 2); i++) {
      const ax = (t.lon[i] - lon) * cl * K, ay = (t.lat[i] - lat) * K
      const bx = (t.lon[i + 1] - lon) * cl * K, by = (t.lat[i + 1] - lat) * K
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
      const u = l2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / l2)) : 0
      const off = Math.hypot(ax + u * dx, ay + u * dy)
      if (off < best.off) best = { dist: t.d[i] + u * (t.d[i + 1] - t.d[i]), off, i }
    }
    return best
  }
  let r = scan(segAt(t, Math.max(0, hint - back)), segAt(t, Math.min(t.total, hint + ahead)) + 1)
  if (r.off > OFF_ROUTE_M) { const g = scan(0, t.n - 2); if (g.off < r.off) r = g }
  return r
}
