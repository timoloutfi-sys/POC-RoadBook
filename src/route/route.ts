import { clamp } from '../core/format'
import { buildTrack, trackAt, type Track } from './track'
import { buildProfile, dplusOf, eleAtDist, type Profile } from './profile'

/** Pas de la grille du plan, en mètres. */
export const STEP = 50

export interface RawPoint { lat: number; lon: number; ele: number }

export interface Route {
  name: string
  /** Nombre d'échantillons (un tous les STEP mètres). */
  n: number
  /** Longueur totale en mètres. */
  total: number
  lat: Float64Array
  lon: Float64Array
  /** Altitude brute rééchantillonnée. */
  e0: Float32Array
  /** Altitude lissée. */
  ele: Float32Array
  /** Pente en %. */
  grade: Float32Array
  /** Dénivelé positif (hystérésis de 2 m sur le profil lissé), en mètres. */
  dplus: number
  /** Tracé fin (position, virages, projection du GPS). */
  track: Track
  /** Tronçons de pente constante, à pas variable. */
  profile: Profile
  /** Parcours fictif construit pour une estimation (course sans GPX) : jamais enregistré ni affiché comme un tracé. */
  synthetic?: boolean
}

export interface Climb { i0: number; i1: number; a: number; b: number; len: number; avg: number; gain: number }

/** Distance haversine en mètres. */
export function hav(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000, t = Math.PI / 180
  const x = Math.sin(((lat2 - lat1) * t) / 2) ** 2 +
    Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(((lon2 - lon1) * t) / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

/**
 * Construit le tracé fin et le profil à pas variable, puis la grille de 50 m dont se sert le plan,
 * alimentée par la pente exacte du profil.
 */
export function buildRoute(name: string, pts: RawPoint[]): Route {
  if (!pts || pts.length < 2) throw new Error('Tracé vide.')
  const track = buildTrack(pts)
  if (track.total < STEP * 4) throw new Error('Tracé trop court.')
  const profile = buildProfile(track)
  const n = Math.floor(track.total / STEP) + 1
  const lat = new Float64Array(n), lon = new Float64Array(n), e0 = new Float32Array(n), ele = new Float32Array(n), grade = new Float32Array(n)
  for (let k = 0; k < n; k++) {
    const t = trackAt(track, k * STEP)
    lat[k] = t.lat; lon[k] = t.lon; e0[k] = t.ele
    ele[k] = eleAtDist(profile, k * STEP)
  }
  for (let k = 0; k < n; k++) {
    const a = Math.max(0, k * STEP - STEP / 2), b = Math.min(track.total, k * STEP + STEP / 2)
    grade[k] = b > a ? ((eleAtDist(profile, b) - eleAtDist(profile, a)) / (b - a)) * 100 : 0
  }
  return { name, n, total: (n - 1) * STEP, lat, lon, e0, ele, grade, dplus: dplusOf(profile.ele), track, profile }
}

export const idxAt = (r: Route, d: number) => clamp(Math.round(d / STEP), 0, r.n - 1)

/** Pente moyenne (%) autour de la distance d, en mètres. */
export function gradeAt(r: Route, d: number) {
  const i = idxAt(r, d)
  let s = 0, c = 0
  for (let q = Math.max(0, i - 3); q <= Math.min(r.n - 1, i + 3); q++) { s += r.grade[q]; c++ }
  return s / c
}

/** Pente lissée pour chaque échantillon (mise en cache sur la route). */
const gsCache = new WeakMap<Route, Float32Array>()
export function smoothGrades(r: Route) {
  let g = gsCache.get(r)
  if (!g) {
    g = new Float32Array(r.n)
    for (let i = 0; i < r.n; i++) g[i] = gradeAt(r, i * STEP)
    gsCache.set(r, g)
  }
  return g
}

export interface SectionStats { len: number; dplus: number; avg: number; max: number }

/** Longueur (km), D+ (m), pente moyenne et maximale (%) entre deux kilomètres. */
export function sectionStats(r: Route, aKm: number, bKm: number): SectionStats {
  const i0 = clamp(Math.round((Math.min(aKm, bKm) * 1000) / STEP), 0, r.n - 1), i1 = clamp(Math.round((Math.max(aKm, bKm) * 1000) / STEP), 0, r.n - 1)
  let dplus = 0, max = 0
  for (let i = i0 + 1; i <= i1; i++) if (r.ele[i] > r.ele[i - 1]) dplus += r.ele[i] - r.ele[i - 1]
  for (let i = i0; i <= i1; i++) max = Math.max(max, smoothGrades(r)[i])
  const len = (i1 - i0) * STEP
  return { len: len / 1000, dplus, avg: len > 0 ? ((r.ele[i1] - r.ele[i0]) / len) * 100 : 0, max }
}

/** Montées d'au moins 800 m à 3 % de moyenne. */
export function findClimbs(r: Route): Climb[] {
  const g = r.grade, n = r.n, runs: [number, number][] = []
  let s0 = -1
  for (let k = 0; k < n; k++) {
    const up = g[k] >= 2
    if (up && s0 < 0) s0 = k
    if ((!up || k === n - 1) && s0 >= 0) { runs.push([s0, k]); s0 = -1 }
  }
  const m: [number, number][] = []
  for (const run of runs) {
    const last = m[m.length - 1]
    if (last && run[0] - last[1] <= 6) last[1] = run[1]
    else m.push([run[0], run[1]])
  }
  const out: Climb[] = []
  for (const [a, b] of m) {
    const len = (b - a) * STEP
    if (len < 800) continue
    const gain = r.ele[b] - r.ele[a], avg = (gain / len) * 100
    if (avg < 3) continue
    out.push({ i0: a, i1: b, a: (a * STEP) / 1000, b: (b * STEP) / 1000, len, avg, gain })
  }
  return out
}

/** Forme compacte pour le stockage : [lat, lon, ele] arrondis. */
export function serializeRoute(r: Route) {
  return {
    name: r.name,
    pts: Array.from({ length: r.track.n }, (_, i) => [+r.track.lat[i].toFixed(6), +r.track.lon[i].toFixed(6), +r.track.raw[i].toFixed(1)]),
  }
}
export function deserializeRoute(d: { name: string; pts: number[][] }) {
  return buildRoute(d.name, d.pts.map(p => ({ lat: p[0], lon: p[1], ele: p[2] })))
}

/** Boucle de démonstration autour de Chantilly (≈ 150 km, 4 bosses). */
export function demoPoints(): RawPoint[] {
  const pts: RawPoint[] = [], N = 3000, c = { lat: 49.19, lon: 2.47 }
  const bump = (t: number, m: number, w: number, h: number) => h * Math.exp(-(((t - m) / w) ** 2))
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = t * 2 * Math.PI
    const r = 0.19 * (1 + 0.22 * Math.sin(3 * a) + 0.08 * Math.sin(7 * a + 1))
    const ele = 70 + 22 * Math.sin(5 * a) + 10 * Math.sin(13 * a + 2) + bump(t, 0.18, 0.008, 110) +
      bump(t, 0.47, 0.014, 170) + bump(t, 0.78, 0.006, 80) + bump(t, 0.62, 0.004, 45)
    pts.push({ lat: c.lat + r * Math.sin(a), lon: c.lon + r * 1.5 * Math.cos(a) - 0.285, ele })
  }
  return pts
}
