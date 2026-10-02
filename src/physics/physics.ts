/**
 * Modèle physique : P = [M·g·(pente + Crr)·v + 0,5·ρ·CdA·v³] / rendement
 */
export const G = 9.81
export const RHO = 1.2
export const ETA = 0.96
export const CRR = 0.0045
/** Vitesse max retenue par le modèle : 60 km/h. */
export const VMAX = 60 / 3.6

export interface Body { mass: number; cda: number; crr?: number }

/** Puissance (W) nécessaire pour rouler à v (m/s) sur une pente g (fraction, 0,05 = 5 %). */
export function powerFor(b: Body, v: number, g: number) {
  return (b.mass * G * (g + (b.crr ?? CRR)) * v + 0.5 * RHO * b.cda * v ** 3) / ETA
}

/** Vitesse (m/s) obtenue avec une puissance P sur une pente g. Résolution par dichotomie. */
export function speedFor(b: Body, P: number, g: number, vmax = VMAX) {
  const f = (v: number) => powerFor(b, v, g) - P
  if (f(vmax) < 0) return vmax
  let lo = 0.3, hi = vmax
  if (f(lo) > 0) return lo
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    if (f(m) > 0) hi = m
    else lo = m
  }
  return (lo + hi) / 2
}

/**
 * Secondes gagnées par watt supplémentaire sur un tronçon de d mètres, à la puissance P.
 * Élevé en montée (vitesse faible), faible sur le plat, quasi nul en descente rapide.
 */
export function secondsPerWatt(b: Body, P: number, g: number, d: number) {
  const v = speedFor(b, P, g)
  if (v >= VMAX - 1e-6) return 0
  const dPdv = (b.mass * G * (g + (b.crr ?? CRR)) + 1.5 * RHO * b.cda * v * v) / ETA
  if (dPdv <= 0) return 0
  return d / (v * v * dPdv)
}
