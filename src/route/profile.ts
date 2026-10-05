import { trackAt, type Track } from './track'

/** Profil à pas variable : des tronçons de pente constante, courts quand la pente change vite. */
export interface Profile {
  /** Nombre de tronçons. */
  n: number
  /** Limites des tronçons (m), n + 1 valeurs. */
  d: Float64Array
  /** Altitude lissée aux limites (m), n + 1 valeurs. */
  ele: Float32Array
  /** Pente de chaque tronçon (%). */
  grade: Float32Array
  total: number
}

/** Pas de rééchantillonnage de travail, tolérance d'altitude, longueurs min et max d'un tronçon (m). */
export const FINE = 5
export const PROFILE_TOL = 0.5
export const SEG_MIN = 10
export const SEG_MAX = 300
/** Variation de pente (points) qui impose une coupure. */
export const SLOPE_STEP = 1

/**
 * Découpe le tracé en tronçons de pente constante : coupure là où l'altitude s'écarte de plus de 0,5 m
 * de la droite du tronçon, ou là où la pente varie de plus d'un point entre ses deux moitiés.
 * `cuts` impose des coupures (points du road book, changements de cible), en mètres.
 */
export function buildProfile(t: Track, cuts: number[] = []): Profile {
  const m = Math.max(2, Math.ceil(t.total / FINE) + 1), step = t.total / (m - 1)
  const e = new Float32Array(m)
  for (let i = 0; i < m; i++) e[i] = trackAt(t, i * step).ele
  const forced = new Uint8Array(m)
  for (const c of cuts) { const k = Math.round(c / step); if (k > 0 && k < m - 1) forced[k] = 1 }
  const minK = Math.max(1, Math.round(SEG_MIN / step)), maxK = Math.max(minK, Math.round(SEG_MAX / step))
  const keep = new Uint8Array(m)
  keep[0] = 1; keep[m - 1] = 1
  const stack: [number, number][] = [[0, m - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    let cut = -1
    for (let k = a + 1; k < b; k++) if (forced[k]) { cut = k; break }
    if (cut < 0 && b - a > minK * 2) {
      let worst = -1, wv = PROFILE_TOL
      for (let k = a + minK; k <= b - minK; k++) {
        const v = Math.abs(e[k] - (e[a] + ((e[b] - e[a]) * (k - a)) / (b - a)))
        if (v > wv) { wv = v; worst = k }
      }
      if (worst < 0) {
        const mid = (a + b) >> 1, g1 = (e[mid] - e[a]) / (mid - a), g2 = (e[b] - e[mid]) / (b - mid)
        if (Math.abs(g1 - g2) * 100 / step > SLOPE_STEP && mid - a >= minK && b - mid >= minK) worst = mid
      }
      if (worst >= 0) cut = worst
    }
    if (cut < 0 && b - a > maxK) cut = (a + b) >> 1
    if (cut > 0) { keep[cut] = 1; stack.push([a, cut], [cut, b]) }
  }
  const idx: number[] = []
  for (let k = 0; k < m; k++) if (keep[k]) idx.push(k)
  const n = idx.length - 1
  const p: Profile = { n, d: new Float64Array(n + 1), ele: new Float32Array(n + 1), grade: new Float32Array(n), total: t.total }
  for (let j = 0; j <= n; j++) { p.d[j] = idx[j] * step; p.ele[j] = e[idx[j]] }
  p.d[n] = t.total
  for (let j = 0; j < n; j++) p.grade[j] = ((p.ele[j + 1] - p.ele[j]) / (p.d[j + 1] - p.d[j])) * 100
  return p
}

/** Tronçon contenant la distance d (m). */
export function profSegAt(p: Profile, d: number): number {
  let lo = 0, hi = p.n - 1
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (p.d[mid] <= d) lo = mid; else hi = mid - 1 }
  return lo
}
export const gradeAtDist = (p: Profile, d: number) => p.grade[profSegAt(p, d)]
export function eleAtDist(p: Profile, d: number) {
  const j = profSegAt(p, Math.min(Math.max(d, 0), p.total)), dd = p.d[j + 1] - p.d[j]
  return p.ele[j] + (dd > 0 ? ((Math.min(Math.max(d, 0), p.total) - p.d[j]) / dd) * (p.ele[j + 1] - p.ele[j]) : 0)
}

/** Dénivelé positif avec hystérésis (seuil en mètres) : ignore les oscillations plus petites. */
export function dplusOf(ele: ArrayLike<number>, thr = 2) {
  let sum = 0, lo = ele[0], hi = ele[0], up = false
  for (let i = 1; i < ele.length; i++) {
    const v = ele[i]
    if (up) { if (v > hi) hi = v; else if (hi - v >= thr) { sum += hi - lo; up = false; lo = v } }
    else { if (v < lo) lo = v; else if (v - lo >= thr) { up = true; hi = v } }
  }
  if (up) sum += hi - lo
  return sum
}
