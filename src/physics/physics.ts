/**
 * Modèle physique du cycliste en régime établi.
 *
 * P · η = [ M·g·sin θ + M·g·Crr·cos θ ] · v + ½ · ρ · CdA · (v + w)·|v + w| · v
 *
 * - η : rendement de la transmission (chaîne propre, roulements) ≈ 0,975.
 * - Crr : résistance au roulement, 0,004 (route lisse, pneus haut de gamme) à 0,007 (route dégradée).
 * - ρ : densité de l'air, qui baisse avec l'altitude et la chaleur (1,225 kg/m³ à 0 m et 15 °C).
 * - w : vent de face le long de la route (m/s, négatif = vent arrière).
 */
export const G = 9.81
export const RHO0 = 1.225
export const ETA = 0.975
export const CRR = 0.005
/** Vitesse maximale retenue en descente : 65 km/h (au-delà, un amateur freine). */
export const VMAX = 65 / 3.6
/** Masse équivalente des parties en rotation (roues), ajoutée pour les accélérations. */
export const ROT_MASS = 1.2

export interface Body { mass: number; cda: number; crr?: number }
export interface Env { rho?: number; wind?: number }

/** Densité de l'air (kg/m³) à une altitude (m) et une température (°C), atmosphère standard. */
export function airDensity(altM: number, tempC = 15) {
  const p = 101325 * Math.pow(1 - 2.25577e-5 * Math.max(-400, altM), 5.25588)
  return p / (287.05 * (tempC + 273.15))
}

/**
 * Part de la puissance au seuil disponible en altitude, sans acclimatation
 * (Bassett et al., 1999) : ≈ −2 % à 1000 m, −9 % à 2000 m, −17 % à 3000 m.
 */
export function altitudePowerFactor(altM: number) {
  const h = Math.max(0, altM) / 1000
  return Math.max(0.6, 1 - 0.0112 * h - 0.0186 * h * h)
}

/** Forces résistantes (N) à la vitesse v (m/s) sur une pente g (0,05 = 5 %). */
export function resistance(b: Body, v: number, g: number, env: Env = {}) {
  const th = Math.atan(g), rho = env.rho ?? RHO0, va = v + (env.wind ?? 0)
  return b.mass * G * (Math.sin(th) + (b.crr ?? CRR) * Math.cos(th)) + 0.5 * rho * b.cda * va * Math.abs(va)
}

/** Puissance (W) nécessaire pour rouler à v (m/s) en régime établi. */
export function powerFor(b: Body, v: number, g: number, env: Env = {}) {
  return (resistance(b, v, g, env) * v) / ETA
}

/** Vitesse (m/s) en régime établi pour une puissance P (W), par dichotomie. */
export function speedFor(b: Body, P: number, g: number, env: Env = {}, vmax = VMAX) {
  const f = (v: number) => powerFor(b, v, g, env) - P
  if (f(vmax) < 0) return vmax
  let lo = 0.3, hi = vmax
  if (f(lo) > 0) return lo
  for (let i = 0; i < 36; i++) {
    const m = (lo + hi) / 2
    if (f(m) > 0) hi = m
    else lo = m
  }
  return (lo + hi) / 2
}

/** Secondes gagnées par watt supplémentaire sur d mètres : élevé en montée, quasi nul en descente rapide. */
export function secondsPerWatt(b: Body, P: number, g: number, d: number, env: Env = {}) {
  const v = speedFor(b, P, g, env)
  if (v >= VMAX - 1e-6) return 0
  const dv = 0.01, dPdv = (powerFor(b, v + dv, g, env) - powerFor(b, v - dv, g, env)) / (2 * dv)
  return dPdv > 0 ? d / (v * v * dPdv) : 0
}

/** CdA qui donne une vitesse donnée (km/h) à une puissance donnée (W) sur le plat sans vent : calibrage. */
export function cdaFromFlat(mass: number, crr: number, watts: number, kmh: number) {
  const v = kmh / 3.6, aero = (watts * ETA) / v - mass * G * crr
  return Math.max(0.15, Math.min(0.6, aero / (0.5 * RHO0 * v * v)))
}
