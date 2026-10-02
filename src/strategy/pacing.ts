import { speedFor, type Body } from '../physics/physics'
import { STEP } from '../route/route'

/** Plancher et plafond de l'allure, en fraction de FTP : on ne pédale jamais sous 45 %, jamais au-dessus de 130 %. */
export const X_MIN = 0.45
export const X_MAX = 1.3

export { ifForDuration } from './realism'

/** Conditions par échantillon : densité de l'air, vent de face (m/s), plafond d'allure (fraction de FTP). */
export interface PacingEnv { rho?: ArrayLike<number>; wind?: ArrayLike<number>; cap?: ArrayLike<number> }

export interface Pacing {
  /** Allure (fraction de FTP) pour chaque échantillon du parcours. */
  ratio: Float32Array
  /** Temps total (s) et puissance normalisée (fraction de FTP) obtenus. */
  time: number
  np: number
}

/** Cible de l'optimisation : une puissance normalisée (fraction de FTP), ou un temps total (s). */
export type PacingTarget = { np: number } | { time: number }

/**
 * Allure qui minimise le temps total pour un niveau de fatigue donné (puissance normalisée),
 * sur un parcours de pentes `gs` (en %). Pour chaque pente on minimise
 * t(x) · (1 + λ · x⁴), où x est la fraction de FTP et λ règle le compromis temps/fatigue :
 * on pédale fort là où chaque watt fait gagner le plus de temps (montées), on récupère
 * là où il n'en rapporte presque pas (descentes rapides).
 */
export function optimalPacing(gs: Float32Array, body: Body, ftp: number, target: PacingTarget, env: PacingEnv = {}): Pacing {
  // Les échantillons de même pente (à 0,5 % près), même vent (à 1 m/s), même air et même plafond
  // partagent la même allure : l'optimisation se fait par paquets.
  interface Bucket { g: number; w: number; rho: number; cap: number; c: number }
  const buckets = new Map<string, Bucket>()
  const keys: string[] = new Array(gs.length)
  for (let i = 0; i < gs.length; i++) {
    const g = Math.max(-20, Math.min(30, Math.round(gs[i] * 2) / 2)), w = Math.round(env.wind?.[i] ?? 0)
    const rho = Math.round((env.rho?.[i] ?? 1.225) * 25) / 25, cap = Math.round(Math.min(X_MAX, env.cap?.[i] ?? X_MAX) * 25) / 25
    const k = `${g}|${w}|${rho}|${cap}`
    keys[i] = k
    const b = buckets.get(k)
    if (b) b.c++
    else buckets.set(k, { g, w, rho, cap, c: 1 })
  }
  const tOf = (x: number, b: Bucket) => STEP / speedFor(body, x * ftp, b.g / 100, { rho: b.rho, wind: b.w })
  const best = (bk: Bucket, lam: number) => {
    let lo = X_MIN, hi = Math.max(X_MIN + 0.01, bk.cap)
    const f = (x: number) => tOf(x, bk) * (1 + lam * x ** 4)
    const phi = 0.6180339887
    let a = hi - phi * (hi - lo), b = lo + phi * (hi - lo), fa = f(a), fb = f(b)
    for (let it = 0; it < 20; it++) {
      if (fa < fb) { hi = b; b = a; fb = fa; a = hi - phi * (hi - lo); fa = f(a) }
      else { lo = a; a = b; fa = fb; b = lo + phi * (hi - lo); fb = f(b) }
    }
    return (lo + hi) / 2
  }
  const solve = (lam: number) => {
    const xs = new Map<string, number>()
    let time = 0, stress = 0
    for (const [k, b] of buckets) {
      const x = best(b, lam), t = tOf(x, b)
      xs.set(k, x); time += b.c * t; stress += b.c * x ** 4 * t
    }
    return { xs, time, np: (stress / time) ** 0.25 }
  }
  // Plus λ est grand, plus on ménage ses forces : NP baisse, le temps monte.
  let lo = -3, hi = 5, sol = solve(10 ** ((lo + hi) / 2))
  for (let it = 0; it < 24; it++) {
    const mid = (lo + hi) / 2
    sol = solve(10 ** mid)
    const tooHard = 'np' in target ? sol.np > target.np : sol.time < target.time
    if (tooHard) lo = mid
    else hi = mid
  }
  const ratio = new Float32Array(gs.length)
  for (let i = 0; i < gs.length; i++) ratio[i] = sol.xs.get(keys[i]) ?? X_MIN
  return { ratio, time: sol.time, np: sol.np }
}

/** Moyenne glissante sur ±w échantillons : évite les changements de cible trop rapprochés. */
export function smooth(a: Float32Array, w: number) {
  const out = new Float32Array(a.length), cum = new Float64Array(a.length + 1)
  for (let i = 0; i < a.length; i++) cum[i + 1] = cum[i] + a[i]
  for (let i = 0; i < a.length; i++) {
    const i0 = Math.max(0, i - w), i1 = Math.min(a.length - 1, i + w)
    out[i] = (cum[i1 + 1] - cum[i0]) / (i1 - i0 + 1)
  }
  return out
}
