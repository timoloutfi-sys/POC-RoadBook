import { ETA, G, ROT_MASS, VMAX, resistance, type Body } from './physics'

export interface RideInputs {
  /** Longueur d'un pas (m). */
  ds: number
  /** Pentes en %, puissance demandée (W), densité de l'air, vent de face (m/s), vitesse maximale (m/s), par échantillon. */
  grade: ArrayLike<number>
  power: ArrayLike<number>
  rho?: ArrayLike<number>
  wind?: ArrayLike<number>
  vcap?: ArrayLike<number>
  /** Vitesse de départ (m/s). */
  v0?: number
  /** Décélération de freinage confortable (m/s²). */
  brake?: number
}

/** On arrête de pédaler progressivement entre 45 et 60 km/h : au-delà, le pédalage ne sert plus. */
const COAST_FROM = 45 / 3.6, COAST_TO = 60 / 3.6
const coast = (v: number) => (v <= COAST_FROM ? 1 : v >= COAST_TO ? 0 : 1 - (v - COAST_FROM) / (COAST_TO - COAST_FROM))

/**
 * Simulation le long du parcours avec inertie : la vitesse varie selon le bilan d'énergie
 * (on garde de l'élan dans une bosse, on accélère lentement après un virage), plafonnée
 * dans les virages et les descentes, avec freinage anticipé avant chaque plafond.
 * Retourne la durée de chaque pas, la vitesse à chaque échantillon et la puissance réellement
 * fournie sur chaque pas (nulle en roue libre).
 */
export function simulateRide(b: Body, inp: RideInputs) {
  const n = inp.grade.length, ds = inp.ds, m = b.mass + ROT_MASS, sub = 5, h = ds / sub
  const cap = (i: number) => Math.min(VMAX, inp.vcap ? inp.vcap[i] : VMAX)
  const v = new Float64Array(n), pw = new Float64Array(n)
  v[0] = Math.min(cap(0), inp.v0 ?? 6)
  for (let i = 0; i < n - 1; i++) {
    const g = inp.grade[i] / 100, env = { rho: inp.rho?.[i], wind: inp.wind?.[i] }, P = inp.power[i]
    let s = v[i], pe = 0
    for (let k = 0; k < sub; k++) {
      const vv = Math.max(s, 1), pk = P * coast(vv)
      pe += pk / sub
      const a = ((pk * ETA) / vv - resistance(b, vv, g, env)) / m
      s = Math.sqrt(Math.max(1, s * s + 2 * a * h))
    }
    v[i + 1] = Math.min(s, cap(i + 1))
    pw[i + 1] = pe
  }
  // Freinage anticipé : on ne peut pas arriver plus vite au plafond suivant que ce que les freins permettent.
  const br = inp.brake ?? 2.5
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * br * ds))
  const dt = new Float64Array(n)
  for (let i = 1; i < n; i++) dt[i] = ds / Math.max(0.8, (v[i - 1] + v[i]) / 2)
  return { v, dt, pw }
}

/** Plafond de vitesse en virage (m/s) pour un rayon r (m) et une accélération latérale tolérée (m/s²). */
export const cornerSpeed = (r: number, aLat = 3) => Math.sqrt(aLat * r)
export { G }
