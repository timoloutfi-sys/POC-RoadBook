import { describe, expect, it } from 'vitest'
import { cornerCaps, headwind } from '../route/geometry'
import { STEP, buildRoute } from '../route/route'
import { simulateRide } from './kinematics'
import { airDensity, altitudePowerFactor, cdaFromFlat, speedFor } from './physics'

const kmh = (v: number) => v * 3.6
/** Route rectiligne vers le nord, altitude donnée par une fonction de la distance (m). */
const totalTime = (dt: ArrayLike<number>) => Array.from(dt).reduce((a, b) => a + b, 0)

describe('repères de vitesse réels', () => {
  it('amateur sur le plat : 200 W, CdA 0,32, 85 kg ≈ 32–33 km/h', () => {
    const v = kmh(speedFor({ mass: 85, cda: 0.32, crr: 0.005 }, 200, 0))
    expect(v).toBeGreaterThan(31)
    expect(v).toBeLessThan(34.5)
  })
  it('contre-la-montre : 300 W, CdA 0,24 ≈ 43 km/h', () => {
    const v = kmh(speedFor({ mass: 80, cda: 0.24, crr: 0.004 }, 300, 0))
    expect(v).toBeGreaterThan(41.5)
    expect(v).toBeLessThan(44.5)
  })
  it('Alpe d’Huez (13,8 km à 8,1 %) à 4 W/kg, 70 + 8 kg : 55 à 62 min', () => {
    const v = speedFor({ mass: 78, cda: 0.35, crr: 0.005 }, 280, 0.081)
    const min = 13800 / v / 60
    expect(min).toBeGreaterThan(55)
    expect(min).toBeLessThan(62)
  })
  it('la simulation avec inertie retrouve le régime établi sur pente constante', () => {
    const n = 200, grade = new Float32Array(n).fill(5), power = new Float32Array(n).fill(250)
    const body = { mass: 80, cda: 0.32 }
    const sim = simulateRide(body, { ds: STEP, grade, power, v0: speedFor(body, 250, 0.05) })
    const steady = ((n - 1) * STEP) / speedFor(body, 250, 0.05)
    expect(Math.abs(totalTime(sim.dt) - steady) / steady).toBeLessThan(0.01)
  })
})

describe('effets pris en compte', () => {
  const body = { mass: 82, cda: 0.32 }
  it('l’élan aide dans un creux : pas plus lent que la somme des régimes établis', () => {
    const grade = Float32Array.from({ length: 24 }, (_, i) => (i < 12 ? -4 : 4)), power = new Float32Array(24).fill(200)
    const sim = simulateRide(body, { ds: STEP, grade, power, v0: speedFor(body, 200, 0) })
    let steady = 0
    for (let i = 1; i < 24; i++) steady += STEP / speedFor(body, 200, grade[i] / 100)
    expect(totalTime(sim.dt)).toBeLessThan(steady)
  })
  it('les épingles ralentissent une descente', () => {
    // Zigzag : on alterne nord-est / nord-ouest tous les 300 m (virages à 90°), 7 % de descente.
    const pts = Array.from({ length: 201 }, (_, i) => { const m = i * 25, leg = Math.floor(m / 300), off = m % 300, s = leg % 2 ? -1 : 1
      return { lat: 45 + (m / Math.SQRT2) / 111320, lon: 2 + (s * (off - 150) / Math.SQRT2) / 78850, ele: 1000 - m * 0.07 } })
    const r = buildRoute('z', pts), p = new Float32Array(r.n).fill(100)
    const free = totalTime(simulateRide(body, { ds: STEP, grade: r.grade, power: p, v0: 10 }).dt)
    const caps = cornerCaps(r)
    const real = totalTime(simulateRide(body, { ds: STEP, grade: r.grade, power: p, vcap: caps, v0: 10 }).dt)
    expect(Math.min(...caps)).toBeLessThan(12)
    expect(real).toBeGreaterThan(free * 1.1)
  })
  it('un aller-retour venté est plus lent que sans vent', () => {
    const out = Array.from({ length: 401 }, (_, i) => ({ lat: 45 + (i < 200 ? i : 400 - i) * 25 / 111320, lon: 2 + (i < 200 ? 0 : 0.0002), ele: 100 }))
    const r = buildRoute('ar', out), power = new Float32Array(r.n).fill(200)
    const calm = totalTime(simulateRide(body, { ds: STEP, grade: r.grade, power }).dt)
    const windy = totalTime(simulateRide(body, { ds: STEP, grade: r.grade, power, wind: headwind(r, 25, 0) }).dt)
    expect(windy).toBeGreaterThan(calm * 1.03)
  })
  it('air plus léger en altitude : plus vite à puissance égale', () => {
    expect(airDensity(0)).toBeCloseTo(1.225, 2)
    expect(airDensity(2000)).toBeCloseTo(1.007, 1)
    expect(speedFor(body, 200, 0, { rho: airDensity(2000) })).toBeGreaterThan(speedFor(body, 200, 0) * 1.04)
  })
  it('mais la puissance baisse : ≈ −9 % à 2000 m', () => {
    expect(altitudePowerFactor(500)).toBeGreaterThan(0.98)
    expect(altitudePowerFactor(2000)).toBeGreaterThan(0.88)
    expect(altitudePowerFactor(2000)).toBeLessThan(0.93)
  })
  it('calibrage : le CdA retrouvé redonne la vitesse mesurée', () => {
    const cda = cdaFromFlat(82, 0.005, 210, 32)
    expect(kmh(speedFor({ mass: 82, cda, crr: 0.005 }, 210, 0))).toBeCloseTo(32, 1)
    expect(cda).toBeGreaterThan(0.25)
    expect(cda).toBeLessThan(0.42)
  })
})
